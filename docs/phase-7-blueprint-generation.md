# Phase 7: Blueprint & Infrastructure Code Generation

## Overview
Phase 7 is where the platform produces tangible, deployable artifacts. It translates the theoretical models into actual configuration and code files for the engineering teams.

## 1. OpenAPI / Swagger Generation
- **LLM Prompting:** Pass the extracted HTTP routes and data models of a specific proposed service to the LLM (Gemini/OpenRouter).
- **Output:** Generate strict OpenAPI 3.0 YAML/JSON specifications defining the exact API contracts between the new services.

## 2. Infrastructure as Code (IaC) Generation
- **Docker:** Generate a generic `Dockerfile` optimized for the recommended tech stack of each service (e.g., multi-stage builds for Go, lightweight Alpine for Node).
- **Kubernetes (K8s):** Generate manifests:
  - `Deployment.yaml` (including liveness/readiness probes).
  - `Service.yaml` (ClusterIP vs LoadBalancer).
  - `ConfigMap.yaml` and `Secret.yaml` templates.
- **Service Mesh (Optional):** Include Istio or Linkerd annotations if the user selected strict security isolation.

## 3. Zip Archiver & Export Pipeline
- **Assembler Engine (Node.js):** Gather all generated artifacts (Markdown roadmaps, JSON costs, OpenAPI specs, K8s manifests, DB schemas).
- **Archiving:** Zip the files into a structured directory tree (e.g., `blueprint/service-A/`, `blueprint/k8s/`).
- **Download Endpoint:** Serve the zip file securely to the user via a temporary, expiring download link.
