# Node Context Menu 작업 테스크

## 선행 게이트

- `shell-adapter-boundary`가 node fixed slot과 context-menu binding을 먼저 열어야 한다.
- node menu는 renderer alias가 아니라 canonical metadata 기준으로 노출되어야 한다.

## Phase 1. Feature contribution

- [ ] T001 Create `app/features/canvas-ui-entrypoints/node-context-menu/types.ts` to define node context snapshots, relation summary types, and disabled-reason contracts.
- [ ] T002 Create `app/features/canvas-ui-entrypoints/node-context-menu/buildNodeRelationSummary.ts` to calculate parent/container/group/mindmap relation facts for node-menu gating.
- [ ] T003 Create `app/features/canvas-ui-entrypoints/node-context-menu/buildNodeContextMenuModel.ts` to derive enabled, disabled, and hidden node actions from canonical metadata plus relation summary.
- [ ] T004 [P] Create `app/features/canvas-ui-entrypoints/node-context-menu/nodeMenuItems.ts` to define node-owned item inventory and ordering.
- [ ] T005 Create `app/features/canvas-ui-entrypoints/node-context-menu/contribution.ts` to export the fixed-slot node-menu contribution consumed by `canvas-runtime`.
- [ ] T006 Create `app/features/canvas-ui-entrypoints/node-context-menu/index.ts` to export the slice public surface.

## Phase 2. Structural action alignment

- [ ] T007 Update `app/components/editor/workspaceEditUtils.ts` to expose any additional canonical metadata and relation facts required by node-menu gating.
- [ ] T008 Update `app/features/editing/actionRoutingBridge/registry.ts` and `app/features/editing/actionRoutingBridge/types.ts` to add or explicitly defer duplicate/delete/lock/group actions without local mutation fallbacks.
- [ ] T009 Update `app/types/contextMenu.ts` only if richer node context fields are still needed after shell-boundary adoption.

## Phase 3. Verification

- [ ] T010 [P] Add `app/features/canvas-ui-entrypoints/node-context-menu/buildNodeContextMenuModel.test.ts` for canonical metadata and relation-summary gating coverage.
- [ ] T011 Add `app/features/canvas-ui-entrypoints/node-context-menu/contribution.test.ts` to verify the fixed-slot contribution shape and structural gating behavior.

## 의존성 메모

- T001 should land before T002-T006.
- T002-T004 can run in parallel after T001.
- T007-T009 depend on the node context model being fixed.
- T010-T011 can run in parallel once `buildNodeContextMenuModel.ts` and `contribution.ts` are stable.

## 병렬 실행 예시

- T002 and T004 can run in parallel because they own different feature files.
- T010 and T011 can run in parallel after the feature contribution shape is fixed.

## 완료 판정

- node menu는 fixed slot이 읽는 `contribution.ts`로 runtime에 붙는다.
- node menu 노출 기준이 canonical metadata + relation context로 바뀐다.
- node lane은 `GraphCanvas.tsx`, `useContextMenu.ts`, `WorkspaceClient.tsx`를 기본 수정 경로로 사용하지 않는다.
