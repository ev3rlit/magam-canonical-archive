# Write Result, Conflict, And History Contract

## Shared Mutation Result Family

Every write surface returns one shared family containing:

- success or failure
- version boundary
- changed set
- warnings and diagnostics
- structured error code
- retryable metadata
- optional history metadata

## Dry-Run

- dry-run is a runtime contract feature, not a UI-only helper
- uses the same result family as committed writes
- computes validation and changed-set preview without persistence

## Conflict Envelope

- version mismatch returns structured conflict metadata
- adapters must not invent separate conflict formats
- retry policy stays above the runtime, but conflict vocabulary stays inside the runtime contract

## History

- successful semantic mutation batches produce normalized history entries
- replay stores canonical commands, not raw UI payloads
- body block replay uses `blockId` targets plus resolved placement
- undo/redo is revision-aware and fails explicitly on stale revisions

## Current Hotspots To Retire As Owners

- `app/hooks/useCanvasRuntime.ts`
- `app/ws/methods.ts`
- any UI-specific optimistic replay logic that infers history semantics without runtime output
