# Phase 1: Security

## Purpose

Phase 0 has established the local development setup. Phase 1 makes the
platform safe to use by introducing identity, ownership, configuration
validation, and a small but reliable project API. No codebase can be uploaded
or analysed until the caller is authenticated and every resource has an owner.

## Outcomes

At the end of this phase, a user can sign in with GitHub through Supabase,
reach a protected application area, and call the gateway with a verified
Supabase access token. The gateway can create and return only that user's
projects. Public health checks remain unauthenticated.

## Scope

### Authentication and sessions

- Use Supabase Auth as the identity system and GitHub as the initial OAuth
  provider.
- Build a frontend Supabase client from `VITE_SUPABASE_URL` and
  `VITE_SUPABASE_ANON_KEY`. Never expose service-role, database, LLM, or
  GitHub client-secret values to the browser.
- Add `/login` and `/auth/callback` routes. The login page starts the GitHub
  OAuth redirect; the callback completes the session and redirects to `/app`.
- Add an application-level auth provider or Zustand store which loads the
  initial session, listens for auth-state changes, refreshes UI state, and
  supports sign-out.
- Add protected frontend routes. While the session is unknown, show a loading
  state; redirect unauthenticated users to `/login`.
- Send the Supabase access token on every gateway request as
  `Authorization: Bearer <token>`.

### Gateway verification and authorization

- Create a Supabase server client using `SUPABASE_URL` and the server-only
  service-role key. Validate the bearer token for every protected route and
  attach a normalized user record to `req.user`.
- Return consistent `401` responses for absent, malformed, expired, or invalid
  tokens and `403` for authenticated users without access to a resource.
- Add `GET /api/auth/me` so the frontend can verify the gateway contract.
- Add a project route group with the minimum contract:

```text
POST /api/projects
GET  /api/projects
GET  /api/projects/:projectId
```

- Use the Supabase user ID as the immutable `owner_id`. Every project lookup
  and later child resource lookup must include that ownership filter.
- Keep `/health` and API documentation public. Do not put OAuth callback or
  health endpoints behind bearer-token middleware.

### Data and configuration baseline

- Create migrations for `projects`, `audit_events`, and a minimal `profiles`
  record linked to the Supabase user ID. Store created/updated timestamps,
  project status, and the selected source type; do not store OAuth tokens in
  these tables.
- Validate required environment variables at service startup. Fail fast with
  names of missing variables, never their values.
- Configure CORS from an allow-list (`FRONTEND_URL` and production URL), set
  JSON/body size limits, add request IDs, and redact authorization headers
  from logs.
- Establish a single error response envelope shared by the gateway and
  frontend client.

## GitHub access boundary

GitHub sign-in identifies a user. It is not automatically a repository-import
authorization design. If Phase 2 needs private repositories, add an explicit
GitHub integration with narrowly scoped permissions, encrypted server-side
token storage, token revocation, and repository permission checks. Do not
reuse a browser-visible token as a durable GitHub credential.

## Quality gates

- Unit tests cover missing/invalid/valid bearer tokens and ownership checks.
- Frontend tests cover login redirect, callback handling, protected-route
  redirects, session restoration, and logout.
- Integration tests prove `GET /api/auth/me` and protected project endpoints
  reject unauthenticated calls and accept a valid test user.
- Add CI jobs for frontend lint/build, gateway tests, Python lint/tests, and
  secret scanning. Block merges on failures.

## Definition of done

- A user can sign in with GitHub, refresh the browser, call `/api/auth/me`,
  create a project, and sign out.
- A different user cannot read or modify that project by guessing its ID.
- Secrets are not in tracked files or frontend bundles, and CI proves the
  basic authentication and ownership flow.
