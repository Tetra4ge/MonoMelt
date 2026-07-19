# Phase 3: Analysis

## Purpose

Phase 3 produces trustworthy, deterministic evidence from an ingested source
version. It establishes the dependency graph and code metrics that every
later recommendation must cite. LLM output must enrich this evidence, never
replace it.

## Outcomes

For each supported language, the platform can parse source safely, create a
versioned graph of modules, symbols, imports, calls, routes, and data access,
then return both summary metrics and paginated graph views to the user.

## Supported-language strategy

- Begin with JavaScript/TypeScript and Python because they match the platform
  stack and have reliable parser ecosystems.
- Define a parser adapter contract: `detect`, `parse`, `extract`, `normalize`,
  and `report_diagnostics`.
- Treat unsupported languages and syntax failures as warnings with exact file,
  parser, and location metadata. Do not fail a complete analysis because one
  file cannot be parsed.
- Add languages only when fixtures, parser-version pinning, and graph-contract
  tests are complete.

## Canonical analysis model

Give every entity a stable ID scoped to `source_version_id`. Store source
location and content hash so results can be reproduced.

Core nodes:

```text
Repository, Directory, File, Module, Class, Function, Method,
Route, DatabaseTable, MessageTopic, ExternalDependency
```

Core edges:

```text
CONTAINS, IMPORTS, CALLS, EXPOSES, READS, WRITES,
QUERIES, PUBLISHES, CONSUMES, DEPENDS_ON
```

Edges must carry confidence, extraction method, source location, and evidence
references. Distinguish an inferred call from a statically resolved call.

## Pipeline

1. Select eligible files from the Phase 2 manifest.
2. Parse files in a sandboxed worker with file/time/memory budgets.
3. Normalize language-specific AST output into the canonical model.
4. Resolve imports and references within the source version.
5. Extract HTTP routes, ORM/schema declarations, SQL references, environment
   dependencies, and messaging references where statically discoverable.
6. Persist raw parser diagnostics, relational summaries, and Neo4j nodes/edges
   in idempotent batches.
7. Compute baseline metrics: files, lines, symbols, unresolved imports, graph
   components, cycles, fan-in, fan-out, centrality candidates, and data-access
   concentration.

## Storage and APIs

- PostgreSQL stores analysis runs, parser versions, diagnostics, aggregate
  metrics, and report references.
- Neo4j stores the versioned dependency graph. Every Cypher query must filter
  by owner, project, and source version; base graph data must never be mutated
  by a user's later scenario edits.
- Expose:

```text
GET /api/projects/:projectId/analysis
GET /api/projects/:projectId/graph?version=&cursor=&depth=
GET /api/projects/:projectId/diagnostics
```

- Graph responses must be bounded and paginated. Return summaries or
  collapsed directory/module nodes for large repositories rather than sending
  tens of thousands of entities to the browser.

## Quality gates

- Maintain fixture repositories with expected node/edge snapshots for Python
  and TypeScript.
- Test malformed files, circular imports, monorepos, generated code exclusion,
  and partial parser failure.
- Add graph migration, query-performance, and idempotency tests.
- Record parser coverage and unresolved-reference rates in the report; do not
  claim accuracy without showing these limits.

## Definition of done

- A completed source version has a versioned graph, diagnostics, and baseline
  metrics available through protected APIs.
- Re-running the same source and parser version creates the same canonical
  graph without duplicate data.
