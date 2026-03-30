# Keyboard Command Boundary 작업 테스크

## 선행 게이트

- `shell-adapter-boundary`가 먼저 완료돼 있어야 한다.
- `GraphCanvas.tsx`가 runtime binding consumer로 정리된 상태여야 한다.

## Phase 1. Keyboard contract와 registry

- [X] T001 Create `app/processes/canvas-runtime/keyboard/types.ts` to define normalized key chord, command, key binding, feedback, and trace contracts.
- [X] T002 Create `app/processes/canvas-runtime/keyboard/normalizeKeyEvent.ts` to normalize DOM keyboard events into platform-safe key chords.
- [X] T003 Create `app/processes/canvas-runtime/keyboard/keymap.ts` to resolve default keyboard shortcuts from key chords into command ids.
- [X] T004 Create `app/processes/canvas-runtime/keyboard/commands.ts` to define clipboard/history/navigation/tool-selection commands without direct DOM branching.
- [X] T005 Create `app/processes/canvas-runtime/keyboard/dispatchKeyCommand.ts` to orchestrate `when`, `execute`, feedback, and trace handling from a resolved command id.

## Phase 2. Feedback / tracing boundary

- [X] T006 [P] Create `app/processes/canvas-runtime/keyboard/feedback.ts` to resolve command feedback payloads into host-consumable toast/message events.
- [X] T007 [P] Create `app/processes/canvas-runtime/keyboard/trace.ts` to emit structured keyboard trace events through a `pino` child logger instead of ad-hoc `console.*` calls.
- [X] T008 Create `app/processes/canvas-runtime/bindings/keyboardHost.ts` to assemble keyboard context, dispatcher, feedback, and tracing for `GraphCanvas.tsx`.

## Phase 3. Shared shell adoption

- [X] T009 Refactor `app/components/GraphCanvas.tsx` to consume `app/processes/canvas-runtime/bindings/keyboardHost.ts` instead of owning keyboard command branching inline.
- [X] T010 Refactor keyboard-specific toast string handling in `app/components/GraphCanvas.tsx` to consume feedback message keys/payloads from the keyboard boundary.
- [X] T011 Refactor keyboard-specific `console.log` / `console.debug` / `console.error` usage in `app/components/GraphCanvas.tsx` to consume structured keyboard trace helpers.

## Phase 4. Verification

- [X] T012 [P] Add `app/processes/canvas-runtime/keyboard/normalizeKeyEvent.test.ts` for cross-platform chord normalization coverage.
- [X] T013 [P] Add `app/processes/canvas-runtime/keyboard/keymap.test.ts` for command id lookup and remapping coverage.
- [X] T014 [P] Add `app/processes/canvas-runtime/keyboard/dispatchKeyCommand.test.ts` for execute/skip/failure/feedback/trace orchestration coverage.
- [X] T015 [P] Add `app/processes/canvas-runtime/keyboard/trace.test.ts` for `pino` trace adapter field mapping and outcome-level coverage.
- [X] T016 Update `app/components/GraphCanvas.test.tsx` to verify keyboard host adoption preserves undo/redo/clipboard behavior without direct key-specific branching.

## 의존성 메모

- T001 should land before T002-T008.
- T002-T004 can progress in parallel once T001 is fixed because they own different keyboard modules.
- T006-T007 can run in parallel because feedback and trace own different files.
- T009-T011 depend on T005-T008.
- T012-T015 can run in parallel once keyboard contracts are stable.

## 병렬 실행 예시

- T002-T004 can run in parallel because normalization, keymap, and command registry own separate files.
- T006-T007 can run in parallel because feedback and trace are independent support modules.
- T012-T015 can run in parallel because they verify different keyboard modules.

## 완료 판정

- `handleKeyDown`가 더 이상 undo/redo/copy/paste 분기 owner가 아니다.
- keymap을 바꿔도 command implementation을 직접 수정하지 않는다.
- keyboard feedback이 direct Korean toast string 대신 message key contract를 따른다.
- keyboard trace가 `pino` 기반 structured event 형태로 남는다.
