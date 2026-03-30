# Selection Floating Menu 작업 테스크

## 선행 게이트

- `shell-adapter-boundary`가 selection fixed slot과 dispatch binding을 먼저 열어야 한다.
- toolbar lane은 selection-owned preset/control을 새로 늘리지 않는다.

## Phase 1. Feature model과 slot contract

- [X] T001 Create `app/features/canvas-ui-entrypoints/selection-floating-menu/types.ts` to define selection summary, control ids, and disabled-reason contracts.
- [X] T002 Create `app/features/canvas-ui-entrypoints/selection-floating-menu/selectionModel.ts` to derive homogeneous selection state, metadata summary, and control visibility from runtime snapshots.
- [X] T003 [P] Create `app/features/canvas-ui-entrypoints/selection-floating-menu/controlInventory.ts` to define v1 control ordering, overflow grouping, and ownership boundaries.
- [X] T004 Create `app/features/canvas-ui-entrypoints/selection-floating-menu/SelectionFloatingMenu.tsx` to render the high-frequency direct-edit action bar from selection model state and bridge-capable action handlers.
- [X] T005 Create `app/features/canvas-ui-entrypoints/selection-floating-menu/contribution.ts` to export fixed-slot `selectionMenuItems` and any slot-scoped `intents` consumed by `canvas-runtime`.

## Phase 2. Host binding adoption

- [X] T006 Update `app/processes/canvas-runtime/bindings/graphCanvasHost.ts` to assemble, open, replace, and close the selection floating menu overlay contribution from selection slot items, selection anchors, and `SelectionFloatingMenu.tsx`.
- [X] T007 Update `app/processes/canvas-runtime/types.ts` only if selection slot item metadata must grow beyond `itemId` / `intentId` / `label` / `order`, and do not widen the runtime contract to carry overlay renderers by default.

## Phase 3. Action routing integration

- [X] T008 Update `app/processes/canvas-runtime/bindings/actionDispatch.ts`, `app/features/editing/actionRoutingBridge/registry.ts`, and `app/features/editing/actionRoutingBridge/types.ts` to cover all floating-menu-owned intents without local mutation fallbacks.
- [X] T009 Update `app/components/editor/workspaceEditUtils.ts` only if additional selection metadata summary is required by floating-menu gating.

## Phase 4. Ownership handoff from toolbar

- [X] T010 Update selection-floating-menu feature files plus `app/processes/canvas-runtime/bindings/toolbarPresenter.ts` only if selection-owned preset/control handoff cannot be finished inside feature-owned model and host binding.
- [X] T011 Add explicit placeholder or full bridge-backed support for object-type conversion in selection-floating-menu feature files, and extend `app/processes/canvas-runtime/bindings/actionDispatch.ts` only when a new compat intent mapping is actually introduced.

## Phase 5. Verification

- [X] T012 [P] Add `app/features/canvas-ui-entrypoints/selection-floating-menu/selectionModel.test.ts` for homogeneous gating and control visibility coverage.
- [X] T013 Add `app/features/canvas-ui-entrypoints/selection-floating-menu/contribution.test.ts` to verify the fixed-slot `selectionMenuItems` / `intents` shape and selection gating behavior.
- [X] T014 Update `app/components/GraphCanvas.test.tsx` or add `app/processes/canvas-runtime/bindings/graphCanvasHost.test.ts` to verify selection floating menu host binding open/replace/close behavior and selection anchor lifecycle.

## 의존성 메모

- T001 should land before T002-T005.
- T003 and T004 can run in parallel after T001.
- T006-T009 depend on the feature model and slot contract being fixed.
- T010-T011 depend on host binding and action routing boundaries being clear.
- T012-T014 can run in parallel once `selectionModel.ts`, `contribution.ts`, and host binding adoption are stable.

## 병렬 실행 예시

- T003 and T004 can run in parallel because they own different feature files.
- T012 and T013 can run in parallel after the feature contribution shape is fixed.

## 완료 판정

- floating menu inventory는 fixed slot이 읽는 `contribution.ts`로 runtime에 등록되고, 실제 overlay body는 host binding이 mount한다.
- style/content action은 `actionDispatch.ts`와 shared bridge 경로로만 실행된다.
- selection-floating-menu lane의 기본 shared touch point는 `graphCanvasHost.ts`, `actionDispatch.ts`, `toolbarPresenter.ts`이며, `GraphCanvas.tsx`, `FloatingToolbar.tsx`, `WorkspaceClient.tsx`는 기본 수정 경로로 사용하지 않는다.
