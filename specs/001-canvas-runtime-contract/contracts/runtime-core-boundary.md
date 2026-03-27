# Runtime Core Boundary

## Published Language Boundary

The shared runtime publishes only framework-neutral language:

- runtime core model
- hierarchy projection
- render projection
- editing projection
- command vocabulary
- aggregate events
- application/control events
- mutation result / dry-run / conflict / history semantics

## Ownership

- `Canvas Runtime` is the core domain.
- `Canvas Aggregate` and `Canonical Object Aggregate` stay inside the same bounded context.
- UI, CLI, and future MCP are downstream consumers.
- persistence stays outside the bounded context behind repository translation.

## Implementation Boundary

- new shared code lives under `libs/shared/src/lib/canvas-runtime/`
- `libs/shared/src/lib/canonical-persistence/` remains the repository translation boundary
- `canonical-query` and `canonical-mutation` become internal helpers, not published language

## Forbidden Leaks

The shared runtime contract must not expose:

- raw DB rows
- Drizzle schema types
- ReactFlow nodes or edges
- JSON-RPC request or response shapes
- compatibility file patch payloads
- transport-specific command grammar

## Migration Checkpoints

1. shared runtime exports compile without app imports
2. repository is the only layer reading storage rows directly
3. app adapters import runtime DTOs, not vice versa

## Implementation Notes

- `libs/shared/src/lib/canvas-runtime/` now owns the published contracts, projection builders, mutation envelope helpers, history normalization helpers, and runtime dispatcher surface.
- `libs/shared/src/lib/canonical-query/render-canvas.ts` now hydrates shared render/editing projections alongside the legacy compatibility graph so adapters can migrate without a big-bang renderer rewrite.
- `app/ws/methods.ts` now exposes `canvas.runtime.mutate` so adapter-side intent routing can submit published runtime batches before replaying compatibility patches.
- `libs/shared/src/index.ts` no longer re-exports `canonical-query` or `canonical-mutation`; those modules remain internal implementation detail behind runtime adapters.
