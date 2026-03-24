# Canvas Toolbar 작업 테스크

## 선행 게이트

- `shell-adapter-boundary`가 `processes/canvas-runtime`와 fixed slot 구조를 먼저 열어야 한다.
- `selection-floating-menu`와 겹치는 selection-owned preset 책임은 toolbar에서 확장하지 않는다.

## Phase 1. Feature contribution

- [X] T001 Create `app/features/canvas-ui-entrypoints/canvas-toolbar/types.ts` to define toolbar section ids, action kinds, and disabled-reason contracts.
- [X] T002 [P] Create `app/features/canvas-ui-entrypoints/canvas-toolbar/toolbarSections.ts` to define global toolbar section inventory and ordering.
- [X] T003 [P] Create `app/features/canvas-ui-entrypoints/canvas-toolbar/toolbarActions.ts` to normalize interaction, create, and viewport callbacks behind toolbar action contracts.
- [X] T004 Create `app/features/canvas-ui-entrypoints/canvas-toolbar/toolbarModel.ts` to derive renderable toolbar sections from runtime state and dispatch bindings.
- [X] T005 Create `app/features/canvas-ui-entrypoints/canvas-toolbar/contribution.ts` to export the toolbar fixed-slot contribution consumed by `processes/canvas-runtime`.
- [X] T006 Create `app/features/canvas-ui-entrypoints/canvas-toolbar/index.ts` to export the slice public surface.

## Phase 2. Intent alignment

- [X] T007 Update `app/features/editing/actionRoutingBridge/registry.ts` only if toolbar quick actions need additional runtime-only or mutation-backed intent coverage in the actual `routeIntent` path.
- [X] T008 Update `app/features/editing/actionRoutingBridge/types.ts` only if toolbar quick actions require new runtime-only action ids or payload contracts.

## Phase 3. Verification

- [X] T009 [P] Add `app/features/canvas-ui-entrypoints/canvas-toolbar/toolbarModel.test.ts` for active-state, disabled-rule, and section-order coverage.
- [X] T010 Add `app/features/canvas-ui-entrypoints/canvas-toolbar/contribution.test.ts` to verify the fixed-slot contribution shape stays compatible with `canvas-runtime`.

## 의존성 메모

- T001 should land before T002-T006.
- T002-T004 can run in parallel after T001.
- T007-T008 depend on the toolbar action contract being fixed.
- T009-T010 can run in parallel with T007-T008 once `contribution.ts` is stable.

## 병렬 실행 예시

- T002 and T003 can run in parallel because they own different feature files.
- T009 and T010 can run in parallel after `toolbarModel.ts` and `contribution.ts` are stable.

## 완료 판정

- toolbar는 fixed slot이 읽는 `contribution.ts`로 runtime에 붙는다.
- toolbar lane은 `GraphCanvas.tsx`, `FloatingToolbar.tsx`, `WorkspaceClient.tsx`를 기본 수정 경로로 사용하지 않는다.
- selection-owned preset/control이 toolbar 책임으로 다시 확장되지 않는다.
