# Contract: Canonical Mutation Envelope

## Purpose

Define canonical mutation operations and standard mutation result semantics independent of transport adapters.

## Request Contract

Required:

- `workspaceId`
- `documentId`
- `baseRevision`
- `actor.kind`
- `actor.id`
- `operations` (non-empty, ordered)

Optional:

- `requestId`

## Operation Contract

Operation families:

- object core/content/capability update
- note body replace and block-level mutation (`insert`, `update`, `remove`, `reorder`)
- object relation mutation
- canvas node mutation (`move`, `reparent`, `create`, `remove`)

## Result Contract

Success envelope:

- `ok: true`
- `appliedOperations`
- `changedSet`
- `revision.before`
- `revision.after`

Failure envelope:

- `ok: false`
- `code`
- `message`
- optional `path`
- optional `details`

## Rules

1. Mutations are intent-driven; inference from arbitrary patch shape is not allowed.
2. Validation failures must be explicit and structured.
3. Successful mutation must append revision and return changed-set.
4. Failed mutation must not advance revision.
5. Note body block operations must use stable block ids and deterministic ordering.
6. Content-kind/capability boundary violations must be rejected, never silently dropped.
7. Editable note-like sharing without clone path must be rejected.

## Failure Contract

- invalid mutation operation: `INVALID_MUTATION_OPERATION`
- unsupported patch surface: `PATCH_SURFACE_VIOLATION`
- invalid capability key/payload: `INVALID_CAPABILITY`, `INVALID_CAPABILITY_PAYLOAD`
- content contract violation: `CONTENT_CONTRACT_VIOLATION`
- invalid content block payload: `INVALID_CONTENT_BLOCK`
- content body conflict: `CONTENT_BODY_CONFLICT`
- clone requirement violation: `EDITABLE_OBJECT_REQUIRES_CLONE`
- relation endpoint violation: `RELATION_ENDPOINT_MISSING`
- canvas boundary violation: `CANONICAL_CANVAS_BOUNDARY_VIOLATION`

