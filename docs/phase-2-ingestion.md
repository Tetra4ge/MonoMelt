# Phase 2: Ingestion

## Purpose

This phase turns a user-owned project into a safe, reproducible analysis
source. It handles ZIP uploads first and adds GitHub repository import only
after the authorization boundary defined in Phase 1 is in place.

## Outcomes

The platform accepts a supported source, records exactly what was analysed,
places it in isolated object storage, creates an asynchronous analysis job,
and exposes reliable status to the frontend. A gateway request must never wait
for parsing or LLM work to finish.

## Source contract

Support two mutually exclusive source types:

```text
zip    A user-uploaded archive.
github A selected GitHub repository, branch, and optional commit SHA.
```

Initial public API:

```text
POST /api/projects/:projectId/sources/zip
POST /api/projects/:projectId/sources/github
GET  /api/projects/:projectId
GET  /api/projects/:projectId/jobs/:jobId
```

The create-source response returns `202 Accepted`, the source version, job ID,
and an initial `queued` status. The frontend polls initially; a later phase may
add server-sent events without changing the status contract.

## Secure ZIP ingestion

- Accept only ZIP archives with a strict MIME/type and signature check.
- Set configurable limits for request size, compressed size, extracted size,
  file count, individual-file size, path depth, and analysis duration.
- Inspect entries before extraction and reject absolute paths, `..` traversal,
  symlinks, device files, executable artifacts, and archive-bomb ratios.
- Extract only into a per-job temporary directory outside the served web root.
- Apply a language/source allow-list and ignore dependencies, VCS files,
  secrets, build output, and generated/minified files by default.
- Calculate a source manifest: normalized file path, byte size, content hash,
  detected language, and include/exclude reason. Preserve the manifest for
  reproducibility and auditability.

## GitHub ingestion

- Require an authenticated owner and explicit repository selection.
- Resolve the selected branch to a commit SHA before enqueueing work. The
  commit SHA, not a moving branch name, is the analysis version.
- Validate repository access server-side before cloning/downloading.
- Use a short-lived, encrypted server-side GitHub credential only when private
  repository access is required; never return it to the frontend or logs.
- Use shallow, no-submodule clones, disable hooks, enforce a timeout and size
  ceiling, then run the same manifest and exclusion pipeline as ZIP sources.

## Persistence and jobs

- Add `source_versions`, `analysis_jobs`, and `source_files` tables. Preserve
  source checksum, commit SHA, detection results, job timestamps, retry count,
  and an error code suitable for the UI.
- Store source archives and extracted source in private object storage with
  owner/project/job-scoped paths. Use signed, time-limited access only when a
  browser genuinely needs a file.
- Introduce a queue and worker boundary. The gateway validates and records a
  job; the worker performs extraction and then emits the static-analysis task
  for Phase 3.
- Define job states: `queued`, `validating`, `ingesting`, `ready`,
  `analysing`, `completed`, `failed`, `cancelled`. State transitions must be
  idempotent and auditable.

## Observability and reliability

- Propagate a request ID, project ID, source version ID, and job ID through
  logs and task payloads.
- Record queue latency, ingestion duration, rejected archives, extracted byte
  count, and failure category.
- Add cancellation and safe cleanup. Retain raw source only for the documented
  retention period and delete temporary directories even after failed jobs.

## Quality gates

- Test valid archives, invalid types, ZIP bombs, path traversal, symlinks,
  oversized files, duplicate requests, and worker retries.
- Use mocked GitHub API/clone tests for inaccessible repositories and changed
  branches.
- Run a complete ZIP-to-`ready` integration test using private test storage.

## Definition of done

- An authenticated owner can submit a safe ZIP, receive a job ID immediately,
  observe status changes, and see a persisted source manifest.
- Unsafe archives and unauthorized repositories are rejected without creating
  accessible files or leaking credentials.
