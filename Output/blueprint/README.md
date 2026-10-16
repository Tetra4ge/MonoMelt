# Architecture Blueprint Export (v1)

> **IMPORTANT WARNING**: This blueprint package contains generated templates and draft contracts. All artifacts require security, platform, and engineering review before deployment to production environments.

## Overview
- **Project ID**: `95100126-99e7-48ed-8892-6f254767c188`
- **Scenario Revision**: `4efef806-a103-4d2f-93ed-a5685d2bf570`
- **Plan Revision**: `1ee4bf30-cba3-437a-b4e6-74ea2a95d1fd`
- **Export Version**: `1`

## Execution Parameters
- **Cloud Provider**: `GCP`
- **Pricing Region**: `europe-west1`
- **Risk Tolerance**: `Low`
- **Available Teams**: `4`
- **Migration Window**: `9 months`

## Package Structure
- `decisions/`: Architecture Decision Records (ADRs)
- `services/`: Service containers, Dockerfiles, and Kubernetes manifests
- `contracts/`: OpenAPI 3.0 and Event contract templates
- `infrastructure/`: API Gateway route map, Kubernetes Secret template and draft Terraform (`terraform/main.tf`)
- `migration/`: Phased rollout sequence & data consistency rules
- `reports/`: Cost and latency projection reports
- `manifest.json`: Cryptographic SHA-256 validation manifest
