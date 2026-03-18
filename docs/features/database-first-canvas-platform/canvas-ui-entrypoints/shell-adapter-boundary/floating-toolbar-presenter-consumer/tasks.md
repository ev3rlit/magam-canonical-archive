# Floating Toolbar Presenter Consumer 작업 테스크

## 선행 게이트

- `shell-adapter-boundary`의 toolbar slot과 runtime state contract가 준비돼 있어야 한다.
- `toolbarPresenter.ts`가 presenter policy binding으로 고정돼 있어야 한다.

## Phase 1. Presenter binding 도입

- [X] T001 Create `app/processes/canvas-runtime/bindings/toolbarPresenter.ts` to define derived presenter state and surface toggle helpers for `FloatingToolbar.tsx`.
- [X] T002 Refactor `app/components/FloatingToolbar.tsx` to consume `resolveToolbarPresenterState(...)` instead of calculating active/open state inline.
- [X] T003 Refactor `app/components/FloatingToolbar.tsx` to consume `toggleToolbarCreateSurface(...)` and `toggleToolbarPresetSurface(...)` instead of owning anchor/open-surface policy inline.
- [X] T004 Refactor `app/components/FloatingToolbar.tsx` to consume `selectToolbarInteractionMode(...)`, `selectToolbarCreateMode(...)`, and `selectToolbarPreset(...)` helper flows.

## Phase 2. Verification

- [X] T005 Update `app/components/FloatingToolbar.test.tsx` to verify presenter binding adoption preserves runtime-state integration behavior.

## 완료 판정

- `FloatingToolbar.tsx`는 presenter consumer 역할만 남긴다.
- toolbar open/close/state policy는 `toolbarPresenter.ts`를 통해서만 확장된다.
