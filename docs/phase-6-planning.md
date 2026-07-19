# Phase 6: Planning

## Purpose

Phase 6 turns a selected scenario into an actionable migration plan. It makes
assumptions visible and separates measured facts from estimates so engineering
leaders can make an informed decision.

## Outcomes

The platform produces a versioned planning report that covers migration order,
team ownership, consistency patterns, performance impact, security boundaries,
and cost ranges. Users can change explicit assumptions and recalculate the
report without regenerating the source analysis.

## Planning inputs

Require or clearly default the following inputs:

- chosen scenario revision and target deployment environment;
- current workload, latency, availability, and infrastructure baseline;
- cloud/provider pricing region and resource assumptions;
- teams, capacities, skills, ownership constraints, and dependencies;
- risk tolerance, delivery window, and compliance requirements;
- selected user workflows for latency and migration modelling.

Every default must show its source, timestamp, currency, and confidence. Cost
outputs should be ranges with sensitivity drivers, never false precision.

## Planning engines

### Migration roadmap

- Rank extraction candidates using dependency direction, coupling, data risk,
  interface clarity, testability, and business criticality.
- Create stages such as preparation, low-risk extraction, shared-data
  transition, high-coupling migration, and stabilisation.
- For each stage include prerequisites, ownership, estimated effort range,
  rollout method, observability requirements, rollback condition, and success
  metric.
- Recommend a modular-monolith or strangler path when the scenario's risk
  exceeds configured thresholds.

### Data consistency and security

- Classify cross-service writes and state the evidence for each recommendation.
- Recommend patterns such as saga, outbox, CQRS, event sourcing, or retaining a
  shared boundary only when their trade-offs are documented.
- Produce a data-flow/security matrix: data category, producer, consumer,
  required authorization, encryption requirement, retention requirement, and
  audit implication.

### Cost and performance

- Model current and target compute, storage, database, network, operational,
  observability, and people costs separately.
- Use configurable provider price catalogs with effective date/version rather
  than hard-coded cloud prices.
- Simulate selected workflows by hop count, synchronous/async edges, latency
  distributions, caching assumptions, and failure/retry penalties.
- Explain sensitivity: for example, show how traffic, database count, or
  cross-region calls affect the estimate.

### Team mapping

- Map proposed services to teams using domain affinity, capacity, critical-path
  load, skills, and communication dependencies.
- Flag an overloaded team, a service without an owner, and a critical service
  with a single maintainer.

## APIs and report lifecycle

```text
POST /api/projects/:projectId/scenarios/:scenarioId/plans
GET  /api/projects/:projectId/plans
GET  /api/projects/:projectId/plans/:planId
POST /api/projects/:projectId/plans/:planId/assumptions
```

Plans are immutable reports. Changing assumptions creates a new report
revision with links to the exact scenario, input values, algorithm versions,
and source data used.

## Quality gates

- Unit-test formulas, ranking rules, rounding, currencies, and edge cases.
- Include deterministic fixtures for known workflow latency and cost examples.
- Require human-readable explanation and machine-readable input/output schemas
  for every recommendation engine.
- Review all generated security and consistency advice with a qualified
  architect before presenting it as a production recommendation.

## Definition of done

- A selected scenario can produce a reproducible plan with transparent inputs,
  migration stages, team mapping, cost range, latency analysis, consistency
  advice, and security matrix.
