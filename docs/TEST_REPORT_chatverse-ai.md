# Live end-to-end test report: `Rahul-8283/chatverse-ai`

Date: 2026-10-16. Branch: `test1`. Notion export excluded by request.

## Result

| Suite | Result |
| :--- | :--- |
| Live GitHub flow through the gateway (`e2e/github-flow.js`) | **77 / 77 checks**, 93 s end to end |
| UI smoke in headless Chromium (`e2e/ui-smoke.js`) | **72 / 72 checks**, no console errors, no failed API calls |
| Gateway unit tests (`npm test`) | 10 / 10 |
| AI service offline suites | 5 / 5 (import resolution, decomposition, planning, blueprint, Postgres hints) |
| Frontend | `tsc` clean, ESLint 0 errors (2 older `exhaustive-deps` warnings), production build OK |

## What the pipeline produced for the repository

| Stage | Outcome |
| :--- | :--- |
| Import | GitHub archive fetched by the worker; job `queued > ingesting > ready > analyzing > completed` |
| Analysis | 26 files, 3,759 lines, 87 functions, 1 class, 0 import cycles, 5 independent components, **0 unresolved imports**; graph of 140 nodes and 208 edges |
| Intelligence | 12 LLM findings (domain, sensitivity, risk) with confidence; review/approve works |
| Decomposition | conservative 8 services, aggressive 8, domain 7 (`components`, `app`, `utils`, `config`, `contexts`, `firebase`, `store`); every file in exactly one service |
| Plan | 5 stages ordered by coupling, only real services; recalculation adds revision 2 (GCP, 4 teams), and a third from the UI |
| Blueprint | 44 files: per-service Dockerfile and Kubernetes manifests, OpenAPI, events, gateway routes, ADR, Terraform; all 3 validation checks pass; ZIP downloads |
| Deployment | 4 simulated stages; 7 real services listed, labelled Simulated |
| Report | v1 and v2 completed; 7 services, risk LOW, 4 months, 1.7x cost multiplier, 3 services with graph-derived dependencies; websocket `report_completed` delivered for both versions |

## Problems found and fixed

| # | Problem | Cause | Fix |
| :-: | :--- | :--- | :--- |
| 1 | Analysis could not start (Neo4j "unavailable") | `ai-service/.env` still pointed at the deleted Aura instance (host no longer resolves) | Switched to the new `MonoMELT` instance from the downloaded credentials; verified connect and empty graph |
| 2 | Job failed: `401 Invalid or missing internal API key` | Gateway and worker were started before their `.env` was saved; nodemon does not watch `.env` | Restarted both. Code: a rejected internal key is now a 502 naming `INTERNAL_API_KEY`, not a 401 that looks like an expired login |
| 3 | Job failed: `Unable to connect to DATABASE_URL` | AI service used Supabase's direct host (IPv6 only); the gateway already had the pooler URL | Pointed the AI service at the pooler. Code: actionable error hints, `statement_cache_size=0` for PgBouncer, Postgres in `/health`, env templates and README updated |
| 4 | No websocket event after a report completed | `ai-service/.env` had no `REDIS_URL`; default was 6379, Redis is on 6380, so publishes failed quietly | Added `REDIS_URL`, default changed to 6380, publishes with no subscriber warn, Redis in `/health` and on the dashboard |
| 5 | 9 "unresolved imports" | `import logo from './logo.png'` and CSS imports counted as unresolved code | Asset imports flagged and ignored in the graph and the metric |
| 6 | Services named `components-service`, `-2` ... `-6` | Folder name won for every cluster inside `components/` | Name by dominant business folder, else by the file that imports the most siblings |
| 7 | `/health` could report a healthy AI service as down | Three cold probes ran in sequence and exceeded the gateway's 3 s timeout | Probed concurrently with per-probe timeouts; gateway allows 8 s |

Found by inspecting screenshots, which text assertions had missed (the UI test now asserts each):

| # | Defect | Fix |
| :-: | :--- | :--- |
| 8 | "Detected languages: No languages detected" | Component read `languages`; API sends `language_breakdown`. Also now shows cycles, components and unresolved imports |
| 9 | Finding chips all read `a70b2d6b` | First 8 characters of every node id are the same source-version prefix; now shows the file name |
| 10 | Executive summary showed literal `**` markers | Render the model's bold and paragraphs |
| 11 | Deployment showed one invented "generated-api-gateway, Healthy" card | Lists the blueprint's real services, labelled Simulated |
| 12 | "1 files grouped" | Singular/plural |

Not a defect: the report chart looked empty in one screenshot. It had real bars (276 and 471 px); the full-page capture resized the viewport and replayed the animation. The test now sizes the viewport before capturing.

## Not covered

- Notion export (excluded).
- Private repositories, languages other than Python, JavaScript and TypeScript.
- The synthetic cross-tenant suite (`e2e/run.js`) was not run in this session; tenant isolation is covered by the gateway unit tests (ownership guard, socket authentication and rooms).
- LLM wording varies between runs. The tests check structure and sanity, not exact text.
