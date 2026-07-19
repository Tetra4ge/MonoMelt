# Phase 4: Intelligence

## Purpose

This phase adds constrained AI enrichment to the static graph. Its purpose is
to explain likely domains, risks, transactions, and data sensitivity with
traceable evidence—not to make unsupported architectural claims.

## Outcomes

The system processes graph-informed code chunks asynchronously, validates
structured model output, stores model/prompt provenance, and presents
confidence and evidence alongside every AI-derived finding.

## LLM integration design

- Build a provider interface in the AI service so Gemini/OpenRouter can be
  selected by configuration without leaking provider details into routes or
  business logic.
- Use only server-side API keys, explicit connect/read timeouts, exponential
  backoff, provider-aware rate limits, circuit breaking, and capped retries.
- Version prompts and JSON schemas. Persist the prompt version, provider,
  model, request hash, token counts, latency, estimated cost, and raw response
  retention reference for each invocation.
- Require structured JSON responses validated by Pydantic. Reject malformed,
  incomplete, or schema-incompatible results; never parse free-form prose into
  database fields.
- Send minimum necessary context. Redact discovered secrets and configurable
  sensitive patterns before any external LLM request.

## Enrichment tasks

Start with high-value, bounded tasks:

- classify modules/functions into candidate business domains;
- identify likely transactional workflows and shared-data risks;
- flag PII, credentials, payment, authentication, and regulated-data signals;
- summarize module responsibilities and externally visible interfaces;
- propose evidence-backed candidate boundaries, not final services.

Each finding must contain a type, subject IDs, explanation, confidence,
evidence IDs, model metadata, and a `needs_review` flag. Static extraction
must remain the source of truth for exact symbols, paths, calls, and schema
references.

## Vector retrieval

- Implement embeddings only after a useful deterministic graph exists.
- Use embeddings for retrieval and comparisons, never as a stand-alone
  decision engine.
- Store tenant/project metadata with every vector and enforce metadata filters
  on every query to prevent cross-project retrieval.
- Seed any external reference corpus with versioned, licensed, reviewed
  material. Record corpus source and license in results.
- Support deletion when a project/source version is deleted.

## Queue and progress model

- Chunk work by coherent module/subgraph rather than arbitrary character
  count. Maintain token budgets and dependency context.
- Use durable queue jobs with idempotency keys, dead-letter handling, retry
  policy, cancellation, and per-project concurrency limits.
- Publish the same job/status contract introduced in Phase 2. Report progress
  by completed units and state; never invent a misleading percentage.

## Safety, review, and evaluation

- Add an explicit user-facing disclaimer: results are recommendations requiring
  engineering review.
- Build labelled fixtures for domain, transaction, and sensitivity tasks.
  Measure schema validity, agreement with fixtures, latency, cost, and unsafe
  output rate before changing prompts/models.
- Provide a review API so users can accept, reject, or annotate findings; keep
  the original finding and decision as an audit trail.

## Definition of done

- A completed analysis can produce validated, evidence-linked findings through
  an asynchronous job and protected API.
- Every AI result identifies its source entities, prompt/model version,
  confidence, and review state, while secrets and cross-project data are not
  exposed to the provider or another tenant.
