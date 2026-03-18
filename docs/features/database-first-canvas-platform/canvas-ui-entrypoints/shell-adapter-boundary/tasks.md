# Shell Adapter Boundary 작업 테스크

## 선행 게이트

- `entrypoint-foundation`의 overlay host, selection resolver, action routing, runtime state contract가 준비돼 있어야 한다.
- 이 slice는 후속 surface lane이 시작되기 전에 먼저 완료하는 것을 권장한다.

## Phase 1. Runtime contract와 fixed slot

- [X] T001 Create `app/features/canvas-ui-entrypoints/contracts.ts` and `app/processes/canvas-runtime/types.ts` to define stable entrypoint create/surface contracts plus `CanvasRuntimeContribution`, slot contracts, and binding contracts.
- [X] T002 Create `app/processes/canvas-runtime/createCanvasRuntime.ts` to compose built-in surface contributions into one runtime object.
- [X] T003 [P] Create `app/processes/canvas-runtime/builtin-slots/canvasToolbar.ts` as the fixed toolbar slot entry.
- [X] T004 [P] Create `app/processes/canvas-runtime/builtin-slots/selectionFloatingMenu.ts` as the fixed selection-floating-menu slot entry.
- [X] T005 [P] Create `app/processes/canvas-runtime/builtin-slots/paneContextMenu.ts` as the fixed pane-context-menu slot entry.
- [X] T006 [P] Create `app/processes/canvas-runtime/builtin-slots/nodeContextMenu.ts` as the fixed node-context-menu slot entry.
- [X] T007 Create placeholder `contribution.ts` exports in `app/features/canvas-ui-entrypoints/{canvas-toolbar,selection-floating-menu,pane-context-menu,node-context-menu}/` so later lanes fill their own fixed paths without touching a central registry.

## Phase 2. Shared shell binding

- [X] T008 Create `app/processes/canvas-runtime/bindings/graphCanvasHost.ts` to isolate `GraphCanvas` host-level event and slot consumption.
- [X] T009 Create `app/processes/canvas-runtime/bindings/toolbarPresenter.ts` to isolate `FloatingToolbar` presenter inputs.
- [X] T010 Create `app/processes/canvas-runtime/bindings/contextMenu.ts` to isolate pane/node registry resolution from `useContextMenu.ts`.
- [X] T011 Create `app/processes/canvas-runtime/bindings/actionDispatch.ts` to isolate surface dispatch wiring from `WorkspaceClient.tsx`.

## Phase 3. One-time adoption into shared shell files

- [X] T012 Refactor `app/components/GraphCanvas.tsx` to consume `app/processes/canvas-runtime/bindings/graphCanvasHost.ts` instead of growing direct surface branching.
- [X] T013 Refactor `app/components/FloatingToolbar.tsx` to consume `app/processes/canvas-runtime/bindings/toolbarPresenter.ts` as a presenter boundary.
- [X] T014 Refactor `app/hooks/useContextMenu.ts` to consume `app/processes/canvas-runtime/bindings/contextMenu.ts` instead of owning pane/node inventories directly.
- [X] T015 Refactor `app/components/editor/WorkspaceClient.tsx` to consume `app/processes/canvas-runtime/bindings/actionDispatch.ts` instead of accumulating surface-specific dispatch wiring inline.

## Phase 4. Verification

- [X] T016 [P] Add `app/processes/canvas-runtime/createCanvasRuntime.test.ts` for slot composition and no-op placeholder coverage.
- [X] T017 [P] Add `app/processes/canvas-runtime/bindings/contextMenu.test.ts` for pane/node registry isolation coverage.
- [X] T018 Update `app/components/GraphCanvas.test.tsx` to verify host binding adoption preserves selection anchor and context-menu lifecycle behavior.
- [X] T019 Update `app/components/FloatingToolbar.test.tsx` to verify presenter binding adoption preserves runtime-state behavior.
- [X] T020 Update `app/hooks/useContextMenu.test.ts` and `app/components/editor/WorkspaceClient.test.tsx` to verify registry/dispatch binding adoption.

## 의존성 메모

- T001 should land before T002-T011.
- T003-T007 can run in parallel because they own different slot or placeholder files.
- T012-T015 depend on T008-T011.
- 후속 `canvas-toolbar`, `selection-floating-menu`, `pane-context-menu`, `node-context-menu` 작업은 T003-T015 이후 진행하는 편이 안전하다.

## 병렬 실행 예시

- T003-T006 can run in parallel because each owns a different fixed slot file.
- T008-T011 can run in parallel because each owns a different binding file.
- T016-T017 can run in parallel with T012-T015 once the runtime contract is stable.

## 완료 판정

- shared shell hot spot이 `processes/canvas-runtime`와 fixed slot 구조로 흡수된다.
- 후속 surface task 문서가 `GraphCanvas.tsx`, `FloatingToolbar.tsx`, `useContextMenu.ts`, `WorkspaceClient.tsx`를 기본 수정 경로로 두지 않는다.
