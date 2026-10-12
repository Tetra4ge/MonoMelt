"""
Phase 7 Blueprint Generator Engine.
Builds deterministic architecture export ZIP packages containing Dockerfiles, K8s manifests, OpenAPI contracts, ADRs, and manifest.json.
"""

import io
import json
import re
import zipfile
import hashlib
import base64
from typing import Any
from models.blueprints import (
    GenerateBlueprintRequest,
    BlueprintManifest,
    ArtifactFile,
    BlueprintResponse
)


DNS_LABEL_RE = re.compile(r"^[a-z0-9]([a-z0-9-]{0,38}[a-z0-9])?$")
SECRET_PATTERNS = [
    re.compile(r"AKIA[0-9A-Z]{16}"),
    re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----"),
    re.compile(r"ghp_[A-Za-z0-9]{36}"),
    re.compile(r"sk-[A-Za-z0-9]{20,}"),
]


def to_service_slug(name: str) -> str:
    """
    Service names come from clustering ("Service_1") or user edits, and end up in
    ZIP paths, Kubernetes object names, hostnames and JS source. Reduce them to a
    DNS-1123 label so none of those can break (or escape the archive).
    """
    slug = re.sub(r"[^a-z0-9]+", "-", str(name or "").lower()).strip("-")[:39].strip("-")
    return slug or "service"


