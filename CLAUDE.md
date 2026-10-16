# CLAUDE.md — MonoMelt

Guidance for Claude Code when working in this repository.

---

## 1. What the project is

**MonoMelt** (Legacy Monolith → Microservices Transformation Intelligence Platform) takes a legacy monolithic codebase and produces a transformation strategy: dependency analysis, AI-driven service decomposition, a migration plan with cost and team mapping, a blueprint ZIP (FastAPI/Express boilerplate, Docker Compose, Terraform, ADRs), and an executive report.

Pipeline, end to end:

1. **Ingest** a source ZIP upload or a public GitHub repo (branch zip). The worker filters source files and writes a manifest.
2. **Analysis Agent** — parses source into ASTs and builds a dependency graph in Neo4j.
3. **Intelligence Agent** — LLM pass over graph nodes to find bounded contexts, risks, and data sensitivity; stored in `ai_findings`.
4. **Decomposition Agent** — Louvain community detection over the graph; produces scenarios (Aggressive, Conservative, Domain-Driven).
5. **Planning Agent** — cost projections, Conway's-law team ownership, phased roadmap; stored as migration plans.
6. **Blueprint Generator** — builds the downloadable blueprint ZIP.
7. **Report Agent** — fans out over Postgres and Neo4j, asks the LLM for an executive summary, writes a versioned JSON payload to `project_reports`.
8. **Notion export** — planned (Phase 6), not implemented yet.

Sample output of a blueprint lives in `Output/blueprint-*/`.

---

## 2. Repository layout

```
MonoMelt/
├── frontend/          React 19 + TypeScript + Vite + Tailwind v4 (SPA)
├── api-gateway/       Node.js + Express 5 — auth, routing, queues, sockets, Swagger
├── worker/            Node.js + BullMQ — ingestion + report-trigger jobs
├── ai-service/        Python + FastAPI — all analysis / LLM / report logic
├── database/migrations/  01..09 SQL migrations (Supabase Postgres)
├── docs/              Original product docs (PRD, TRD, phase-0..8)
├── phase-v2/          v2 phase specs (Phase1..6, ReportAgent.md) — the current plan
├── Images/            README diagrams
├── Output/            Sample generated blueprint
├── .agents/           AGENTS.md (architecture rules) + skills
└── docker-compose.yml frontend, api-gateway, ai-service, worker, redis
```

### Services and ports

| Service | Port | Entry point | Talks to |
|---|---|---|---|
| frontend | 5173 | `frontend/src/main.tsx` | api-gateway (REST + Socket.io), Supabase Auth |
| api-gateway | 4000 | `api-gateway/server.js` | Supabase (JWT verify, DB), Redis (BullMQ + pub/sub), ai-service |
| ai-service | 8000 | `ai-service/main.py` | Supabase Postgres (asyncpg), Neo4j, OpenRouter / Gemini |
| worker | — | `worker/index.js` | Redis (BullMQ), Supabase Storage + DB, ai-service |
| redis | 6380 (host) → 6379 | docker-compose | — |

Neo4j is AuraDB (hosted), not a compose service. Pinecone is configured but unused (`db/pinecone_client.py` is empty).

---

## 3. Architecture rules (from `.agents/AGENTS.md`)

These are mandatory. Follow them before creating any file.

### Frontend (`frontend/`)
- `src/pages/` — view aggregators only, no heavy logic.
- `src/components/` — grouped by feature/domain (`landing/`, `planning/`, `deployment/`, `projects/`, `report/`, `auth/`).
- Components: **PascalCase** (`Hero.tsx`). Hooks/utilities: **camelCase** (`useProjectReport.ts`).
- API calls go through `src/lib/api.ts` (axios, attaches the Supabase access token).
- State: Zustand (`src/stores/`), server state: TanStack Query.
- Styling: Tailwind v4. Use the `monomelt-theme` skill (`.agents/skills/monomelt-theme/`) for visual decisions.

### API gateway (`api-gateway/`)
- **Flat layout. Do not create `src/`.**
- Folders: `routes/`, `controllers/`, `services/`, `middlewares/`, `config/`, `utils/`, `docs/`.
- Files must follow **`feature.type.js`**: `analysis.routes.js`, `auth.middleware.js`, `ai.service.js`, `auth.docs.js`.
- Swagger for every endpoint lives in `docs/<feature>.docs.js` (swagger-jsdoc). See `.agents/skills/swagger-docs/SKILL.md`.
- Every protected route uses `requireAuth` (`middlewares/auth.middleware.js`), which verifies the Supabase token.
- Controllers scope every query by `req.user.sub` / `req.user.id` (`owner_id`).
- Calls to the AI service go through `services/ai.service.js` (`proxyToAiService`).

