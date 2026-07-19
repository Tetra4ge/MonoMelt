# Phase 8: Experience

## Purpose

Phase 8 turns the backend capabilities into a coherent, accessible product for
architects, engineering managers, and platform teams. It is an integration and
quality phase, not just a visual-polish pass.

## Outcomes

An authenticated user can create a project, submit a source, understand
analysis progress and limits, compare scenarios, revise service boundaries,
review plans, generate a blueprint, and return to prior work with clear status
and recoverable errors.

## Application information architecture

Implement stable routes and page ownership:

```text
/login
/auth/callback
/app/projects
/app/projects/:projectId/overview
/app/projects/:projectId/sources
/app/projects/:projectId/analysis
/app/projects/:projectId/scenarios
/app/projects/:projectId/plans
/app/projects/:projectId/blueprints
/app/settings
```

- Keep pages as compositional views; place API, state, and graph logic in
  feature-specific modules, hooks, and stores.
- Use one typed API client and generated/shared request-response types where
  practical. The frontend must not recreate business calculations locally.
- Model server state explicitly: `idle`, `loading`, `empty`, `working`,
  `success`, `partial`, `failed`, and `forbidden`.

## Core user journeys

### Project and ingestion

- Create a named project, choose ZIP or GitHub source, submit it, and receive
  immediate validation feedback.
- Show job state, stage, warnings, retry/cancel actions where permitted, and
  a clear explanation when analysis cannot continue.

### Analysis and graph exploration

- Provide a summary first: languages, file count, parser coverage, diagnostics,
  hotspot/risk metrics, and clear limitations.
- Render the graph with progressive loading, search, filters, grouping,
  semantic zoom, and details-on-demand. Never attempt to render a huge raw
  graph at once.
- Use accessible colours plus labels/icons for risk; colour alone must not
  communicate meaning.

### Scenario collaboration

- Compare scenarios in a consistent scorecard before opening detailed graphs.
- Show the evidence and trade-off behind each boundary and warning.
- Support controlled drag-and-drop edits with confirmation, validation results,
  revision history, optimistic-concurrency conflict handling, and undo within
  the active draft.

### Planning and export

- Display assumptions before recommendations, ranges before precise-looking
  figures, and warnings beside generated advice.
- Let users review blueprint contents and validation warnings before requesting
  a signed download.

## UX, accessibility, and resilience

- Meet WCAG 2.2 AA for keyboard navigation, focus management, contrast,
  semantic controls, error announcements, and responsive layouts.
- Use form validation, empty states, skeletons only when helpful, retryable
  errors, and non-blocking notifications. Do not hide a failed async job behind
  an infinite spinner.
- Implement error boundaries, route-level code splitting, safe URL parameter
  parsing, and telemetry that excludes code contents, credentials, and tokens.
- Respect roles and ownership in navigation as well as in backend APIs; the UI
  is never the authorization boundary.

## Production readiness

- Add end-to-end tests for the complete GitHub-login-to-blueprint journey,
  including unauthorised access and failed-job recovery.
- Track product metrics: project creation, source acceptance, time to first
  analysis, analysis completion/failure rate, scenario selection, export
  completion, and page performance.
- Add client error monitoring, backend correlation IDs, dashboards, alerting,
  backup/restore drills, retention jobs, dependency updates, and a release
  checklist.
- Establish staging and production environments with distinct Supabase OAuth
  callback URLs, CORS allow-lists, secrets, storage buckets, and observability
  keys.

## Definition of done

- The complete protected user journey works in staging under automated tests.
- The product meets defined accessibility, performance, security, observability,
  and recovery checks, and its recommendations/export artifacts clearly expose
  evidence, assumptions, and review requirements.
