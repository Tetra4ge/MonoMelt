<div align="center">

# MonoMELT

**Legacy Monolith → Microservices Transformation Intelligence Platform**

*Upload a monolith. Get a measured, explainable, deployable microservice blueprint.*

<p>
  <img src="https://img.shields.io/badge/license-Apache%202.0-blue?style=flat" />
  <img src="https://img.shields.io/badge/status-active%20development-orange?style=flat" />
  <img src="https://img.shields.io/badge/frontend-React%2019-61DAFB?style=flat&logo=react&logoColor=white" />
  <img src="https://img.shields.io/badge/gateway-Node%2022%20%2B%20Express%205-43853D?style=flat&logo=node.js&logoColor=white" />
  <img src="https://img.shields.io/badge/ai--service-FastAPI-009688?style=flat&logo=fastapi&logoColor=white" />
  <img src="https://img.shields.io/badge/graph-Neo4j-018bff?style=flat&logo=neo4j&logoColor=white" />
</p>

</div>

---

## Table of contents

1. [Overview](#1-overview)
2. [Product tour](#2-product-tour)
3. [Technology stack](#3-technology-stack)
4. [System architecture](#4-system-architecture)
5. [End-to-end pipeline](#5-end-to-end-pipeline)
6. [The six intelligence agents](#6-the-six-intelligence-agents)
7. [Engine deep dives](#7-engine-deep-dives)
8. [Data model](#8-data-model)
9. [Security model](#9-security-model)
10. [API reference](#10-api-reference)
11. [Frontend](#11-frontend)
12. [Repository layout](#12-repository-layout)
13. [Getting started](#13-getting-started)
14. [Configuration reference](#14-configuration-reference)
15. [Testing](#15-testing)
16. [Deployment notes](#16-deployment-notes)
17. [Status, roadmap and vision](#17-status-roadmap-and-vision)
18. [Troubleshooting](#18-troubleshooting)
19. [Contributing](#19-contributing)
20. [License and team](#20-license-and-team)

---

## 1. Overview

Splitting a monolith by gut feeling produces cascading failures, data inconsistency and latency cliffs. MonoMELT replaces guesswork with measurement. It reads a legacy codebase, builds a real dependency graph of its files, symbols and imports, clusters that graph into candidate services, and turns the chosen split into a migration plan, a cost and risk model, an infrastructure blueprint and an executive report.

**What you get from one upload** (full scope; see the capability matrix below for the status of each part)

| Stage | Output |
| :--- | :--- |
| **Ingest** | A ZIP upload or a public GitHub repository, filtered to source files, hashed and catalogued. |
| **Analyse** | AST-level parsing of Python, JavaScript and TypeScript, a Neo4j dependency graph with resolved File→File imports, and metrics: fan-in/out, import cycles, independent components, unresolved imports, parser diagnostics. |
| **Understand** | LLM findings: bounded contexts, architectural risks and data-sensitivity hot spots, each with a confidence score and a human approve/reject step. |
| **Decompose** | Competing service-boundary scenarios (conservative, aggressive, domain-driven) computed with graph clustering, with cohesion and coupling per service. |
| **Plan** | A coupling-ordered migration roadmap, a consistency/security matrix, a cost and latency model, and team ownership, all recalculable from visible assumptions and kept as immutable revisions. |
| **Export** | A downloadable blueprint ZIP: service scaffolds, Dockerfiles, Kubernetes manifests, OpenAPI and event contracts, gateway routes, ADRs, a draft Terraform scaffold for AWS, Azure or GCP, and a SHA-256 manifest. |
| **Report** | A versioned executive report (cost multiplier, timeline, risk score, per-service dependencies) delivered to the dashboard in real time. |

**Design principles**

- **Evidence over opinion.** Every number comes from the graph or from an assumption you can see and change.
- **Tenant isolation everywhere.** Row Level Security, an ownership guard on every project route, tenant-scoped graph queries, authenticated WebSockets and a shared secret between internal services.
- **Asynchronous by default.** Heavy work runs in a BullMQ worker or an AI-service background task, and progress reaches the UI by polling plus WebSockets.
- **Graceful degradation.** The LLM falls back from OpenRouter to Gemini, report sections degrade to "unavailable" instead of failing, and Neo4j hiccups never fail a report.

### Vision, personas and scope

MonoMELT is designed as an end-to-end transformation workbench rather than a one-off code splitter. This README describes the **whole platform**: what is built today and what is specified for the roadmap. Each capability carries a status.

| Status | Meaning |
| :---: | :--- |
| **Implemented** | Working in this repository |
| **Partial** | Core is built; named parts remain |
| **Planned** | Specified in the PRD, TRD or phase documents; not built yet |

**Who it is for**

| Persona | What they need | Where MonoMELT helps |
| :--- | :--- | :--- |
| **Software architects** | A bird's-eye view of dependencies, bounded contexts and design decisions | Dependency graph, findings, competing scenarios, ADRs |
| **Engineering managers** | Team assignments, delivery risk, velocity impact | Team ownership map, capacity warnings, staged roadmap |
| **DevOps / SRE engineers** | Deployment topology, infrastructure cost, reliability | Kubernetes and Docker templates, Terraform scaffold, cost and latency model |
| **CTOs and technical leadership** | ROI, cost projection, strategic alignment | Executive report, cost multiplier, timeline, risk score, Notion export |

**Capability matrix (PRD and TRD scope)**

| Capability | Status | Notes |
| :--- | :---: | :--- |
| ZIP and public GitHub ingestion with archive hardening | **Implemented** | Zip-slip, symlink, bomb and size protections |
| Private GitHub repositories via OAuth, pinned to a commit SHA | **Planned** | Short-lived encrypted server-side credential, shallow clone without hooks |
| AST parsing of Python, JavaScript, TypeScript | **Implemented** | JS/TS use tolerant regex extraction rather than a full compiler |
| More languages (Java, Go, C#) | **Planned** | Catalogued today, parsed once fixtures and parser pinning exist |
| Dependency graph in Neo4j with resolved File to File edges | **Implemented** | Tenant-scoped, indexed, idempotent |
| Call graph and data-flow tracking across functions | **Planned** | Edge types `CALLS`, `READS`, `WRITES`, `QUERIES` are already modelled |
| Transactional-boundary and database-schema coupling detection | **Planned** | Shared-table writers become distributed-transaction candidates |
| Code metrics: fan-in/out, cycles, components, unresolved imports | **Implemented** | Plus parser diagnostics |
| LLM findings (domain, risk, sensitivity) with human review | **Implemented** | OpenRouter with Gemini fallback |
| Prompt versioning, evaluation fixtures, secret redaction before prompts | **Planned** | Phase 4 safety and evaluation requirements |
| Vector retrieval and pattern comparison (Pinecone) | **Planned** | Client scaffolded, embeddings not wired |
| Conservative, aggressive and domain-driven decomposition | **Implemented** | Louvain and package-structure grouping |
| Team-driven decomposition | **Planned** | Boundaries shaped by team capacity and ownership |
| Scenario validations: cycles, call-chain depth, shared tables, PII flows | **Planned** | Cohesion and coupling per service are implemented |
| Interactive boundary editing (drag and drop) | **Partial** | Revision API implemented, drag-and-drop UI planned |
| Migration roadmap, consistency matrix, team ownership | **Implemented** | Coupling-ordered stages, recalculable revisions |
| Saga, outbox and CQRS recommendations | **Partial** | Saga, outbox and direct today; event sourcing and CQRS selection per workload planned |
| Cost projection and ROI report | **Partial** | Parametric model implemented; versioned provider price catalogs and a full ROI statement planned |
| Performance simulator and caching recommendations | **Partial** | Hop-based latency delta implemented; per-workflow simulation planned |
| Blueprint export: services, Docker, Kubernetes, OpenAPI, events, gateway routes, ADR, Terraform | **Implemented** | Draft templates with secret placeholders |
| Database schema artifacts per service | **Planned** | Listed in the PRD export set |
| Signed, short-lived export URLs | **Planned** | Packages are regenerated on demand today |
| Deployment simulation | **Implemented** | Simulated stages; nothing is provisioned |
| Versioned executive report with real-time delivery | **Implemented** | Postgres, Redis pub/sub, WebSockets |
| Notion export through the Model Context Protocol | **Planned** | Fully specified in `phase-v2/Phase6_v2.md` |
| Authentication, project ownership, RLS, authenticated sockets | **Implemented** | Supabase Auth with GitHub as the first provider |
| Role-based access and shared workspaces | **Planned** | Ownership is single-user today |
| Rate limiting and per-tenant quotas | **Planned** | Required by the TRD gateway responsibilities |
| Job cancellation, dead-letter queue, queue metrics | **Planned** | Retries with exponential backoff are implemented |
| CI/CD with GitHub Actions | **Planned** | Lint, test and deploy pipeline |
| WCAG 2.2 AA pass, route-level code splitting, graph collapsing above 10,000 entities | **Planned** | Phase 8 experience requirements |

**Success targets (from the PRD)**

| Metric | Target |
| :--- | :--- |
| Time to blueprint | Under 15 minutes from upload to a complete package |
| Dependency accuracy | More than 95% of codebase dependencies reflected in the graph |
| Engagement | Users can adjust boundaries and export without friction |

**The transformation journey**

```mermaid
journey
    title From monolith to blueprint
    section Ingest
      Upload ZIP or GitHub URL: 5: Architect
      Track ingestion and analysis: 4: Architect
    section Understand
      Review metrics and dependency graph: 5: Architect
      Approve or reject AI findings: 4: Architect
    section Decide
      Compare decomposition scenarios: 5: Architect, Manager
      Fine-tune service boundaries: 3: Architect
    section Plan
      Set assumptions and recalculate: 4: Manager, SRE
      Review roadmap, cost and ownership: 5: Manager, CTO
    section Deliver
      Export blueprint and preview files: 5: SRE
      Simulate deployment: 4: SRE
      Read the executive report: 5: CTO
      Share to Notion: 3: CTO
```

---

## 2. Product tour

<div align="center">

![Backend data flow](Images/MonoMelt%20Backend.png)

*Backend data flow*

</div>

The interface is a dark, terminal-inspired workspace that walks a project through the pipeline.

| | |
| :---: | :---: |
| ![Dependency graph and metrics](Images/1.png) | ![Decomposition scenario coloured by service](Images/4.png) |
| **Analysis:** code metrics and the interactive Neo4j dependency graph | **Decomposition:** proposed services, each in its own colour |
| ![AI findings with approve and reject](Images/5.png) | ![Migration planning with revision history](Images/7.png) |
| **Intelligence:** LLM findings with confidence and human review | **Planning:** assumptions and immutable revisions |
| ![Migration roadmap](Images/8.png) | ![Cost, team ownership and consistency matrix](Images/9.png) |
| **Roadmap:** staged strangler-fig execution sequence | **Impact:** cost model, team map, consistency controls |

> These screenshots were captured on an earlier build. Service names are now derived from package structure (for example `billing-service`) instead of `Service_N`, roadmap stages are ordered by real coupling, and the export page shows real generated files.

---

## 3. Technology stack

**Frontend**

<img src="https://img.shields.io/badge/React%2019-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" /> <img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" /> <img src="https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white" /> <img src="https://img.shields.io/badge/Tailwind%20CSS%20v4-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" /> <img src="https://img.shields.io/badge/React%20Router%207-CA4245?style=for-the-badge&logo=react-router&logoColor=white" /> <img src="https://img.shields.io/badge/TanStack%20Query-FF4154?style=for-the-badge&logo=react-query&logoColor=white" /> <img src="https://img.shields.io/badge/Zustand-433E38?style=for-the-badge" /> <img src="https://img.shields.io/badge/Recharts-22B5BF?style=for-the-badge" /> <img src="https://img.shields.io/badge/Framer%20Motion-0055FF?style=for-the-badge&logo=framer&logoColor=white" /> <img src="https://img.shields.io/badge/Socket.IO%20Client-010101?style=for-the-badge&logo=socket.io&logoColor=white" /> <img src="https://img.shields.io/badge/Axios-5A29E4?style=for-the-badge&logo=axios&logoColor=white" /> <img src="https://img.shields.io/badge/ESLint-4B32C3?style=for-the-badge&logo=eslint&logoColor=white" />

Graph rendering uses `react-force-graph-2d`; icons come from `lucide-react`; smooth scrolling from `lenis`.

**API gateway and worker**

<img src="https://img.shields.io/badge/Node.js%2022-43853D?style=for-the-badge&logo=node.js&logoColor=white" /> <img src="https://img.shields.io/badge/Express%205-404D59?style=for-the-badge&logo=express&logoColor=white" /> <img src="https://img.shields.io/badge/Socket.IO-010101?style=for-the-badge&logo=socket.io&logoColor=white" /> <img src="https://img.shields.io/badge/BullMQ-FF4B4B?style=for-the-badge" /> <img src="https://img.shields.io/badge/ioredis-DC382D?style=for-the-badge&logo=redis&logoColor=white" /> <img src="https://img.shields.io/badge/Swagger%20%2F%20OpenAPI-85EA2D?style=for-the-badge&logo=swagger&logoColor=black" /> <img src="https://img.shields.io/badge/Multer-FF6F00?style=for-the-badge" /> <img src="https://img.shields.io/badge/Archiver-2C3E50?style=for-the-badge" /> <img src="https://img.shields.io/badge/AdmZip-6C757D?style=for-the-badge" /> <img src="https://img.shields.io/badge/node%3Atest-339933?style=for-the-badge&logo=node.js&logoColor=white" />

**AI service**

<img src="https://img.shields.io/badge/Python%203.11+-3776AB?style=for-the-badge&logo=python&logoColor=white" /> <img src="https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white" /> <img src="https://img.shields.io/badge/Pydantic%20v2-E92063?style=for-the-badge&logo=pydantic&logoColor=white" /> <img src="https://img.shields.io/badge/Uvicorn-499848?style=for-the-badge&logo=gunicorn&logoColor=white" /> <img src="https://img.shields.io/badge/NetworkX-4B8BBE?style=for-the-badge" /> <img src="https://img.shields.io/badge/python--louvain-FFD43B?style=for-the-badge&logo=python&logoColor=black" /> <img src="https://img.shields.io/badge/asyncpg-336791?style=for-the-badge&logo=postgresql&logoColor=white" /> <img src="https://img.shields.io/badge/neo4j%20driver-018bff?style=for-the-badge&logo=neo4j&logoColor=white" /> <img src="https://img.shields.io/badge/redis--py-DC382D?style=for-the-badge&logo=redis&logoColor=white" />

**Data, auth and storage**

<img src="https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white" /> <img src="https://img.shields.io/badge/PostgreSQL-336791?style=for-the-badge&logo=postgresql&logoColor=white" /> <img src="https://img.shields.io/badge/Neo4j%20Aura-018bff?style=for-the-badge&logo=neo4j&logoColor=white" /> <img src="https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white" /> <img src="https://img.shields.io/badge/Pinecone%20(reserved)-000000?style=for-the-badge&logo=pinecone&logoColor=white" />

**AI providers**

<img src="https://img.shields.io/badge/OpenRouter%20(primary)-000000?style=for-the-badge" /> <img src="https://img.shields.io/badge/Google%20Gemini%20(fallback)-8E75B2?style=for-the-badge&logo=googlegemini&logoColor=white" />

**Generated artifacts and tooling**

<img src="https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white" /> <img src="https://img.shields.io/badge/Kubernetes-326CE5?style=for-the-badge&logo=kubernetes&logoColor=white" /> <img src="https://img.shields.io/badge/Terraform-844FBA?style=for-the-badge&logo=terraform&logoColor=white" /> <img src="https://img.shields.io/badge/OpenAPI-6BA539?style=for-the-badge&logo=openapiinitiative&logoColor=white" /> <img src="https://img.shields.io/badge/GitHub-181717?style=for-the-badge&logo=github&logoColor=white" /> <img src="https://img.shields.io/badge/Docker%20Compose-2496ED?style=for-the-badge&logo=docker&logoColor=white" />

| Layer | Technologies | Role |
| :--- | :--- | :--- |
| Frontend | React 19, TypeScript, Vite, Tailwind v4, TanStack Query, Zustand | Workspace UI, graph and chart visualisation, real-time updates |
| Gateway | Express 5, Supabase JS, BullMQ, Socket.io, Swagger | Authentication, project guard, orchestration, queues, WebSockets, API docs |
| Worker | BullMQ, adm-zip, Supabase JS | Archive validation and extraction, source storage, manifest, analysis trigger |
| AI service | FastAPI, Pydantic, NetworkX, python-louvain, asyncpg | Parsing, graph building, clustering, planning, blueprints, reports |
| Datastores | Supabase Postgres, Neo4j Aura, Redis | Relational state, dependency graph, queues and pub/sub |
| LLM | OpenRouter, Google Gemini | Findings and executive summaries, with automatic fallback |

---

## 4. System architecture

```mermaid
flowchart TB
    subgraph Client["Browser"]
        SPA["React SPA<br/>Vite, Tailwind, TanStack Query"]
    end

    subgraph Edge["API layer"]
        GW["API Gateway<br/>Express 5 :4000<br/>JWT auth, project guard, Swagger"]
        WS["Socket.io server<br/>authenticated rooms per project"]
    end

    subgraph Async["Asynchronous layer"]
        Q[("Redis<br/>BullMQ queues + pub/sub")]
        WK["Ingestion Worker<br/>Node.js"]
    end

    subgraph Brain["Intelligence layer"]
        AI["AI Service<br/>FastAPI :8000<br/>internal key required"]
        AG["Agents<br/>parser, graph, intelligence,<br/>decomposition, planning,<br/>blueprint, report"]
    end

    subgraph Data["Data layer"]
        PG[("Supabase Postgres<br/>RLS, 9 migrations")]
        ST[("Supabase Storage<br/>private source bucket")]
        N4[("Neo4j Aura<br/>dependency graph")]
    end

    subgraph LLM["Language models"]
        OR["OpenRouter"]
        GM["Google Gemini<br/>fallback"]
    end

    subgraph Planned["Planned integrations"]
        VDB[("Pinecone<br/>vector retrieval")]
        MCP["Notion MCP server"]
        NT["Notion workspace"]
        GHO["GitHub OAuth<br/>private repositories"]
    end

    AUTH["Supabase Auth<br/>JWT"]

    SPA -->|"REST + Bearer token"| GW
    SPA <-->|"report_completed events"| WS
    SPA -.->|"sign in"| AUTH
    GW --- WS
    GW -->|"verify token"| AUTH
    GW -->|"enqueue ingestion and report jobs"| Q
    GW -->|"proxy with X-Internal-Key"| AI
    GW <-->|"scoped reads and writes"| PG
    Q --> WK
    WK -->|"store files"| ST
    WK -->|"manifest, job status"| PG
    WK -->|"trigger analysis"| AI
    AI --> AG
    AG <-->|"asyncpg"| PG
    AG <-->|"Cypher"| N4
    AG -->|"download source"| ST
    AG -->|"prompts"| OR
    OR -.->|"on failure"| GM
    AG -->|"publish report-updates"| Q
    Q -->|"subscribe"| WS
    AG -.->|"embeddings, pattern search"| VDB
    GW -.->|"export report"| MCP
    MCP -.-> NT
    WK -.->|"private clone"| GHO
```

Dashed edges and the **Planned integrations** group are specified but not yet built.

### Service responsibilities

| Service | Port | Owns | Never does |
| :--- | :---: | :--- | :--- |
| **frontend** | 5173 | Rendering, client state, polling and socket subscription | Talk to the AI service or write to protected tables |
| **api-gateway** | 4000 | Auth, ownership checks, request validation, queueing, WebSocket relay, Swagger | Heavy computation |
| **worker** | none | Archive extraction, source storage, manifest, analysis trigger | Serve HTTP |
| **ai-service** | 8000 | Parsing, graph, metrics, LLM calls, clustering, planning, blueprints, reports | Authenticate end users (the gateway does) |
| **redis** | 6380 (host) | BullMQ queues `ingestion` and `report-generation`, pub/sub channel `report-updates` | Store durable state |
| **Pinecone** (planned) | managed | Tenant-filtered embeddings for retrieval and pattern comparison | Act as a source of truth, the graph stays authoritative |
| **Notion MCP server** (planned) | 3001 | Translating report blocks into Notion pages | Hold user data beyond the export |

### Backend data flow

![Backend data flow](Images/MonoMelt%20Backend.png)

---

## 5. End-to-end pipeline

```mermaid
sequenceDiagram
    autonumber
    actor U as User
    participant FE as React SPA
    participant GW as API Gateway
    participant Q as Redis (BullMQ)
    participant WK as Worker
    participant ST as Supabase Storage
    participant PG as Postgres
    participant AI as AI Service
    participant N4 as Neo4j
    participant LLM as OpenRouter / Gemini

    U->>FE: Upload ZIP or paste GitHub URL
    FE->>GW: POST /projects/:id/sources/zip or /github
    GW->>GW: Verify JWT, project ownership, ZIP magic bytes or GitHub URL
    GW->>PG: Insert source_version and analysis_job (queued)
    GW->>Q: Enqueue ingestion job (5s timeout, 503 if queue down)
    GW-->>FE: 202 jobId, sourceVersionId

    Q->>WK: Deliver job
    WK->>ST: Download archive (GitHub: codeload, size capped)
    WK->>WK: Reject traversal, symlinks, oversize, deep paths
    WK->>ST: Upload source files (bounded concurrency)
    WK->>PG: Write source_files manifest (batched)
    WK->>AI: POST /analysis/trigger (X-Internal-Key)

    AI->>ST: Download source files in parallel
    AI->>AI: Parse AST, resolve imports, save diagnostics
    AI->>N4: Write File, Symbol, ExternalDependency nodes and IMPORTS edges
    AI->>N4: Query graph metrics
    AI->>PG: Store code_metrics, mark job completed
    FE->>GW: Poll job and metrics, load graph
    GW-->>FE: Metrics, paginated graph, diagnostics

    U->>FE: Run AI intelligence
    FE->>GW: POST /intelligence/trigger
    GW->>AI: Trigger (ownership verified)
    AI->>N4: Tenant-scoped file graph
    AI->>LLM: Structured prompt
    AI->>PG: Store ai_findings (pending review)
    U->>FE: Approve or reject findings

    U->>FE: Generate decomposition scenario
    FE->>GW: POST /scenarios (strategy)
    GW->>PG: Insert scenario (generating)
    GW->>AI: POST /decomposition/generate
    AI->>N4: Load File graph
    AI->>AI: Cluster, fold isolated files, name services
    AI->>PG: Scenario revision and proposed services

    U->>FE: Create migration plan
    FE->>GW: POST /scenarios/:id/plans
    GW->>PG: Load real proposed services
    GW->>AI: POST /api/planning/generate
    GW->>PG: Store plan and immutable revision

    U->>FE: Generate blueprint
    FE->>GW: POST /blueprints
    GW->>AI: POST /api/blueprints/generate
    AI-->>GW: Manifest, ZIP, file previews
    GW->>PG: Store blueprint record
    GW-)Q: Enqueue report job (not awaited)
    GW-->>FE: Blueprint with file previews

    Q->>WK: Report job
    WK->>AI: POST /api/reports/generate (202)
    AI->>PG: Aggregate plan, services, costs
    AI->>N4: Cross-service dependencies (best effort)
    AI->>LLM: Executive summary
    AI->>PG: project_reports vN completed
    AI->>Q: PUBLISH report-updates
    Q->>GW: Subscriber message
    GW-->>FE: Socket event report_completed
    FE->>GW: GET /reports
    GW-->>FE: Report payload
```

### Job and run lifecycles

```mermaid
stateDiagram-v2
    direction LR
    state "analysis_jobs.status" as Job {
        [*] --> queued
        queued --> ingesting: worker picks up
        ingesting --> ready: manifest saved
        ready --> analyzing: AI run starts
        analyzing --> completed
        queued --> failed
        ingesting --> failed
        analyzing --> failed
    }
```

```mermaid
stateDiagram-v2
    direction LR
    [*] --> generating: scenario created
    generating --> completed: services saved
    generating --> failed: no graph or engine error
    completed --> [*]
    failed --> [*]
```

```mermaid
stateDiagram-v2
    direction LR
    [*] --> pending: report row requested
    pending --> generating: AI service starts
    generating --> completed: payload saved, event published
    generating --> failed: error saved to payload
    failed --> generating: Retry creates a new version
    completed --> generating: Regenerate creates a new version
```

---

## 6. The six intelligence agents

![Agent flow](Images/agent_flow.png)

```mermaid
flowchart LR
    SRC(["Source code"]) --> A1

    A1["1. Analysis Agent<br/>ast_parser, import_resolver,<br/>graph_builder, metrics_calculator"]
    A2["2. Intelligence Agent<br/>enrichment.py + llm_provider.py"]
    A3["3. Decomposition Agent<br/>decomposition_engine.py"]
    A4["4. Planning Agent<br/>planning_engine.py"]
    A5["5. Blueprint Agent<br/>blueprint_generator.py"]
    A6["6. Report Agent<br/>report_generator.py"]

    A1 -->|"File, Symbol, IMPORTS graph"| A2
    A1 -->|"File to File import graph"| A3
    A2 -.->|"findings (human reviewed)"| A3
    A3 -->|"proposed services"| A4
    A4 -->|"roadmap, costs, teams, risks"| A5
    A3 --> A5
    A4 --> A6
    A3 --> A6
    A5 -->|"triggers"| A6
    A6 --> OUT(["Executive report<br/>+ dashboard + WebSocket event"])

    A1 -.- N[("Neo4j")]
    A3 -.- N
    A6 -.- N
    A2 -.- L(["LLM"])
    A6 -.- L
```

| # | Agent | Module | Input | Output | Storage |
| :-: | :--- | :--- | :--- | :--- | :--- |
| 1 | **Analysis** | `ast_parser.py`, `import_resolver.py`, `graph_builder.py`, `metrics_calculator.py` | Source files | Resolved dependency graph, metrics, diagnostics | Neo4j, `code_metrics`, `parser_diagnostics` |
| 2 | **Intelligence** | `enrichment.py`, `llm_provider.py` | Most-connected files from the graph | Domain, risk and sensitivity findings with confidence | `ai_findings` |
| 3 | **Decomposition** | `decomposition_engine.py` | File import graph | Service boundaries per strategy, cohesion and coupling | `decomposition_scenarios`, `scenario_revisions`, `proposed_services` |
| 4 | **Planning** | `planning_engine.py` | Proposed services and assumptions | Roadmap, consistency matrix, cost and latency model, team map | `migration_plans`, `plan_revisions` |
| 5 | **Blueprint** | `blueprint_generator.py` | Services, plan revision | ZIP of manifests, contracts, scaffolds, Terraform | `blueprints` (package regenerated deterministically) |
| 6 | **Report** | `report_generator.py` | Everything above | Versioned executive report | `project_reports` |

---

## 7. Engine deep dives

### 7.1 Ingestion (worker)

```mermaid
flowchart TD
    J["Ingestion job"] --> T{"Source type"}
    T -->|zip| DL["Download archive from storage"]
    T -->|github| GH["Validate owner and repo,<br/>fetch codeload.github.com zip<br/>120s timeout, size cap"]
    GH --> UP0["Store archive in storage"] --> DL
    DL --> CNT{"Entry count within<br/>MAX_SOURCE_FILES?"}
    CNT -->|no| FAIL["Fail job with reason"]
    CNT -->|yes| LOOP["For each entry"]
    LOOP --> SAFE{"Safe path?<br/>no .., no absolute,<br/>no symlink, depth up to 32"}
    SAFE -->|no| SKIP["Skip entry"]
    SAFE -->|yes| LIM{"Within per-file and<br/>total extraction limits?"}
    LIM -->|no| FAIL
    LIM -->|yes| CLS{"Source file?<br/>py js ts java go cs c cpp rb php<br/>not node_modules, dist, build, vendor"}
    CLS -->|yes| QUEUE["Queue for upload<br/>status included"]
    CLS -->|no| EXC["Manifest only<br/>status excluded"]
    QUEUE --> UPL["Upload with bounded concurrency"]
    EXC --> MAN
    UPL --> MAN["Insert manifest in batches of 500"]
    MAN --> RDY["Job status ready"]
    RDY --> TRG["POST /analysis/trigger"]
```

### 7.2 Analysis and import resolution

The parser knows only the module *name* in an import. The resolver maps it onto an uploaded file, which is what turns a pile of isolated files into a graph.

```mermaid
flowchart TD
    A["Manifest + source files"] --> B["Download in parallel threads"]
    B --> C["Parse<br/>Python: stdlib ast<br/>JS/TS: tolerant regexes"]
    C --> D["Symbols<br/>class, function, method<br/>each keyed by start line"]
    C --> E["Imports<br/>relative level, imported names,<br/>multi-line, re-export, dynamic, require"]
    E --> R["Import resolver"]
    R --> G["Graph builder<br/>indexed labelled MERGE"]
    D --> G
    G --> M["Metrics<br/>fan-in, fan-out, SCC cycles,<br/>weak components"]
    C --> DG["Parser diagnostics saved"]
    M --> OUT["code_metrics + job completed"]
```

```mermaid
flowchart TD
    I["Import: target module + names"] --> L{"Language"}
    L -->|Python| P1{"Relative?<br/>leading dots"}
    P1 -->|yes| P2["Walk up N-1 directories,<br/>try name.py and name/__init__.py,<br/>then each imported name as a module"]
    P1 -->|no| P3{"Top-level package in<br/>sys.stdlib_module_names?"}
    P3 -->|yes| EXT
    P3 -->|no| P4["Suffix match against repo paths<br/>(works under repo-main/ wrappers),<br/>prefer nearest directory"]
    L -->|JS or TS| J1{"Starts with . or /?"}
    J1 -->|no| EXT["External dependency<br/>stdlib or package"]
    J1 -->|yes| J2["Try exact, + .js .jsx .ts .tsx .mjs .cjs,<br/>/index.*, and .js to .ts ESM rewrite"]
    P2 --> RES{"Found?"}
    P4 --> RES
    J2 --> RES
    RES -->|yes| INT["File to File IMPORTS edge"]
    RES -->|"no, local import"| UNR["Unresolved import<br/>counted in metrics"]
```

**Graph schema (Neo4j).** Every node carries `owner_id`, `project_id` and `source_version_id`, and every query filters on all three.

```mermaid
flowchart LR
    F1["(:File)<br/>node_id, file_path, language,<br/>lines_of_code, num_symbols"]
    F2["(:File)"]
    S["(:Symbol)<br/>name, symbol_type,<br/>start_line, end_line"]
    X["(:ExternalDependency)<br/>name"]
    F1 -->|"CONTAINS"| S
    F1 -->|"IMPORTS (internal)"| F2
    F1 -->|"IMPORTS (package, stdlib, unresolved)"| X
```

Metric definitions:

| Metric | Definition |
| :--- | :--- |
| Fan-in / fan-out | Files that import a file / files (and packages) it imports, top 10 each |
| Cycle count | Strongly connected components with more than one file, plus self-imports |
| Graph components | Weakly connected components of the file graph |
| Unresolved imports | Local-looking imports that matched no uploaded file |
| Centrality candidates | Files with both high fan-in and fan-out, likely boundary hints |

### 7.3 Decomposition

```mermaid
flowchart TD
    S["Scenario requested<br/>strategy_type"] --> V{"Scenario row exists for<br/>owner, project, source version?"}
    V -->|no| R404["404"]
    V -->|yes| LG["Load tenant-scoped File graph<br/>File to File edges only,<br/>symbols attached to their file"]
    LG --> ST{"Strategy"}
    ST -->|conservative| L1["Louvain, resolution 0.5"]
    ST -->|default| L2["Louvain, resolution 1.0"]
    ST -->|aggressive| L3["Louvain, resolution 2.0"]
    ST -->|domain| DIR["Group by first meaningful directory<br/>after stripping shared prefix and<br/>generic folders src, app, lib"]
    L1 --> FO
    L2 --> FO
    L3 --> FO
    DIR --> FO["Fold files with no internal imports<br/>into one shared-utilities service"]
    FO --> NM["Name services from their package<br/>billing-service, users-service<br/>DNS-safe and unique"]
    NM --> MT["Metrics per service<br/>file_count, node_count,<br/>internal_edges, external_edges_out"]
    MT --> SV["Save revision and services<br/>scenario completed"]
```

External packages are deliberately excluded from clustering: a package such as `react` is imported everywhere and would otherwise glue unrelated files into one giant service.

### 7.4 Planning

Services are ordered by outgoing cross-service coupling. The least coupled are extracted first and the most coupled last, and each real service appears in exactly one stage.

```mermaid
flowchart LR
    S1["Stage 1<br/>Preparation and foundation<br/>gateway, registry, CI/CD"] --> S2["Stage 2<br/>Low-risk extraction<br/>least coupled half"]
    S2 --> S3["Stage 3<br/>Core domain extraction<br/>moderately coupled<br/>outbox patterns"]
    S3 --> S4["Stage 4<br/>High-coupling and database split<br/>most coupled quarter<br/>blue-green"]
    S4 --> S5["Stage 5<br/>Stabilisation and<br/>monolith retirement"]
```

Empty stages are dropped rather than filled with placeholders, and the planner refuses to run without real services (HTTP 422). Each plan stores `assumptions`, `roadmap`, `consistency_security`, `cost_performance` and `team_mapping`. Recalculating with new assumptions appends a new immutable revision.

| Assumption | Range | Effect |
| :--- | :--- | :--- |
| `cloud_provider` | aws, azure, gcp | Pricing factor, Terraform provider |
| `pricing_region` | free text | Region in Terraform and cost drivers |
| `cost_multiplier` | 0.5 to 3.0 | Scales monolith and per-service cost |
| `team_count` | 1 to 20 | Round-robin ownership and capacity warnings |
| `risk_tolerance` | low, medium, high | Selects `modular_monolith` for large service counts at low tolerance |
| `migration_window_months` | 1 to 36 | Target window recorded with the plan |

### 7.5 Blueprint

```mermaid
flowchart TD
    REQ["Services + plan revision"] --> CHK{"At least one service?"}
    CHK -->|no| E422["422"]
    CHK -->|yes| SLUG["Reduce each name to a unique<br/>DNS-1123 label"]
    SLUG --> PER["Per service<br/>package.json, src/server.js,<br/>Dockerfile, k8s deployment, k8s service"]
    SLUG --> SH["Shared<br/>README, ADR-001, OpenAPI,<br/>event contracts, gateway routes,<br/>secret template, migration guide,<br/>cost report, Terraform main.tf"]
    PER --> VAL
    SH --> VAL["Compute validation<br/>openapi paths, DNS-safe k8s names,<br/>credential pattern scan"]
    VAL --> ZIP["ZIP + manifest.json<br/>SHA-256 per artifact"]
    ZIP --> OUT["Response: manifest, base64 ZIP,<br/>file contents for preview"]
```

Names are sanitised because they end up in archive paths, Kubernetes object names, hostnames and generated JavaScript. A user-edited name such as `../../x` cannot escape the archive. Packages are regenerated on demand and are deterministic, so the preview and download always match.

### 7.6 Report

```mermaid
flowchart TD
    G["POST /api/reports/generate"] --> V["Next version_number<br/>unique(project_id, version_number)"]
    V --> I["Insert row: generating"]
    I --> F{"Fan-out in parallel threads"}
    F --> P1["Plan revision:<br/>cost, risk, roadmap, teams"]
    F --> P2["Latest scenario revision<br/>and proposed services"]
    P1 --> M
    P2 --> M["Map to report schema"]
    P2 --> D["Neo4j: IMPORTS between files of<br/>different services (best effort)"]
    D --> M
    M --> LLM["LLM executive summary<br/>fallback text on failure"]
    LLM --> S["Persist payload: completed"]
    S --> PUB["Publish report-updates"]
    G -. "any error" .-> FL["Row failed with error<br/>event published"]
```

| Report field | Source |
| :--- | :--- |
| `total_services_extracted` | Proposed services in the latest scenario |
| `estimated_timeline_months` | Plan roadmap `total_duration_weeks` converted to months |
| `overall_risk_score` | Share of sensitive or encrypted boundaries: HIGH above 40%, MEDIUM above 15%, otherwise LOW |
| `cost_analysis` | Monolith vs microservice monthly cost, multiplier, range and latency delta |
| `risk_assessment` | Critical paths, consistency flags and mitigations (including single-team warnings) |
| `decomposition_strategy[].dependencies` | IMPORTS edges between the files of different services |

### 7.7 Real-time delivery

```mermaid
sequenceDiagram
    participant AI as AI Service
    participant R as Redis
    participant GW as Gateway Socket.io
    participant FE as Browser

    FE->>GW: connect with Supabase access token
    GW->>GW: verify token with Supabase Auth
    FE->>GW: join_project(projectId)
    GW->>GW: confirm the user owns the project
    GW-->>FE: ack ok
    AI->>R: PUBLISH report-updates {project_id, status, version}
    R-->>GW: message
    GW-->>FE: report_completed to that project's room only
    FE->>FE: invalidate report query and refetch
    Note over FE: 3 second polling stays as a fallback
```

### 7.8 Notion export through MCP (planned)

Specified in `phase-v2/Phase6_v2.md`. The gateway translates the finished report into Notion blocks and hands them to a Notion Model Context Protocol server, which owns the Notion API details.

```mermaid
sequenceDiagram
    actor U as User
    participant FE as Report page
    participant GW as API Gateway
    participant PG as Postgres
    participant MCP as Notion MCP server
    participant NT as Notion API

    U->>FE: Export to Notion
    FE->>GW: POST /reports/:projectId/export-to-notion
    GW->>PG: Load latest completed report (owner scoped)
    alt notion_url already set
        GW-->>FE: 200 existing notion_url (idempotent)
    else first export
        GW->>GW: notion.util builds blocks
        GW->>MCP: Create page under NOTION_DATABASE_ID
        MCP->>NT: Append blocks
        NT-->>MCP: Page URL
        MCP-->>GW: Page URL
        GW->>PG: Save notion_url on the report row
        GW-->>FE: 200 notion_url
    end
    Note over GW,MCP: 429 responses retry with exponential backoff, MCP outage returns a handled error and the dashboard keeps working
```

| Report content | Notion block |
| :--- | :--- |
| Title | `heading_1` |
| `executive_summary.business_impact` | `paragraph` |
| Service count and overall risk | `callout` |
| Proposed microservices and dependencies | Heading and bulleted list |
| `cost_analysis.breakdown` | `table` |
| Risk assessment | Headings and lists |
| Interactive dependency graph | Hyperlinked callout back to the MonoMelt analysis page (graphs cannot render in Notion) |

The `notion_url` column already exists on `project_reports` and the frontend already holds the button; the gateway route, translation utility and MCP configuration (`MCP_NOTION_SERVER_URL`, `NOTION_DATABASE_ID`, `NOTION_API_KEY`) are the remaining work.

### 7.9 Semantic retrieval with Pinecone (planned)

Embeddings are meant to *augment* the deterministic graph, never replace it.

```mermaid
flowchart LR
    G[("Neo4j graph")] --> CH["Chunk by module<br/>or subgraph"]
    CH --> EM["Embed<br/>(provider-agnostic)"]
    EM --> V[("Pinecone<br/>metadata: owner, project,<br/>source version")]
    Q1["Findings task"] -->|"similar modules"| V
    Q2["Pattern comparison"] -->|"known microservice patterns"| V
    V --> CTX["Bounded, filtered context"]
    CTX --> L["LLM prompt"]
    D["Project or version deleted"] -->|"purge by metadata"| V
```

Requirements carried from the phase documents: tenant and project metadata on every vector, filters enforced on every query, deletion when a project or source version is removed, and any external reference corpus seeded only from licensed, reviewed sources.

### 7.10 Interactive boundary editing

The revision API is implemented: a user's edit creates a new immutable `scenario_revision` with its own `proposed_services`. The drag-and-drop interface on top of it is planned (`@hello-pangea/dnd` is already a dependency).

```mermaid
flowchart TD
    V["View scenario revision N"] --> M["Drag a file or symbol<br/>to another service (planned UI)"]
    M --> C{"Confirm and validate<br/>cycles, shared tables,<br/>unassigned entities"}
    C -->|"invalid"| W["Show warnings, keep revision N"]
    C -->|"valid"| API["POST /scenarios/:id/revisions"]
    API --> R["Revision N+1 saved<br/>immutable history"]
    R --> P["Plans and blueprints reference a<br/>specific revision"]
```

### 7.11 Scenario validations (planned)

Each scenario should be scored and checked before a user commits to it.

| Validation | Purpose |
| :--- | :--- |
| Direct and indirect service cycles | Avoid deployment-order deadlocks |
| Synchronous call-chain depth | Surface latency hot paths |
| Tables written by several proposed services | Flag shared-data risk and distributed-transaction candidates |
| Cross-boundary authentication and PII flows | Highlight security-sensitive seams |
| Unassigned or duplicated entities, low-confidence boundaries | Catch incomplete or unstable splits |
| Strangler seams and dependency leaf services | Recommend safe first extractions |

---

## 8. Data model

All tables live in Supabase Postgres. Migrations `database/migrations/01` to `09` must be applied in order.

```mermaid
erDiagram
    USERS ||--o{ PROJECTS : owns
    PROJECTS ||--o{ SOURCE_VERSIONS : has
    PROJECTS ||--o{ ANALYSIS_JOBS : tracks
    SOURCE_VERSIONS ||--o{ SOURCE_FILES : catalogues
    SOURCE_VERSIONS ||--o{ ANALYSIS_RUNS : analysed_by
    ANALYSIS_RUNS ||--o{ PARSER_DIAGNOSTICS : reports
    ANALYSIS_RUNS ||--o| CODE_METRICS : produces
    SOURCE_VERSIONS ||--o{ AI_FINDINGS : yields
    SOURCE_VERSIONS ||--o{ DECOMPOSITION_SCENARIOS : clustered_into
    DECOMPOSITION_SCENARIOS ||--o{ SCENARIO_REVISIONS : versioned_as
    SCENARIO_REVISIONS ||--o{ PROPOSED_SERVICES : contains
    PROJECTS ||--o{ MIGRATION_PLANS : plans
    SCENARIO_REVISIONS ||--o{ MIGRATION_PLANS : basis_for
    MIGRATION_PLANS ||--o{ PLAN_REVISIONS : versioned_as
    PLAN_REVISIONS ||--o{ BLUEPRINTS : exported_as
    SCENARIO_REVISIONS ||--o{ BLUEPRINTS : exported_as
    BLUEPRINTS ||--o{ DEPLOYMENTS : deployed_as
    PROJECTS ||--o{ PROJECT_REPORTS : reported_in

    PROJECTS {
        uuid id PK
        uuid owner_id FK
        text name
        text source_type
        text status
    }
    SOURCE_VERSIONS {
        uuid id PK
        uuid project_id FK
        text source_type
        jsonb metadata
    }
    ANALYSIS_JOBS {
        uuid id PK
        uuid project_id FK
        uuid source_version_id FK
        text status
        text error_code
    }
    SOURCE_FILES {
        uuid id PK
        uuid source_version_id FK
        text file_path
        text language
        text status
        text content_hash
    }
    ANALYSIS_RUNS {
        uuid id PK
        uuid project_id FK
        uuid source_version_id FK
        uuid owner_id
        text status
        jsonb graph_summary
    }
    CODE_METRICS {
        uuid id PK
        uuid analysis_run_id FK
        int total_files
        int cycle_count
        int graph_components
        int unresolved_imports
        jsonb top_fan_in
        jsonb top_fan_out
    }
    PARSER_DIAGNOSTICS {
        uuid id PK
        uuid analysis_run_id FK
        text file_path
        text severity
        text message
    }
    AI_FINDINGS {
        uuid id PK
        uuid project_id FK
        uuid source_version_id FK
        uuid owner_id
        text finding_type
        float confidence
        text review_status
    }
    DECOMPOSITION_SCENARIOS {
        uuid id PK
        uuid project_id FK
        uuid source_version_id FK
        uuid owner_id
        text strategy_type
        text status
    }
    SCENARIO_REVISIONS {
        uuid id PK
        uuid scenario_id FK
        int revision_number
        jsonb metrics
    }
    PROPOSED_SERVICES {
        uuid id PK
        uuid revision_id FK
        text name
        jsonb assigned_nodes
        jsonb metrics
    }
    MIGRATION_PLANS {
        uuid id PK
        uuid project_id FK
        uuid scenario_revision_id FK
        uuid owner_id
        text status
    }
    PLAN_REVISIONS {
        uuid id PK
        uuid plan_id FK
        int revision_number
        jsonb assumptions
        jsonb roadmap
        jsonb consistency_security
        jsonb cost_performance
        jsonb team_mapping
    }
    BLUEPRINTS {
        uuid id PK
        uuid project_id FK
        uuid scenario_revision_id FK
        uuid plan_revision_id FK
        int version_number
        jsonb manifest
    }
    DEPLOYMENTS {
        uuid id PK
        uuid project_id FK
        uuid blueprint_id FK
        uuid owner_id
        text status
        jsonb logs
    }
    PROJECT_REPORTS {
        uuid id PK
        uuid project_id FK
        uuid owner_id FK
        int version_number
        text status
        jsonb payload
        text notion_url
    }
```

`project_reports` has a `UNIQUE(project_id, version_number)` constraint, so two simultaneous report requests cannot both claim the same version. `profiles` and `audit_events` (migration 01) support user metadata and auditing.

---

## 9. Security model

```mermaid
flowchart TD
    REQ["Request to /api/projects/:projectId/..."] --> A{"Valid Supabase<br/>access token?"}
    A -->|no| R401["401"]
    A -->|yes| B{"projectId is a UUID and<br/>projects.owner_id = user?"}
    B -->|no| R404["404, never reveals existence"]
    B -->|yes| C["Controller<br/>filters child ids by project"]
    C --> D["Gateway to AI service<br/>X-Internal-Key + project_id + owner_id"]
    D --> E{"Key matches?"}
    E -->|no| R401b["401"]
    E -->|yes| F["AI queries<br/>filtered by owner, project, source version"]
    F --> G[("Postgres rows and<br/>Neo4j nodes of this tenant only")]
```

| Control | Where | What it prevents |
| :--- | :--- | :--- |
| Supabase JWT verification | `auth.middleware.js` | Anonymous API access |
| Project ownership guard | `project.middleware.js`, mounted on `/api/projects/:projectId` | Reading or changing another user's project by guessing its id |
| Child-resource checks | Plans, blueprints, decomposition controllers | Passing another project's scenario, plan or revision ids |
| Internal API key | `core/security.py`, gateway and worker clients | Direct, unauthenticated calls to the AI service |
| Restricted CORS | AI service `ALLOWED_ORIGINS`, gateway `FRONTEND_URL` | Cross-origin abuse |
| Tenant-scoped graph | Every Cypher query filters `owner_id`, `project_id`, `source_version_id` | Cross-tenant graph reads |
| Row Level Security | Supabase, migrations 01 to 09 | Direct database access outside the API |
| Authenticated sockets | `socket.js` | Joining another project's real-time room |
| Private source bucket | `storage.service.js` | Public exposure of uploaded code |
| Archive hardening | Worker | Zip slip, symlinks, zip bombs, oversized archives |
| Name sanitisation | Blueprint generator | Path traversal and injection through service names |
| Input validation | GitHub URL and branch regexes, strategy allow-list | Malformed or malicious input |

**Planned hardening**

| Control | Purpose |
| :--- | :--- |
| GitHub OAuth for private repositories with a short-lived, encrypted server-side credential | Private-repo ingestion without exposing tokens |
| Branch resolved to a commit SHA before queueing | Reproducible analysis of an exact revision |
| Gateway rate limiting and per-tenant quotas | Protect LLM spend and shared infrastructure |
| Role-based access and shared workspaces | Team collaboration with least privilege |
| Signed, single-purpose, short-lived export URLs | Private artifact delivery |
| Secret redaction before LLM prompts | Keep credentials out of third-party models |
| Decision audit trail beyond `audit_events` | Traceable approvals and boundary edits |

Notes:

- The service-role key never leaves the backend. The browser only holds the anon key.
- Set `INTERNAL_API_KEY` to the same long random value in the gateway, worker and AI service. When it is empty the AI service logs a warning and accepts unauthenticated calls, which is acceptable for local development only.
- The `openai` storage bucket holds source code. If it already exists as a public bucket, set it to private in the Supabase dashboard.

---

## 10. API reference

All routes except `/health` and `/api-docs` require `Authorization: Bearer <supabase access token>`. Interactive documentation is served at **`/api-docs`** (Swagger UI).

| Area | Method and path | Purpose |
| :--- | :--- | :--- |
| Platform | `GET /health` | Gateway status plus real AI-service and Neo4j state |
| Auth | `GET /api/auth/me` | Current user |
| Projects | `GET /api/projects`, `POST /api/projects`, `GET /api/projects/:id` | List, create, read |
| Sources | `POST /api/projects/:id/sources/zip` | Upload an archive (multipart `file`) |
| | `POST /api/projects/:id/sources/github` | Import `{ repoUrl, branch }` |
| | `GET /api/projects/:id/jobs/:jobId` | Ingestion and analysis job status |
| Analysis | `POST /api/projects/:id/analysis/trigger` | Start analysis for a source version |
| | `GET .../analysis/run/:runId/status` | Run status |
| | `GET .../analysis/:svid/metrics` | Aggregate metrics |
| | `GET .../analysis/:svid/graph?limit=&cursor=` | Paginated graph with real totals |
| | `GET .../analysis/:svid/diagnostics` | Parser warnings and errors |
| Intelligence | `POST .../intelligence/trigger` | Run LLM enrichment |
| | `GET .../intelligence/:svid/findings` | List findings |
| | `POST .../intelligence/findings/:id/review` | Approve, reject or reset |
| Scenarios | `POST .../scenarios` | Create (`conservative`, `aggressive`, `domain`) |
| | `GET .../scenarios`, `GET .../scenarios/:id` | List, read with services |
| | `POST .../scenarios/:id/revisions` | Save manual boundary edits |
| Plans | `POST .../scenarios/:id/plans` | Generate a migration plan |
| | `GET .../plans`, `GET .../plans/:planId` | List, read with revisions |
| | `POST .../plans/:planId/assumptions` | Recalculate as a new revision |
| Blueprints | `POST .../blueprints` | Generate (`{ planId }`) |
| | `GET .../blueprints`, `GET .../blueprints/:id` | List, read |
| | `GET .../blueprints/:id/files` | File contents for preview |
| | `GET .../blueprints/:id/download` | ZIP download |
| Deployments | `POST .../deployments`, `GET .../deployments/:id`, `GET .../deployments/:id/services` | Simulated pipeline and health |
| Reports | `GET .../reports` | Latest report |
| | `POST .../reports/generate` | Queue a new version (409 while one is generating) |

**Planned endpoints**

| Method and path | Purpose |
| :--- | :--- |
| `POST /api/reports/:projectId/export-to-notion` | Idempotent Notion export through MCP (returns `notion_url`) |
| `POST .../scenarios` with `strategy_type: "team"` | Team-driven decomposition |
| `GET .../scenarios/:id/validations` | Scenario validation results |
| `GET .../blueprints/:id/signed-url` | Short-lived private download URL |
| `POST .../jobs/:jobId/cancel` | Cancel a running ingestion or analysis job |
| `GET .../graph/search?q=` | Search and filter large graphs |

**WebSocket events.** Connect to the gateway with `auth: { token }`, emit `join_project(projectId)` and listen for `report_completed`.

**AI service routes** (internal, require `X-Internal-Key`): `POST /analysis/trigger`, `GET /analysis/run/:id/status`, `GET /analysis/:svid/{metrics,graph,diagnostics}`, `POST /intelligence/trigger`, `GET /intelligence/:svid/findings`, `POST /decomposition/generate`, `POST /api/planning/{generate,recalculate}`, `POST /api/blueprints/generate`, `POST /api/reports/generate`, and the public `GET /health`.

**Error shape.** Gateway errors are `{ "success": false, "message": "..." }`. Queue outages return `503`, validation failures `400`, foreign or missing resources `404`.

---

## 11. Frontend

```mermaid
flowchart LR
    L["/ Landing"] --> LG["/login"]
    LG --> CB["/auth/callback"]
    CB --> D["/dashboard<br/>upload, recent workspaces,<br/>service status"]
    D --> AN["/dashboard/projects/:id/analysis<br/>metrics, graph, findings,<br/>decomposition"]
    AN --> PL["/dashboard/projects/:id/planning<br/>assumptions, roadmap, cost,<br/>teams, consistency"]
    PL --> EX["/dashboard/projects/:id/export<br/>file preview, download"]
    EX --> DP["/dashboard/projects/:id/deployment<br/>pipeline simulation, services"]
    EX --> RP["/dashboard/projects/:id/report<br/>executive summary, services,<br/>costs, risk matrix"]
```

All `/dashboard` routes sit behind `ProtectedRoute`.

| Concern | Approach |
| :--- | :--- |
| Server state | TanStack Query (report polling every 3s while pending or generating) |
| Auth state | Zustand store over Supabase Auth; the axios interceptor attaches the access token |
| Real time | `useReportSocket` joins the project room and invalidates the report query on `report_completed` |
| Errors | `getErrorMessage` shows the server's message instead of "status code 500" |
| Graph | `react-force-graph-2d`; links to nodes outside the loaded page are dropped, nodes are coloured by service or symbol type |
| Structure | `pages/` aggregate, `components/<feature>/` render, `features/<area>/*.api.ts` call the API |

---

## 12. Repository layout

```text
MonoMelt/
├── frontend/                 React 19 + TypeScript + Vite + Tailwind v4
│   └── src/{pages,components,features,hooks,lib,stores}
├── api-gateway/              Express 5 (flat layout, feature.type.js naming)
│   ├── routes/ controllers/ services/ middlewares/ config/ docs/ utils/ tests/
│   ├── server.js             entry point
│   └── socket.js             authenticated Socket.io + Redis subscriber
├── worker/                   BullMQ ingestion and report-trigger worker
├── ai-service/               FastAPI
│   ├── api/routes/           thin routers
│   ├── services/             parser, resolver, graph, metrics, engines, LLM, realtime
│   ├── db/                   neo4j_client.py, pg_client.py, pinecone_client.py (reserved)
│   ├── models/               Pydantic schemas and domain classes
│   ├── core/                 settings and internal-key security
│   └── scripts/              offline tests and diagnostics
├── database/migrations/      01 to 09 SQL migrations
├── e2e/                      end-to-end test harness
├── docs/                     original PRD, TRD and phase documents
├── phase-v2/                 Report Agent specification (phases 1 to 6)
├── Output/                   sample generated blueprint
├── Images/                   screenshots and diagrams used in this README
├── docker-compose.yml
├── CLAUDE.md                 contributor and AI-agent conventions
└── .agents/                  architecture rules and skills
```

---

## 13. Getting started

### Prerequisites

| Tool | Version | Notes |
| :--- | :--- | :--- |
| Node.js | 22 recommended (18+) | Gateway, worker, frontend |
| Python | 3.11 or newer | AI service |
| Docker | any recent | Only to run Redis locally |
| Supabase project | n/a | Postgres, Auth and Storage |
| Neo4j Aura (or Neo4j 5) | n/a | `neo4j+s://` or `bolt://` URI |
| LLM key | n/a | OpenRouter and/or Gemini |

### 1. Clone

```bash
git clone https://github.com/Tetra4ge/MonoMelt.git
cd MonoMelt
```

### 2. Database

Run the files in `database/migrations/` **in numeric order** (`01` to `09`) in the Supabase SQL editor. Create a Storage bucket named `openai` and keep it **private**.

### 3. Redis

Redis backs the job queues and the real-time channel. Locally, run it on host port **6380**, which is what the `.env` templates use:

```bash
docker run -d --name monomelt-redis -p 6380:6379 redis:7-alpine
docker exec monomelt-redis redis-cli ping    # PONG
```

Any managed Redis (for example Upstash) works too: set `REDIS_URL` in the gateway, worker and AI service.

### 4. Environment files

Copy each template and fill it in (see [Configuration reference](#14-configuration-reference)):

```bash
cp frontend/.env.example    frontend/.env
cp api-gateway/.env.example api-gateway/.env
cp worker/.env.example      worker/.env
cp ai-service/.env.example  ai-service/.env
```

Use the **same** `INTERNAL_API_KEY` in `api-gateway`, `worker` and `ai-service`, and the same Redis in all three.

### 5. Run the services

Open four terminals:

```bash
# AI service  ->  http://localhost:8000   (docs at /docs)
cd ai-service
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# API gateway  ->  http://localhost:4000   (Swagger at /api-docs)
cd api-gateway && npm install && npm run dev

# Worker
cd worker && npm install && npm run dev

# Frontend  ->  http://localhost:5173
cd frontend && npm install && npm run dev
```

`docker-compose.yml` can also start the stack, but it is optional; the commands above are the supported development path.

### 6. Verify

```bash
curl http://localhost:4000/health
# {"success":true,"service":"api-gateway","status":"up",
#  "services":{"ai-service":"up","neo4j":"connected"}, ...}
```

Then sign in, create a workspace, upload a ZIP or paste a public GitHub URL, and follow the pipeline from analysis through the report.

---

## 14. Configuration reference

**`api-gateway/.env`**

| Variable | Required | Description |
| :--- | :---: | :--- |
| `PORT` | | Default `4000` |
| `FRONTEND_URL` | | Allowed browser origin(s), comma separated |
| `SUPABASE_URL`, `SUPABASE_JWT_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL` | yes | Supabase connection |
| `REDIS_URL` | yes | BullMQ and pub/sub |
| `AI_SERVICE_URL` or `AI_SERVICE_DEV_URL` / `AI_SERVICE_PRO_URL` | | AI service base URL |
| `INTERNAL_API_KEY` | prod | Shared secret sent as `X-Internal-Key` |
| `MAX_UPLOAD_BYTES` | | ZIP upload cap, default 50 MB |
| `QUEUE_TIMEOUT_MS` | | Queue enqueue timeout, default 5000 |

**`worker/.env`**

| Variable | Description |
| :--- | :--- |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Supabase connection |
| `REDIS_URL` | Same Redis as the gateway |
| `AI_SERVICE_URL`, `INTERNAL_API_KEY` | AI service URL and shared secret |
| `MAX_SOURCE_FILES` (10000), `MAX_EXTRACTED_BYTES` (200 MB), `MAX_SOURCE_FILE_BYTES` (5 MB) | Extraction limits |
| `MAX_GITHUB_ZIP_BYTES` (100 MB), `UPLOAD_CONCURRENCY` (8) | GitHub download cap, parallel uploads |

**`ai-service/.env`**

| Variable | Description |
| :--- | :--- |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL` | Supabase connection |
| `NEO4J_URI`, `NEO4J_USERNAME`, `NEO4J_PASSWORD`, `NEO4J_DATABASE` | Graph database |
| `OPENROUTER_API_KEY`, `GEMINI_API_KEY` | Primary and fallback LLM |
| `REDIS_URL` | Publishes `report-updates` |
| `INTERNAL_API_KEY` | Required on every request when set |
| `ALLOWED_ORIGINS` | CORS origins, default `http://localhost:4000` |
| `PINECONE_API_KEY`, `PINECONE_ENVIRONMENT` | Reserved, currently unused |

**`frontend/.env`**

| Variable | Description |
| :--- | :--- |
| `VITE_API_DEV_URL` / `VITE_API_PRO_URL` / `VITE_API_URL` | Gateway URL |
| `VITE_WS_URL` | Gateway WebSocket URL |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Public Supabase settings |
| `VITE_MODE` | `development` or `production` |

**Planned variables**

| Variable | Service | Purpose |
| :--- | :--- | :--- |
| `MCP_NOTION_SERVER_URL`, `NOTION_DATABASE_ID`, `NOTION_API_KEY` | api-gateway | Notion export through MCP |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | api-gateway | GitHub OAuth for private repositories |
| `PINECONE_API_KEY`, `PINECONE_ENVIRONMENT` | ai-service | Vector retrieval (already templated) |

> Never commit `.env` files. They are git-ignored.

**LLM policy.** OpenRouter is the primary provider and Google Gemini is the automatic fallback. Direct OpenAI keys are not used; the `openai` package is only the OpenRouter-compatible client.

---

## 15. Testing

| Suite | Command | Needs services | Covers |
| :--- | :--- | :---: | :--- |
| Gateway unit tests | `cd api-gateway && npm test` | no | Project guard, GitHub URL validation, WebSocket authentication and room access |
| Import resolution | `cd ai-service && .venv/bin/python scripts/test_import_resolution.py` | no | Python and JS resolution, multi-line imports, duplicate symbol fix |
| Decomposition | `.venv/bin/python scripts/test_decomposition_engine.py` | no | All four strategies, isolated-file folding, naming, full file coverage |
| Planning | `.venv/bin/python scripts/test_planning_engine.py` | no | No invented services, coupling order, single-service case |
| Blueprint | `.venv/bin/python scripts/test_blueprint_generator.py` | no | Name sanitisation, Terraform per cloud, validation, previews |
| Frontend | `cd frontend && npx tsc -p tsconfig.app.json --noEmit && npm run lint && npm run build` | no | Types, lint, production build |
| End to end | `node e2e/run.js` | yes | The whole pipeline plus tenant isolation |

The other files in `ai-service/scripts/` (`check_*.py`, `db_*.py`, `test_engine.py` and so on) are diagnostics that run against live databases.

### End-to-end test

`e2e/run.js` drives the real API: upload, worker ingestion, analysis, intelligence, three decomposition strategies, planning and recalculation, blueprint, deployment, report, report regeneration and WebSocket delivery. It also checks cross-tenant isolation (a second user cannot read, decompose, plan, export or join the room of the first user's project) and that the AI service rejects calls without the internal key.

```bash
export SUPABASE_URL=...  SUPABASE_SERVICE_ROLE_KEY=...  SUPABASE_ANON_KEY=...
export GATEWAY_URL=http://localhost:4000  AI_URL=http://localhost:8000
export INTERNAL_API_KEY=...        # if the AI service requires one
node e2e/run.js                    # SKIP_LLM=1 to skip the intelligence step
```

Start the AI service, gateway, **worker** and Redis first. The script creates two throwaway Supabase users, uploads a small fixture repository, and deletes the users and the project's stored files when it finishes. It exits non-zero on any failure.

---

## 16. Deployment notes

- **Frontend:** `npm run build` produces static assets in `frontend/dist`. Set the `VITE_*` variables at build time.
- **Gateway and AI service:** containerised or run directly. Put the AI service on a private network; only the gateway and worker need to reach it.
- **Worker:** run at least one instance. Instances share the `ingestion` and `report-generation` queues.
- **Redis:** use a managed instance with persistence if jobs must survive restarts. The gateway, worker and AI service must point at the same instance.
- **Secrets:** inject through your platform's secret store. Rotate `INTERNAL_API_KEY` and the Supabase service-role key together with deployments.
- **Neo4j Aura free tier** pauses when idle. Analysis and decomposition need it; reports degrade gracefully without it.
- **Production switches:** set `NODE_ENV=production`, the `*_PRO_URL` variables, `FRONTEND_URL` and `ALLOWED_ORIGINS`, and always `INTERNAL_API_KEY`.

---

## 17. Status, roadmap and vision

### Delivery history

```mermaid
flowchart LR
    subgraph Core["Core platform (phases 0 to 8)"]
        C0["0 Foundation<br/>monorepo, compose, scaffolds"]:::done
        C1["1 Security<br/>Supabase Auth, ownership, RLS"]:::done
        C2["2 Ingestion<br/>ZIP and GitHub, worker, manifest"]:::done
        C3["3 Analysis<br/>AST, Neo4j graph, metrics"]:::done
        C4["4 Intelligence<br/>LLM findings, review"]:::partial
        C5["5 Decomposition<br/>scenarios, scorecards"]:::partial
        C6["6 Planning<br/>roadmap, cost, teams"]:::partial
        C7["7 Blueprints<br/>packages, contracts, IaC"]:::partial
        C8["8 Experience<br/>full workspace UI"]:::partial
        C0 --> C1 --> C2 --> C3 --> C4 --> C5 --> C6 --> C7 --> C8
    end
    subgraph V2["Report Agent (v2)"]
        R1["1 Schema and RLS"]:::done
        R2["2 Report Agent"]:::done
        R3["3 Report endpoint"]:::done
        R4["4 Queue, relay, sockets"]:::done
        R5["5 Dashboard"]:::done
        R6["6 Notion MCP export"]:::todo
        R1 --> R2 --> R3 --> R4 --> R5 --> R6
    end
    C8 --> R1
    classDef done fill:#14532d,stroke:#22c55e,color:#fff
    classDef partial fill:#78350f,stroke:#f59e0b,color:#fff
    classDef todo fill:#1f2937,stroke:#6b7280,color:#d1d5db
```

Green is complete, amber is implemented with named parts still open (see the capability matrix in section 1), grey is not started.

### Roadmap

```mermaid
flowchart TD
    NOW["Today<br/>ingest, analyse, understand,<br/>decompose, plan, export, report"] --> N1
    subgraph Next["Next"]
        N1["Notion MCP export<br/>(Phase 6)"]
        N2["Interactive boundary editing<br/>drag and drop + validations"]
        N3["Team-driven strategy"]
        N4["Rate limiting, quotas,<br/>job cancellation, dead-letter queue"]
        N5["CI/CD with GitHub Actions"]
    end
    N1 --> L1
    N2 --> L1
    N3 --> L1
    N4 --> L1
    N5 --> L1
    subgraph Later["Later"]
        L1["Pinecone retrieval and<br/>pattern comparison"]
        L2["Call graph and data-flow analysis,<br/>transactional boundaries,<br/>schema coupling"]
        L3["Private repositories via GitHub OAuth,<br/>commit-SHA pinned analysis"]
        L4["Roles, shared workspaces,<br/>decision audit trail"]
        L5["Versioned price catalogs, full ROI statement,<br/>per-workflow performance simulation"]
        L6["More languages: Java, Go, C#"]
    end
    L1 --> L2 --> L5
    L3 --> L4
    L2 --> L6
```

### Known limitations of the current build

- JS/TS parsing is regex-based: accurate for imports and top-level symbols, not a full compiler. Other languages are catalogued but not analysed.
- The consistency matrix pairs adjacent services by coupling order and flags sensitivity from service names; it does not yet use per-service data-access analysis.
- Cost and latency figures come from a transparent parametric model driven by your assumptions, not from live cloud pricing.
- "Deployment" simulates pipeline stages. Nothing is provisioned, and the Terraform output is a scaffold to review before use.
- GitHub import supports public repositories only.
- The Notion button is present but disabled until the export route ships.

---

## 18. Troubleshooting

| Symptom | Likely cause and fix |
| :--- | :--- |
| Gateway exits with `supabaseUrl is required` | An `.env` is missing or incomplete in `api-gateway/` |
| Upload returns `503 The job queue is unavailable` | Redis is not reachable at `REDIS_URL`. Start it (see step 3) |
| Job stays `queued` or `ingesting` | Worker not running, or it uses a different Redis than the gateway |
| Analysis fails: "No supported source files found" | The archive has no Python, JavaScript or TypeScript files |
| `401 Invalid or missing internal API key` | `INTERNAL_API_KEY` differs between gateway, worker and AI service |
| Dashboard shows `ai-service` OFFLINE | The gateway cannot reach `AI_SERVICE_URL`; check the URL, port and key |
| Dashboard shows `neo4j_graph` OFFLINE | Aura instance paused or wrong `NEO4J_URI` or credentials |
| Decomposition fails | The analysis found no files, or Neo4j was unreachable. Re-run analysis |
| Report page says "no report yet" | Reports start after a blueprint is created. Use **Generate report** if a plan exists |
| Report stuck on generating | AI service or Redis down mid-run. Use **Retry report** |
| Intelligence returns nothing | Both OpenRouter and Gemini failed; check the keys. The UI stops waiting after about two minutes |
| WebSocket never connects | Token missing or expired, `VITE_WS_URL` wrong, or `FRONTEND_URL` does not include your origin |

---

## 19. Contributing

Read `CLAUDE.md` and `.agents/AGENTS.md` first. In short:

- **Gateway:** flat layout, files named `feature.type.js`, Swagger docs in `docs/<feature>.docs.js`, every project route behind the ownership guard.
- **AI service:** thin routers in `api/routes`, logic in `services`, connections in `db`, `snake_case` files, every Neo4j query scoped by owner, project and source version.
- **Frontend:** pages aggregate, components live in feature folders, API calls go through `lib/api.ts`.
- **Commits:** [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `chore:`, `refactor:`, `docs:`, `test:`), short and specific. Push every commit, and open a pull request only when asked.

Before opening a pull request, run the suites in [Testing](#15-testing).

---

## 20. License and team

Licensed under the **Apache License 2.0**. See [LICENSE](LICENSE).

<div align="center">
  <br/>
  <b>Built by Team <a href="https://github.com/Tetra4ge">TetraFourge</a></b>
</div>