class BlueprintGenerator:
    def __init__(self, request: GenerateBlueprintRequest):
        self.req = request
        self.artifacts: list[ArtifactFile] = []
        self.files: dict[str, str] = {}
        self.warnings: list[str] = [
            "Generated artifacts contain draft templates and secret placeholders.",
            "Mandatory engineering, security, and platform review is required prior to deployment."
        ]

    def generate(self) -> BlueprintResponse:
        zip_buffer = io.BytesIO()
        
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zf:
            # 1. README.md
            readme_content = self._generate_readme()
            self._add_file(zf, "blueprint/README.md", readme_content)

            # 2. Decisions (ADRs)
            adr_content = self._generate_adr()
            self._add_file(zf, "blueprint/decisions/ADR-001-microservices-decomposition.md", adr_content)

            # 3. Services (Dockerfiles & K8s manifests)
            services = self._normalized_services()

            for s in services:
                s_name = s["name"]
                service_root = f"blueprint/services/{s_name}"

                # Runnable source scaffold. The generated Dockerfile below builds this application.
                self._add_file(zf, f"{service_root}/package.json", self._generate_package_json(s_name))
                self._add_file(zf, f"{service_root}/src/server.js", self._generate_service_source(s_name))
                
                # Dockerfile
                dockerfile = self._generate_dockerfile(s_name)
                self._add_file(zf, f"{service_root}/Dockerfile", dockerfile)

                # K8s Deployment
                k8s_deploy = self._generate_k8s_deployment(s_name)
                self._add_file(zf, f"{service_root}/k8s/deployment.yaml", k8s_deploy)

                # K8s Service
                k8s_svc = self._generate_k8s_service(s_name)
                self._add_file(zf, f"{service_root}/k8s/service.yaml", k8s_svc)

            # 4. Contracts (OpenAPI & Events)
            openapi_spec = self._generate_openapi_spec(services)
            self._add_file(zf, "blueprint/contracts/openapi.json", json.dumps(openapi_spec, indent=2))

            event_spec = self._generate_event_contracts(services)
            self._add_file(zf, "blueprint/contracts/events.json", json.dumps(event_spec, indent=2))

            # 5. Infrastructure (Gateway routes & Secrets template)
            gw_routes = self._generate_gateway_routes(services)
            self._add_file(zf, "blueprint/infrastructure/gateway-routes.json", json.dumps(gw_routes, indent=2))

            secret_template = self._generate_secret_template()
            self._add_file(zf, "blueprint/infrastructure/secret-template.yaml", secret_template)

            self._add_file(zf, "blueprint/infrastructure/terraform/main.tf", self._generate_terraform(services))

            # 6. Migration Aids
            migration_plan = {
                "roadmap_stages": self.req.roadmap_stages,
                "consistency_security": self.req.consistency_security_items
            }
            self._add_file(zf, "blueprint/migration/migration-guide.json", json.dumps(migration_plan, indent=2))

            # 7. Reports
            if self.req.cost_performance:
                self._add_file(zf, "blueprint/reports/cost-performance-report.json", json.dumps(self.req.cost_performance, indent=2))

            # 8. Manifest.json
            manifest = BlueprintManifest(
                generator_version="1.0.0",
                project_id=self.req.project_id,
                scenario_revision_id=self.req.scenario_revision_id,
                plan_revision_id=self.req.plan_revision_id,
                version_number=self.req.version_number,
                artifacts=self.artifacts,
                input_provenance={
                    "service_count": len(services),
                    "roadmap_stage_count": len(self.req.roadmap_stages)
                },
                warnings=self.warnings,
                validation_results=self._validate(openapi_spec, services)
            )

            manifest_bytes = json.dumps(manifest.model_dump(mode='json'), indent=2).encode('utf-8')
            zf.writestr("blueprint/manifest.json", manifest_bytes)

        zip_buffer.seek(0)
        zip_base64 = base64.b64encode(zip_buffer.getvalue()).decode('ascii')

        return BlueprintResponse(
            success=True,
            manifest=manifest,
            blueprint_zip_base64=zip_base64,
            files=self.files,
        )

    def _normalized_services(self) -> list[dict[str, Any]]:
        """Proposed services with safe, unique, DNS-compatible names. Never invents services."""
        if not self.req.proposed_services:
            raise ValueError("No proposed services were provided; a blueprint needs at least one service.")
        seen: set[str] = set()
        services = []
        for raw in self.req.proposed_services:
            base = to_service_slug(raw.get("name"))
            name, n = base, 2
            while name in seen:
                suffix = f"-{n}"
                name, n = f"{base[:39 - len(suffix)]}{suffix}", n + 1
            seen.add(name)
            services.append({**raw, "name": name})
        return services

    def _validate(self, openapi_spec: dict[str, Any], services: list[dict[str, Any]]) -> dict[str, bool]:
        """Real checks on what was generated (these used to be hardcoded to True)."""
        contents = self.files.values()
        return {
            "openapi_valid": bool(openapi_spec.get("paths")) and all(p.startswith("/api/v1/") for p in openapi_spec["paths"]),
            "k8s_schema_valid": all(DNS_LABEL_RE.match(s["name"]) for s in services)
                and all(f"blueprint/services/{s['name']}/k8s/deployment.yaml" in self.files for s in services),
            "no_credentials_detected": not any(pattern.search(text) for text in contents for pattern in SECRET_PATTERNS),
        }

    def _add_file(self, zf: zipfile.ZipFile, path: str, content: str):
        data = content.encode('utf-8')
        sha = hashlib.sha256(data).hexdigest()
        self.files[path] = content
        
        self.artifacts.append(
            ArtifactFile(
                path=path,
                sha256=sha,
                size_bytes=len(data),
                content_type="text/plain" if path.endswith((".md", ".yaml", "Dockerfile")) else "application/json"
            )
        )
        zf.writestr(path, data)

    def _generate_readme(self) -> str:
        return f"""# Architecture Blueprint Export (v{self.req.version_number})

> **IMPORTANT WARNING**: This blueprint package contains generated templates and draft contracts. All artifacts require security, platform, and engineering review before deployment to production environments.

## Overview
- **Project ID**: `{self.req.project_id}`
- **Scenario Revision**: `{self.req.scenario_revision_id}`
- **Plan Revision**: `{self.req.plan_revision_id}`
- **Export Version**: `{self.req.version_number}`

## Execution Parameters
- **Cloud Provider**: `{self.req.assumptions.get('cloud_provider', 'aws').upper() if self.req.assumptions else 'AWS'}`
- **Pricing Region**: `{self.req.assumptions.get('pricing_region', 'us-east-1') if self.req.assumptions else 'us-east-1'}`
- **Risk Tolerance**: `{self.req.assumptions.get('risk_tolerance', 'medium').title() if self.req.assumptions else 'Medium'}`
- **Available Teams**: `{self.req.assumptions.get('team_count', 3) if self.req.assumptions else 3}`
- **Migration Window**: `{self.req.assumptions.get('migration_window_months', 8) if self.req.assumptions else 8} months`

## Package Structure
- `decisions/`: Architecture Decision Records (ADRs)
- `services/`: Service containers, Dockerfiles, and Kubernetes manifests
- `contracts/`: OpenAPI 3.0 and Event contract templates
- `infrastructure/`: API Gateway route map, Kubernetes Secret template and draft Terraform (`terraform/main.tf`)
- `migration/`: Phased rollout sequence & data consistency rules
- `reports/`: Cost and latency projection reports
- `manifest.json`: Cryptographic SHA-256 validation manifest
"""

    def _generate_adr(self) -> str:
        return f"""# ADR-001: Monolith to Microservices Migration Strategy

## Context
The monolithic repository was analyzed using AST parsing, graph dependency evaluation, and AI semantic vector embeddings.

## Decision
Decompose the monolith into bounded contexts using a Strangler Fig pattern. Cross-service transactional boundaries will be handled via Saga or Transactional Outbox patterns.

## Consequences
- Independent service deployment pipelines.
- Reduced blast radius for operational failures.
- Non-zero network hop latency introduced between service boundaries.
"""

    def _generate_dockerfile(self, service_name: str) -> str:
        return f"""# Multi-stage Dockerfile for {service_name}
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev

FROM node:22-alpine AS runner
WORKDIR /app
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
COPY --from=builder /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
USER appuser
EXPOSE 8080
ENV PORT=8080
CMD ["npm", "start"]
"""

    def _generate_package_json(self, service_name: str) -> str:
        return json.dumps({
            "name": service_name,
            "version": "0.1.0",
            "private": True,
            "type": "commonjs",
            "scripts": {"start": "node src/server.js"},
            "dependencies": {"express": "^5.2.1"}
        }, indent=2)

    def _generate_service_source(self, service_name: str) -> str:
        return f'''const express = require('express');

const app = express();
app.use(express.json());

app.get('/health', (_req, res) => res.json({{ service: '{service_name}', status: 'up' }}));
app.get('/api/v1/{service_name}', (_req, res) => res.json({{ service: '{service_name}', status: 'draft-contract' }}));

const port = Number(process.env.PORT || 8080);
app.listen(port, () => console.log(`{service_name} listening on ${{port}}`));
'''

    def _generate_k8s_deployment(self, service_name: str) -> str:
        return f"""apiVersion: apps/v1
kind: Deployment
metadata:
  name: {service_name}
  labels:
    app: {service_name}
spec:
  replicas: 2
  selector:
    matchLabels:
      app: {service_name}
  template:
    metadata:
      labels:
        app: {service_name}
    spec:
      securityContext:
        runAsNonRoot: true
        runAsUser: 10001
      containers:
      - name: {service_name}
        image: {service_name}:latest
        ports:
        - containerPort: 8080
        resources:
          requests:
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 15
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 5
          periodSeconds: 5
"""

    def _generate_k8s_service(self, service_name: str) -> str:
        return f"""apiVersion: v1
kind: Service
metadata:
  name: {service_name}
spec:
  type: ClusterIP
  ports:
  - port: 80
    targetPort: 8080
    protocol: TCP
  selector:
    app: {service_name}
"""

    def _generate_openapi_spec(self, services: list[dict[str, Any]]) -> dict[str, Any]:
        paths = {}
        for s in services:
            s_name = s["name"]
            paths[f"/api/v1/{s_name}"] = {
                "get": {
                    "summary": f"List items for {s_name}",
                    "responses": {
                        "200": {
                            "description": "Successful response",
                            "content": {
                                "application/json": {
                                    "schema": {
                                        "type": "object",
                                        "properties": {
                                            "status": {"type": "string", "example": "ok"}
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

        return {
            "openapi": "3.0.3",
            "info": {
                "title": "Generated Microservices API Contracts",
                "version": "1.0.0"
            },
            "paths": paths
        }

    def _generate_event_contracts(self, services: list[dict[str, Any]]) -> dict[str, Any]:
        return {
            "event_contracts": [
                {
                    "event_name": f"{s['name']}.created",
                    "publisher": s['name'],
                    "schema": {"type": "object", "properties": {"id": {"type": "string"}, "timestamp": {"type": "string"}}}
                }
                for s in services
            ]
        }

    def _generate_gateway_routes(self, services: list[dict[str, Any]]) -> dict[str, Any]:
        return {
            "routes": [
                {
                    "path_prefix": f"/api/v1/{s['name']}",
                    "target_service": f"http://{s['name']}:8080",
                    "rate_limit_per_min": 1000,
                    "auth_required": True
                }
                for s in services
            ]
        }

    def _generate_secret_template(self) -> str:
        return """apiVersion: v1
kind: Secret
metadata:
  name: microservice-secrets-template
type: Opaque
stringData:
  DATABASE_URL: "postgresql://USER:PLACEHOLDER_PASSWORD@postgres-host:5432/db"
  JWT_SECRET: "PLACEHOLDER_JWT_SECRET_CHANGE_ME"
"""

    def _generate_terraform(self, services: list[dict[str, Any]]) -> str:
        """Draft container-registry + logging scaffold for the chosen cloud."""
        assumptions = self.req.assumptions or {}
        provider = str(assumptions.get("cloud_provider", "aws")).lower()
        region = str(assumptions.get("pricing_region", "us-east-1"))
        service_list = ", ".join(f'"{s["name"]}"' for s in services)
        header = "# DRAFT - generated scaffold. Review before `terraform apply`.\n"

        if provider == "azure":
            return header + f"""terraform {{
  required_providers {{
    azurerm = {{ source = "hashicorp/azurerm", version = "~> 3.100" }}
  }}
}}

provider "azurerm" {{
  features {{}}
}}

variable "location" {{
  type    = string
  default = "{region}"
}}

locals {{
  services = [{service_list}]
}}

resource "azurerm_resource_group" "main" {{
  name     = "monomelt-services"
  location = var.location
}}

resource "azurerm_container_registry" "main" {{
  name                = "monomeltregistry"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  sku                 = "Standard"
}}

resource "azurerm_log_analytics_workspace" "main" {{
  name                = "monomelt-logs"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  retention_in_days   = 30
}}
"""

        if provider == "gcp":
            return header + f"""terraform {{
  required_providers {{
    google = {{ source = "hashicorp/google", version = "~> 5.0" }}
  }}
}}

variable "project_id" {{
  type = string
}}

variable "region" {{
  type    = string
  default = "{region}"
}}

provider "google" {{
  project = var.project_id
  region  = var.region
}}

locals {{
  services = [{service_list}]
}}

resource "google_artifact_registry_repository" "service" {{
  for_each      = toset(local.services)
  repository_id = each.key
  format        = "DOCKER"
  location      = var.region
}}
"""

        return header + f"""terraform {{
  required_providers {{
    aws = {{ source = "hashicorp/aws", version = "~> 5.0" }}
  }}
}}

variable "region" {{
  type    = string
  default = "{region}"
}}

provider "aws" {{
  region = var.region
}}

locals {{
  services = [{service_list}]
}}

resource "aws_ecr_repository" "service" {{
  for_each             = toset(local.services)
  name                 = each.key
  image_tag_mutability = "IMMUTABLE"

  image_scanning_configuration {{
    scan_on_push = true
  }}
}}

resource "aws_cloudwatch_log_group" "service" {{
  for_each          = toset(local.services)
  name              = "/monomelt/${{each.key}}"
  retention_in_days = 30
}}

output "ecr_repository_urls" {{
  value = {{ for name, repo in aws_ecr_repository.service : name => repo.repository_url }}
}}
"""
