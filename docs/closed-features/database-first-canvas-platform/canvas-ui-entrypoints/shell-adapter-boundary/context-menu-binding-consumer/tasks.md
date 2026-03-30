# Context Menu Binding Consumer 작업 테스크

## 선행 게이트

- `shell-adapter-boundary`의 pane/node slot이 준비돼 있어야 한다.
- `contextMenu.ts`가 runtime binding entrypoint로 고정돼 있어야 한다.

## Phase 1. Binding 도입

- [X] T001 Create `app/processes/canvas-runtime/bindings/contextMenu.ts` to resolve pane/node inventory, anchor, open-surface descriptor, and sanitized session state.
- [X] T002 Refactor `app/hooks/useContextMenu.ts` to consume `resolveCanvasContextMenuSession(...)` instead of importing and sanitizing pane/node inventories inline.
- [X] T003 Preserve overlay lifecycle ownership in `app/hooks/useContextMenu.ts` while moving registry/session assembly into the binding layer.

## Phase 2. Verification

- [X] T004 Add `app/processes/canvas-runtime/bindings/contextMenu.test.ts` for session resolution and registry isolation coverage.
- [X] T005 Update `app/hooks/useContextMenu.test.ts` to verify consumer adoption preserves dismiss behavior.

## 완료 판정

- `useContextMenu.ts`는 lifecycle consumer 역할만 남긴다.
- pane/node registry resolution은 `contextMenu.ts`를 통해서만 확장된다.