### AI service (`ai-service/`)
- `main.py` — Uvicorn entry point. Routers mounted in `main.py`.
- `api/routes/` — **thin** FastAPI routers only. No DB queries in routes.
- `services/` — business logic (AST parsing, graph building, decomposition, planning, blueprint, report).
- `db/` — connection code only (`pg_client.py`, `neo4j_client.py`, `pinecone_client.py`).
- `llm/` — per AGENTS.md this should hold LLM code. **Today LLM calls live in `services/llm_provider.py`.**
- `models/` — `schemas.py` (Pydantic API models), `domain.py` (internal classes), plus `reports.py`, `planning.py`, `blueprints.py`.
- `core/config.py` — `pydantic-settings` `Settings`, loaded via `get_settings()`.
- Files: **snake_case**. Classes/Pydantic models: **PascalCase**. Prompt constants: **UPPER_SNAKE_CASE**.
- **LLM provider rule:** OpenRouter is primary, Google Gemini is the fallback. Do **not** add direct OpenAI keys. (The `openai` package is used only as the OpenRouter-compatible client.)
- Every Neo4j query must filter by `owner_id`, `project_id`, and `source_version_id` (stated in `db/neo4j_client.py`).

---

## 4. Environment and data stores

Env files (`.env`, `.env.example`) exist in `frontend/`, `api-gateway/`, `worker/`, `ai-service/`. **Never commit `.env`.** Never print or copy secret values into code, docs, or chat. `.gitignore` already excludes `.env` and `.venv`.

Key variables:
- **api-gateway:** `PORT`, `FRONTEND_URL`, `AI_SERVICE_DEV_URL`/`AI_SERVICE_PRO_URL`, `SUPABASE_URL`, `SUPABASE_JWT_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `REDIS_URL`, optional GitHub OAuth.
- **worker:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `REDIS_URL`, `AI_SERVICE_URL`, `MAX_SOURCE_FILES`, `MAX_EXTRACTED_BYTES`.
- **ai-service:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `NEO4J_URI`, `NEO4J_USERNAME`, `NEO4J_PASSWORD`, `NEO4J_DATABASE`, `OPENROUTER_API_KEY`, `GEMINI_API_KEY`, `PINECONE_*` (unused).
- **frontend:** `VITE_API_DEV_URL`, `VITE_API_PRO_URL`, `VITE_API_URL`, `VITE_WS_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_MODE`.

Data:
- **Postgres (Supabase):** projects, source_versions, source_files, analysis_jobs, ai_findings, scenarios, migration_plans, blueprints, deployments, project_reports. RLS is on for reports (migration 09). Schema is defined in `database/migrations/01..09`.
- **Supabase Storage:** bucket named `openai` holds uploaded ZIPs and extracted source under `projects/{projectId}/{sourceVersionId}/…`.
- **Neo4j:** `File`, `Symbol`, `ExternalDependency` nodes keyed by `source_version_id`, plus dependency edges.
- **Redis:** BullMQ queues `ingestion` and `report-generation`; pub/sub channel `report-updates`.

---

## 5. Common commands

```bash
# Infra
docker-compose up -d redis

# API gateway (port 4000)
cd api-gateway && npm install && npm run dev        # nodemon server.js
# Swagger UI: http://localhost:4000/api-docs

# Worker
cd worker && npm install && npm run dev             # nodemon index.js

# AI service (port 8000)
cd ai-service && uv sync              # creates .venv from uv.lock (Python 3.12 from .python-version)
uv run uvicorn main:app --reload --port 8000
uv run python scripts/test_import_resolution.py   # offline suites

# Frontend (port 5173)
cd frontend && npm install && npm run dev
npm run build      # runs `tsc -b && vite build`
npm run lint       # eslint .

