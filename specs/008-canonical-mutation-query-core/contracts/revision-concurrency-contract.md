# Contract: Revision and Concurrency

## Purpose

Define optimistic concurrency and revision append guarantees for canonical mutation execution.

## Concurrency Inputs

- `documentId`
- `baseRevision` (client-observed head token)

## Concurrency Outcomes

### Success

- `ok: true`
- `revision.before = baseRevision`
- `revision.after = nextHeadRevision`
- `changedSet` returned

### Conflict

- `ok: false`
- `code: VERSION_CONFLICT`
- `details.expected` (submitted base revision)
- `details.actual` (current head revision)
- no state write

## Revision Rules

1. Revision stream is document-scoped and append-only.
2. Accepted mutation batch increments revision exactly once.
3. Rejected or conflicted mutations never increment revision.
4. Mutation replay on same base revision and same operations must be deterministic.
5. Transport adapters may preserve existing metadata (`commandId`) but must not alter revision semantics.

## Failure Contract

- missing base revision: `VERSION_BASE_REQUIRED`
- stale base revision: `VERSION_CONFLICT`
- invalid revision token shape: `INVALID_REVISION_TOKEN`
- revision append failure: `REVISION_APPEND_FAILED`

