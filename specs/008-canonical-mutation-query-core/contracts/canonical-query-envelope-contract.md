# Contract: Canonical Query Envelope

## Purpose

Define a transport-neutral query request/response contract for canonical object and document/surface reads.

## Request Contract

Required:

- `workspaceId`
- `include` (non-empty list)

Optional:

- `documentId`
- `surfaceId`
- `filters.semanticRole`
- `filters.primaryContentKind`
- `filters.hasCapability`
- `filters.alias`
- `limit`
- `cursor`
- `bounds`

## Response Contract

Success envelope:

- `ok: true`
- `data` with only requested include resources
- optional `page.cursor`

Failure envelope:

- `ok: false`
- `code`
- `message`
- optional `path`
- optional `details`

## Rules

1. Include-driven partiality is mandatory; unrequested resource collections must not be returned.
2. Filter vocabulary is canonical-first (`semanticRole`, `primaryContentKind`, `hasCapability`, `alias`).
3. Pagination token is opaque and transport-neutral.
4. Query behavior must not depend on UI-only or CLI-only fields.
5. Document/surface load responses must keep canonical payload and canvas placement data consistent in the same envelope.

## Failure Contract

- unsupported include field: `INVALID_QUERY_INCLUDE`
- invalid filter payload: `INVALID_QUERY_FILTER`
- invalid bounds payload: `INVALID_QUERY_BOUNDS`
- invalid pagination cursor: `INVALID_QUERY_CURSOR`
- unresolved document/surface scope: `QUERY_SCOPE_NOT_FOUND`

