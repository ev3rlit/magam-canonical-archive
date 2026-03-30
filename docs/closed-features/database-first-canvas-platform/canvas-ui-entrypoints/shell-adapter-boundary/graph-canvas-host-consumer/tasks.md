# Graph Canvas Host Consumer 작업 테스크

## 선행 게이트

- `shell-adapter-boundary`의 runtime contract와 fixed slot이 먼저 준비돼 있어야 한다.
- `graphCanvasHost.ts`가 host binding entrypoint로 고정돼 있어야 한다.

## Phase 1. Host binding 도입

- [X] T001 Create `app/processes/canvas-runtime/bindings/graphCanvasHost.ts` to assemble toolbar contribution and context-menu action wiring for `GraphCanvas.tsx`.
- [X] T002 Refactor `app/components/GraphCanvas.tsx` to consume `createGraphCanvasContextMenuActions(...)` instead of building menu actions inline.
- [X] T003 Refactor `app/components/GraphCanvas.tsx` to consume `createGraphCanvasNodeContextMenu(...)` and `createGraphCanvasPaneContextMenu(...)` instead of owning raw context shape creation inline.
- [X] T004 Refactor `app/components/GraphCanvas.tsx` to consume `createGraphCanvasToolbarContribution(...)` instead of building toolbar overlay contribution inline.

## Phase 2. Verification

- [X] T005 Update `app/components/GraphCanvas.test.tsx` to verify host binding adoption preserves context-menu lifecycle and toolbar host behavior.

## 완료 판정

- `GraphCanvas.tsx`는 host consumer 역할만 남긴다.
- pane/node/toolbar wiring은 `graphCanvasHost.ts`를 통해서만 확장된다.
