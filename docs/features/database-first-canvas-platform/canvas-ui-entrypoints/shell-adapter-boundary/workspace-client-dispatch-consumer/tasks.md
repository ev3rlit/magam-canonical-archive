# Workspace Client Dispatch Consumer 작업 테스크

## 선행 게이트

- `shell-adapter-boundary`의 runtime slot/intents contract가 준비돼 있어야 한다.
- `actionDispatch.ts`가 runtime binding entrypoint로 고정돼 있어야 한다.

## Phase 1. Dispatch binding 도입

- [X] T001 Create `app/processes/canvas-runtime/bindings/actionDispatch.ts` to own surface normalization, envelope meta resolution, and route-intent orchestration.
- [X] T002 Refactor `app/components/editor/WorkspaceClient.tsx` to create `createCanvasActionDispatchBinding(...)` instead of owning bridge orchestration inline.
- [X] T003 Refactor `WorkspaceClient` commit handlers to consume `resolveLegacyEntrypointSurface(...)` and the shared dispatch binding instead of hand-rolling surface normalization.

## Phase 2. Verification

- [X] T004 Update `app/components/editor/WorkspaceClient.test.tsx` to verify dispatch binding adoption preserves bridge behavior and error handling.

## 완료 판정

- `WorkspaceClient.tsx`는 dispatch consumer 역할만 남긴다.
- surface-specific dispatch policy는 `actionDispatch.ts`를 통해서만 확장된다.
