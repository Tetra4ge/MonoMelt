# Phase 5: Decomposition

## Purpose

Phase 5 converts the evidence graph and reviewed AI findings into comparable
microservice-boundary scenarios. The output is a decision aid, not an automatic
rewrite of a monolith.

## Outcomes

Users can generate, inspect, compare, version, and select decomposition
scenarios. Each proposed service has membership, interfaces, data ownership,
trade-offs, risks, confidence, and traceable reasons for its boundary.

## Scenario contract

Implement a single normalized scenario model with these strategy types:

```text
conservative  Minimise distributed calls and operational change.
aggressive    Prefer smaller, weakly coupled services.
domain        Prefer reviewed bounded-context assignments.
team          Respect supplied ownership and team capacity constraints.
```

Each scenario is immutable once generated and references exactly one source
version and analysis version. User edits create a new revision rather than
changing the generated baseline.

Core APIs:

```text
POST /api/projects/:projectId/scenarios
GET  /api/projects/:projectId/scenarios
GET  /api/projects/:projectId/scenarios/:scenarioId
POST /api/projects/:projectId/scenarios/:scenarioId/revisions
```

## Deterministic baseline algorithms

- Build weighted graphs from static coupling first: imports, calls, shared
  tables, synchronous route paths, dependency direction, and change/ownership
  metadata when available.
- Generate clusters using transparent, repeatable algorithms. Store algorithm
  version, parameters, input graph version, and random seed when applicable.
- Use LLM domain labels only as a weighted signal, subject to confidence and
  user review; never hide this influence.
- Score cohesion, coupling, service count, cross-service calls, shared data,
  circular dependencies, single points of failure, and extraction difficulty.

## Required validations

For every scenario, calculate and surface:

- direct and indirect service cycles;
- synchronous call-chain depth and likely latency hot paths;
- tables written by multiple proposed services;
- distributed transaction candidates;
- cross-boundary authentication/PII flows;
- unassigned entities, duplicate membership, and low-confidence boundaries;
- candidate strangler seams and dependency leaf services.

Do not label a scenario "safe". Use severity and evidence-backed language such
as `high shared-write risk` or `cycle requires an interface change`.

## Data model and collaboration

- Store scenario metadata, metrics, service definitions, revisions, review
  comments, selection status, and audit events in PostgreSQL.
- Store a scenario projection in Neo4j with scenario/revision scope so graph
  queries are fast without modifying the immutable analysis graph.
- Enforce project ownership and role-based edit access. Support optimistic
  concurrency using revision IDs; reject conflicting edits rather than
  silently overwriting another architect's changes.

## Quality gates

- Use fixture repositories with known clusters, cycles, and shared tables.
- Snapshot scenario output for fixed algorithm inputs.
- Test data isolation, invalid membership edits, revision conflicts, and
  performance on large graphs.
- Benchmark scenarios against an explicit time and memory budget.

## Definition of done

- The user can generate the four strategies for a completed analysis, compare
  their scorecards, inspect evidence per boundary, and persist a selected or
  edited scenario revision without changing the original graph.
