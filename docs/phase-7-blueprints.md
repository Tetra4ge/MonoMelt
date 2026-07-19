# Phase 7: Blueprints

## Purpose

Phase 7 packages a reviewed scenario and plan into useful engineering
artifacts. Generated output must be safe to inspect, valid against schemas,
and explicitly marked as a starting point requiring review before deployment.

## Outcomes

The platform generates a versioned blueprint package containing architecture
documentation, service contracts, infrastructure templates, migration aids,
and evidence reports. It validates all artifacts before making a short-lived
download available to the project owner.

## Blueprint contents

Create a deterministic package layout such as:

```text
blueprint/
  README.md
  decisions/
  services/<service-name>/
  contracts/
  infrastructure/
  migration/
  reports/
  manifest.json
```

Required artifacts:

- architecture overview, service catalog, boundary evidence, and open risks;
- a migration roadmap, rollback criteria, and verification checklist;
- ownership and data-flow/security matrices;
- OpenAPI contracts for discovered or proposed synchronous interfaces;
- event contract templates for asynchronous interactions;
- Docker and Kubernetes templates with readiness/liveness probes, resource
  requests/limits, non-root execution, and secret references only;
- gateway route map, authentication/authorization boundary guidance, and
  rate-limit recommendations;
- cost/performance reports with all assumptions and model versions.

## Generation rules

- Use typed internal models and templates for predictable artifacts. Use an
  LLM only for bounded narrative or draft contracts, then validate and label
  its contribution.
- Never place production credentials, source archives, raw tokens, or database
  connection strings in an export.
- Generate `Secret` templates containing placeholders and document the secret
  manager integration; do not generate real secret values.
- Validate OpenAPI documents, Kubernetes YAML/schema, JSON manifests, links,
  filenames, and archive paths before packaging.
- Use safe slug generation and archive construction to prevent traversal,
  overwrites, and user-controlled executable output.

## Export lifecycle

```text
POST /api/projects/:projectId/blueprints
GET  /api/projects/:projectId/blueprints
GET  /api/projects/:projectId/blueprints/:blueprintId
POST /api/projects/:projectId/blueprints/:blueprintId/download
```

- Creating a blueprint is asynchronous and references immutable scenario and
  plan revisions.
- Persist a manifest with generator versions, input revisions, artifact hashes,
  validation results, and warnings.
- Store exports privately. Return a signed, single-purpose URL with short
  expiry after verifying project ownership.
- Support regeneration as a new blueprint version and retain an audit record of
  downloads and deletions.

## Quality gates

- Validate generated OpenAPI files with an OpenAPI validator and Kubernetes
  manifests with schema/lint tooling in CI.
- Add golden-file tests for deterministic templates and adversarial tests for
  unsafe names/content.
- Run archive inspection tests to verify all entries stay inside the package
  root and contain no real secrets.
- Require a visible warning in both the UI and README that artifacts require
  engineering, security, and platform review before production use.

## Definition of done

- An authorized project owner can create, inspect, and download a validated,
  versioned blueprint whose manifest identifies every input, assumption,
  generated artifact, warning, and validation result.
