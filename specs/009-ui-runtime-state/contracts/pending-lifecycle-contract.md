# Contract: Pending UI Action Lifecycle

## Purpose

Define optimistic runtime pending behavior for entrypoint surfaces and command feedback UI.

## Pending Keying

- Pending entries are keyed by request ID or command ID.
- Keys are unique while pending is active.

## Lifecycle States

- `pending`
- `committed`
- `failed`
- `rollback`

## Lifecycle Actions

1. `beginPendingAction(requestId, actionType, targetIds)`
2. `commitPendingAction(requestId)`
3. `failPendingAction(requestId, errorMessage)`
4. `clearPendingAction(requestId)`

## Rules

1. Begin requires non-empty request ID.
2. Commit/fail/rollback require an existing pending entry.
3. Clear must remove resolved entries to prevent stale UI disable/loading states.
4. Pending state is runtime-only and must not store long-lived mutation payload.
5. Failure transitions provide diagnostics linkage for UI feedback.

## UI Guarantees

- Consumer surfaces can disable duplicate actions while pending exists.
- Success/failure unblocks UI deterministically by clearing corresponding entry.
- Pending registry does not become an alternate mutation history store.
