# Pane Context Menu 작업 테스크

## 선행 게이트

- `shell-adapter-boundary`가 pane fixed slot과 context-menu binding을 먼저 열어야 한다.

## Phase 1. Feature contribution

- [ ] T001 Create `app/features/canvas-ui-entrypoints/pane-context-menu/types.ts` to define pane-specific context snapshots and action contracts.
- [ ] T002 Create `app/features/canvas-ui-entrypoints/pane-context-menu/buildPaneMenuContext.ts` to build empty-surface context from runtime snapshots.
- [ ] T003 [P] Create `app/features/canvas-ui-entrypoints/pane-context-menu/paneMenuItems.ts` to define pane-owned item inventory and ordering.
- [ ] T004 Create `app/features/canvas-ui-entrypoints/pane-context-menu/contribution.ts` to export the fixed-slot pane contribution consumed by `canvas-runtime`.
- [ ] T005 Create `app/features/canvas-ui-entrypoints/pane-context-menu/index.ts` to export the slice public surface.

## Phase 2. Action contract alignment

- [ ] T006 Update `app/features/editing/actionRoutingBridge/registry.ts` and `app/features/editing/actionRoutingBridge/types.ts` only if pane menu adds new surface-level actions beyond `node.create` and runtime view callbacks.
- [ ] T007 Update `app/types/contextMenu.ts` only if pane-specific context fields need shared type support after shell-boundary adoption.

## Phase 3. Verification

- [ ] T008 [P] Add `app/features/canvas-ui-entrypoints/pane-context-menu/paneMenuItems.test.ts` for pane-only item gating coverage.
- [ ] T009 Add `app/features/canvas-ui-entrypoints/pane-context-menu/contribution.test.ts` to verify the fixed-slot contribution shape and empty-surface assumptions.

## 의존성 메모

- T001 should land before T002-T005.
- T002 and T003 can run in parallel after T001.
- T006-T007 depend on the pane action contract being fixed.
- T008-T009 can run in parallel once `paneMenuItems.ts` and `contribution.ts` are stable.

## 병렬 실행 예시

- T002 and T003 can run in parallel because they own different feature files.
- T008 and T009 can run in parallel after the feature contribution shape is fixed.

## 완료 판정

- pane menu는 fixed slot이 읽는 `contribution.ts`로 runtime에 붙는다.
- pane lane은 `useContextMenu.ts`, `GraphCanvas.tsx`, `WorkspaceClient.tsx`를 기본 수정 경로로 사용하지 않는다.
- pane menu item inventory가 node menu와 분리된 feature-owned registry로 남는다.
