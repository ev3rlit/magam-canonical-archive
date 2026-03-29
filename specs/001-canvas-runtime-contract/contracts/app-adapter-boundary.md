# App Adapter Boundary

## Target Responsibility By File

### `app/components/GraphCanvas.tsx`

- render projection consumer
- input capture
- command emit adapter
- no shared ownership of editability or history semantics

### `app/features/editor/pages/CanvasEditorPage.tsx`

- thin screen composition
- workspace/session wiring
- adapter orchestration
- no shared ownership of runtime meaning

### `app/hooks/useCanvasRuntime.ts`

- WebSocket transport adapter
- runtime query/mutation/result serialization
- no transport-owned contract vocabulary

### `app/ws/methods.ts`

- JSON-RPC adapter delegating to runtime application services
- no direct ownership of runtime command semantics
- no storage-language leakage above repository translation

### `app/features/render/parseRenderGraph.ts`

- renderer-specific mapping from render projection to ReactFlow payload
- no ownership of shared projection semantics

### `app/features/editing/editability.ts`

- temporary UI helper until editing projection is authoritative
- logic migrates into shared runtime or shared domain helpers

### `app/features/editing/commands.ts` and `actionRoutingBridge/*`

- adapter intent normalization
- maps UI actions to published runtime commands
- should not become the runtime command source of truth

## Non-Goals

- full React editor refactor completion
- deleting all legacy adapter helpers in one phase
- promoting ReactFlow or JSON-RPC shapes into shared runtime contracts

## Validation Status

- `actionRoutingBridge/*`, `CanvasEditorPage.tsx`, and `useCanvasRuntime.ts` now emit shared runtime command batches for migrated create/move/style/content/delete/reparent/z-order flows.
- `canvas.runtime.mutate` in `app/ws/methods.ts` is the transport adapter for published runtime batches; compatibility AST patching remains local to the WS adapter.
- Legacy-only flows such as group membership and identifier rename remain explicit compatibility paths until the shared runtime vocabulary grows to cover them.
- Follow-up gap: the repo still has unrelated type drift in `app/features/canvas-ui-entrypoints/*`, so full app-wide typecheck is not yet a reliable contract gate for this feature slice.
