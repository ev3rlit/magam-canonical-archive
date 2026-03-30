# Node Context Menu 작업 테스크

## 선행 게이트

- `shell-adapter-boundary`가 node fixed slot과 context-menu binding을 먼저 열어야 한다.
- node menu는 renderer alias가 아니라 canonical metadata 기준으로 노출되어야 한다.

## Phase 1. Feature contribution

- [X] T001 Create `app/features/canvas-ui-entrypoints/node-context-menu/types.ts` to define node context snapshots, relation summary types, and disabled-reason contracts.
- [X] T002 Create `app/features/canvas-ui-entrypoints/node-context-menu/buildNodeRelationSummary.ts` to calculate parent/container/group/mindmap relation facts for node-menu gating.
- [X] T003 Create `app/features/canvas-ui-entrypoints/node-context-menu/buildNodeContextMenuModel.ts` to derive enabled, disabled, and hidden node actions from canonical metadata plus relation summary.
- [X] T004 [P] Create `app/features/canvas-ui-entrypoints/node-context-menu/nodeMenuItems.ts` to define node-owned item inventory and ordering.
- [X] T005 Create `app/features/canvas-ui-entrypoints/node-context-menu/contribution.ts` to export the fixed-slot node-menu contribution consumed by `canvas-runtime`.
- [X] T006 Create `app/features/canvas-ui-entrypoints/node-context-menu/index.ts` to export the slice public surface.

## Phase 2. Structural action alignment

- [X] T007 Update `app/components/editor/workspaceEditUtils.ts` to expose any additional canonical metadata and relation facts required by node-menu gating.
- [X] T008 Update `app/features/editing/actionRoutingBridge/registry.ts` and `app/features/editing/actionRoutingBridge/types.ts` to add or explicitly defer duplicate/delete/lock/group actions without local mutation fallbacks.
- [X] T009 Update `app/types/contextMenu.ts` only if richer node context fields are still needed after shell-boundary adoption.

## Phase 3. Verification

- [X] T010 [P] Add `app/features/canvas-ui-entrypoints/node-context-menu/buildNodeContextMenuModel.test.ts` for canonical metadata and relation-summary gating coverage.
- [X] T011 Add `app/features/canvas-ui-entrypoints/node-context-menu/contribution.test.ts` to verify the fixed-slot contribution shape and structural gating behavior.

## Phase 4. Deferred structural action completion

- [X] T012 Update `app/features/editing/actionRoutingBridge/registry.ts` and related bridge contracts to implement `node.duplicate` without local mutation fallback.
- [X] T013 Update `app/features/editing/actionRoutingBridge/registry.ts`, mutation dispatch descriptors, and runtime bindings to implement `node.delete` through canonical mutation/query ownership.
- [X] T014 Update node context menu gating and runtime action contracts to implement `node.lock.toggle` instead of keeping it as a deferred placeholder.
- [X] T015 Update node context menu gating and selection/runtime bindings to implement `node.group.select` as a real low-frequency structural action.
- [X] T016 [P] Add regression tests covering the newly implemented duplicate/delete/lock/group node-menu actions across `app/features/canvas-ui-entrypoints/node-context-menu/**`, `app/features/editing/actionRoutingBridge/**`, and runtime bindings.

## 의존성 메모

- T001 should land before T002-T006.
- T002-T004 can run in parallel after T001.
- T007-T009 depend on the node context model being fixed.
- T010-T011 can run in parallel once `buildNodeContextMenuModel.ts` and `contribution.ts` are stable.
- T012-T015 depend on the deferred bridge contract from T008 being replaced with real intent ownership.
- T016 depends on T012-T015.

## 병렬 실행 예시

- T002 and T004 can run in parallel because they own different feature files.
- T010 and T011 can run in parallel after the feature contribution shape is fixed.
- T012-T015 should run sequentially if they touch the same bridge/runtime ownership files.

## 완료 판정

- node menu는 fixed slot이 읽는 `contribution.ts`로 runtime에 붙는다.
- node menu 노출 기준이 canonical metadata + relation context로 바뀐다.
- node lane은 `GraphCanvas.tsx`, `useContextMenu.ts`, `WorkspaceClient.tsx`를 기본 수정 경로로 사용하지 않는다.
- duplicate/delete/lock/group action은 deferred placeholder가 아니라 실제 bridge/runtime contract로 연결된다.
