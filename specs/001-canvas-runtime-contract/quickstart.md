# Quickstart: Canvas Runtime Contract

## Goal

새 runtime contract가 UI adapter, headless CLI adapter, future external client에서 같은 방식으로 읽기/쓰기/충돌 처리/히스토리 재생에 사용되는지 빠르게 검증한다.

## Preconditions

- shared runtime exports:
  - hierarchy projection reader
  - render projection reader
  - editing projection reader
  - command dispatcher
  - mutation result envelope
  - history undo/redo entrypoints
- repository translation remains behind `canonical-persistence`
- app adapters translate runtime DTOs to transport or renderer DTOs locally

## Flow 1: UI Adapter Reads Shared Projections

**Actor**: React UI adapter

1. Request hierarchy projection for a canvas.
2. Request render projection for the same canvas.
3. Request editing projection for the same canvas.
4. Map render projection into ReactFlow node/edge payload inside `parseRenderGraph.ts` or a successor adapter.
5. Use editing projection to decide:
   - allowed commands
   - editability
   - body entry mode
   - body block targeting metadata
6. Confirm `GraphCanvas` and `CanvasEditorPage` do not derive runtime ownership rules from local React-only metadata.

**Expected result**

- hierarchy/render/editing responsibilities stay separate.
- no raw DB rows or ReactFlow payloads are treated as the runtime contract.

## Flow 2: Headless Consumer Reads Structure And Plans A Mutation

**Actor**: Headless CLI or agent adapter

1. Request hierarchy projection for `canvasId`.
2. Traverse `roots[]` and locate target node or canonical object.
3. Request editing projection for the relevant node set.
4. Read block metadata:
   - `selectionKey`
   - `beforeAnchorId`
   - `afterAnchorId`
   - `index`
5. Compose one published command batch such as:
   - `canvas.node.move`
   - `object.content.update`
   - `object.body.block.insert`
   - `object.body.block.reorder`

**Expected result**

- consumer can author domain intent without raw DB patch syntax.
- consumer does not need renderer-specific or transport-specific grammar.

## Flow 3: Dry-Run Before Commit

**Actor**: UI or headless adapter

1. Submit `CanvasMutationBatchV1` with `dryRun: true`.
2. Include `preconditions.canvasRevision` when revision-aware behavior is needed.
3. Inspect the returned mutation result envelope.

**Expected result**

- response uses the same result family as committed writes.
- response includes validation outcome and changed-set preview.
- no state is persisted.

## Flow 4: Commit And Handle Conflict

**Actor**: UI or headless adapter

1. Submit the same command batch with `dryRun: false`.
2. If the write succeeds:
   - record `canvasRevisionBefore`
   - record `canvasRevisionAfter`
   - inspect `changed`
   - inspect `historyEntryId` and `undoable`
3. If the write fails with conflict:
   - inspect `error.code = VERSION_CONFLICT`
   - inspect expected vs actual revision metadata
   - reload projections
   - retry only if adapter policy allows it

**Expected result**

- optimistic UI and headless automation both use the same conflict vocabulary.
- conflict handling is not implemented as UI-only behavior.

## Flow 5: History Replay And Invalidate

**Actor**: UI adapter

1. Execute a successful mutation that changes node or object state.
2. Observe runtime application/control outputs:
   - mutation result envelope
   - `CanvasChanged`
3. Trigger undo using runtime history service.
4. Trigger redo using runtime history service.
5. Confirm replay uses canonical history form:
   - body block target by `blockId`
   - placement by resolved `start/end/before-block/after-block`
   - no raw selection/anchor/index persisted in replay artifact

**Expected result**

- invalidate/reload policy can be driven from runtime outputs rather than transport-specific heuristics.
- undo/redo fails explicitly on revision conflict instead of silently rebasing.

## Flow 6: Adapter Boundary Check

Review the following files after migration slices land:

- `app/hooks/useCanvasRuntime.ts`
- `app/ws/methods.ts`
- `app/features/editor/pages/CanvasEditorPage.tsx`
- `app/features/render/parseRenderGraph.ts`
- `app/features/editing/editability.ts`
- `app/components/GraphCanvas.tsx`

**Pass criteria**

- they consume runtime DTOs or translate them locally.
- they do not define published runtime ownership, history, or dry-run semantics themselves.
- ReactFlow, JSON-RPC, and file patch payloads stay local to app adapters.

## Verification Checklist

- hierarchy / render / editing projections are all exercised
- command dispatch uses published command names only
- dry-run and committed writes share one result family
- conflict envelope includes retryable metadata and version boundary
- history replay is canonicalized
- app adapters are thinner than before and no longer own runtime meaning

## Current Validation

- Verified with focused Bun suites for `app/ws/methods.ts`, `actionRoutingBridge/*`, `CanvasEditorPage.runtime.spec.tsx`, and `actionDispatch.test.ts`.
- `canvas.runtime.mutate` is the verified transport entrypoint for migrated editor command batches.
- Remaining gap: full monorepo typecheck still fails on unrelated canvas-ui-entrypoint typing drift outside this feature slice.