# Quick syntax checks
node --check api-gateway/server.js
python -m py_compile ai-service/main.py
```

There is no automated test suite. `api-gateway`'s `npm test` is a placeholder. `ai-service/scripts/` holds ad-hoc check scripts (`test_engine.py`, `test_decomposition.py`, `check_neo4j.py`, `db_status.py`, etc.) that run against live services.

---

## 6. API surface (gateway, all under `/api`, JWT required unless noted)

- `/api/auth` — `GET /me`
- `/api/projects` — list, get, create
- `/api/projects/:projectId/sources` — zip upload (`POST /zip`), GitHub import (`POST /github`)
- `/api/projects/:projectId/analysis` — trigger, run status, metrics, graph, diagnostics
- `/api/projects/:projectId/intelligence` — trigger, findings, review
- `/api/projects/:projectId/scenarios` — decomposition
- `/api/projects/:projectId/plans` — planning (generate, recalculate, revisions, ownership, cost)
- `/api/projects/:projectId/blueprints` — generate, download
- `/api/projects/:projectId/deployments` — simulated pipeline
- `/api/projects/:projectId/reports` — latest report (`GET /`)
- `/health` — public

Swagger: `/api-docs`.

The AI service exposes matching routes at its root (e.g. `/analysis/trigger`, `/intelligence/...`, `/planning/...`, `/blueprints/generate`, `/decomposition/generate`), plus `/api/reports/generate`. Its `/health` is public.

---

## 7. Phase status (v2 plan in `phase-v2/`)

| Phase | Scope | State |
|---|---|---|
| 1 | `project_reports` table, enum, RLS | Done (migration 09) |
| 2 | `ReportAgent` in `services/report_generator.py` | Done |
| 3 | `POST /api/reports/generate` (202, background task) | Done |
| 4 | Worker trigger, gateway `GET` route, socket relay | Mostly done. **No publisher** on `report-updates`, and the AI service has no Redis client. |
| 5 | `ReportPage.tsx` + polling + Recharts | Partial. **Hook calls `/api/reports/:id`; gateway serves `/api/projects/:id/reports`** — 404 as wired. |
| 6 | Notion MCP export | Not started. Frontend button calls a route that does not exist. |

When you pick up work in phase-v2, check these first.

---

## 8. Known issues (verified in code review)

Fix these carefully. Do not add new code on top of them without flagging it.

1. **AI service has no authentication**, and `main.py` sets `allow_origins=["*"]` with `allow_credentials=True`. Port 8000 is published by docker-compose. Anyone reaching it can trigger LLM-costing jobs and read data by `source_version_id`.
2. **`services/enrichment.py` Neo4j query** filters only on `source_version_id`, not `owner_id`/`project_id`, which breaks the tenant-isolation rule.
3. **`api-gateway/controllers/planning.controller.js:63`** falls back to a hardcoded owner UUID.
4. **Frontend build fails `tsc -b`**: unused `React` imports in `components/report/*.tsx` and `pages/ReportPage.tsx`, and unused `user` in `ReportPage.tsx`. ESLint has one error in `ReportPage.tsx`.
5. **`worker/index.js` `processGithubSource`** buffers the whole GitHub zip in memory before any size check.
6. **Config drift:** CORS includes `https://openai.onrender.com`; Redis is 6380 on host but 6379 in `worker/.env.example`; `REDIS_URL` is missing from the gateway's required-env check; `planning.routes` is mounted twice; `pinecone-client` is a stale package name.
7. **`db/pg_client.py`** opens a new connection on every query (no pool), and its error log mentions a "local postgres fallback" that does not exist.

---

## 9. Conventions for changes

- Match the naming and layering rules in section 3. Put new code where the layer rules say it goes.
- Keep route files thin: validation and dispatch only. Logic goes in `services/` (Python) or `controllers/` + `services/` (Node).
- Every new gateway endpoint needs a `docs/<feature>.docs.js` Swagger entry.
- Every new query on user data must be scoped by owner. In Neo4j, scope by `owner_id`, `project_id`, and `source_version_id`.
- Schema changes go in a new numbered migration file under `database/migrations/` (next free number is `10_`). Do not edit applied migrations.
- Do not commit `.env`, `.venv/`, `__pycache__/`, or `node_modules/`.
- Do not add direct OpenAI SDK keys. LLM access goes through OpenRouter, with Gemini as the fallback.
- Prefer small, verifiable changes. After a change, run the relevant syntax or build check from section 5.

---

## 10. Git workflow

After completing each phase or task the user specifies, stage and commit all changes.
Use conventional commit format: feat:, fix:, chore:, refactor:, docs:, test:.
Keep commit messages short and precise. Describe only what changed, nothing extra.
Never add Claude (or any AI model) as a co-author. No Co-Authored-By trailers.
Every commit must be pushed to GitHub. Never leave commits only local.
Push to the branch the user specifies (git push origin <branch>). Create it if it doesn't exist (git checkout -b <branch>).
Never open a PR or merge unless asked.
Example: feat: add GA mutation operators and population seeding
