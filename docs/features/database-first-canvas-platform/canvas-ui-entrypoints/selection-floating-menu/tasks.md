# Selection Floating Menu 작업 테스크

## 선행 게이트

- `shell-adapter-boundary`가 selection fixed slot과 dispatch binding을 먼저 열어야 한다.
- toolbar lane은 selection-owned preset/control을 새로 늘리지 않는다.

## Phase 1. Feature contribution

- [ ] T001 Create `app/features/canvas-ui-entrypoints/selection-floating-menu/types.ts` to define selection summary, control ids, and disabled-reason contracts.
- [ ] T002 Create `app/features/canvas-ui-entrypoints/selection-floating-menu/selectionModel.ts` to derive homogeneous selection state, metadata summary, and control visibility from runtime snapshots.
- [ ] T003 [P] Create `app/features/canvas-ui-entrypoints/selection-floating-menu/controlInventory.ts` to define v1 control ordering, overflow grouping, and ownership boundaries.
- [ ] T004 Create `app/features/canvas-ui-entrypoints/selection-floating-menu/SelectionFloatingMenu.tsx` to render the high-frequency direct-edit action bar.
- [ ] T005 Create `app/features/canvas-ui-entrypoints/selection-floating-menu/contribution.ts` to export the fixed-slot contribution consumed by `canvas-runtime`.

## Phase 2. Action routing integration

- [ ] T006 Update `app/features/editing/actionRoutingBridge/registry.ts` and `app/features/editing/actionRoutingBridge/types.ts` to cover all floating-menu-owned intents without local mutation fallbacks.
- [ ] T007 Update `app/components/editor/workspaceEditUtils.ts` only if additional selection metadata summary is required by floating-menu gating.

## Phase 3. Ownership handoff from toolbar

- [ ] T008 Update selection-floating-menu feature files to absorb selection-owned preset/control formerly exposed from toolbar.
- [ ] T009 Add explicit placeholder or full bridge-backed support for object-type conversion in `app/features/canvas-ui-entrypoints/selection-floating-menu/contribution.ts`.

## Phase 4. Verification

- [ ] T010 [P] Add `app/features/canvas-ui-entrypoints/selection-floating-menu/selectionModel.test.ts` for homogeneous gating and control visibility coverage.
- [ ] T011 Add `app/features/canvas-ui-entrypoints/selection-floating-menu/contribution.test.ts` to verify the fixed-slot contribution shape and selection gating behavior.

## 의존성 메모

- T001 should land before T002-T005.
- T003 and T004 can run in parallel after T001.
- T006-T009 depend on the feature contribution shape being fixed.
- T010-T011 can run in parallel once `selectionModel.ts` and `contribution.ts` are stable.

## 병렬 실행 예시

- T003 and T004 can run in parallel because they own different feature files.
- T010 and T011 can run in parallel after the feature contribution shape is fixed.

## 완료 판정

- floating menu는 fixed slot이 읽는 `contribution.ts`로 runtime에 붙는다.
- style/content action은 shared bridge 경로로만 실행된다.
- selection-floating-menu lane은 `GraphCanvas.tsx`, `FloatingToolbar.tsx`, `WorkspaceClient.tsx`를 기본 수정 경로로 사용하지 않는다.
