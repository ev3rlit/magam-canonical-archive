# Keyboard Command Boundary 구현 계획서

## 1. 문서 목적

이 문서는 `shell-adapter-boundary` 이후 남아 있는 keyboard handling hot spot을 command/keymap boundary로 분리하는 구현 계획을 정의한다.

- 기준 문서: `docs/features/database-first-canvas-platform/canvas-ui-entrypoints/shell-adapter-boundary/keyboard-command-boundary/README.md`
- 상위 문서: `docs/features/database-first-canvas-platform/canvas-ui-entrypoints/shell-adapter-boundary/README.md`
- 직접 선행 기반: `shell-adapter-boundary`

핵심은 `GraphCanvas.tsx`의 `handleKeyDown`에서 shortcut hardcoding을 계속 늘리는 대신, `processes/canvas-runtime/keyboard`가 command registry와 keymap resolution을 소유하도록 만드는 것이다.

## 2. 현재 상태 요약

현재 keyboard 흐름의 병목은 대부분 `app/components/GraphCanvas.tsx` 한 파일에 남아 있다.

1. key chord 해석
- copy/paste/undo/redo/focus/select-all shortcut 판단이 local boolean 분기들로 계산된다.

2. command 실행
- clipboard, history, toolbar-like tool action, graph state mutation이 같은 effect 안에서 직접 실행된다.

3. feedback
- 성공/실패 시 `showToast(...)`가 직접 호출되고 문자열도 inline으로 박혀 있다.

4. tracing
- `console.log`, `console.debug`, `console.error`가 event contract 없이 섞여 있다.

즉 문제는 keyboard action이 많아서가 아니라, key mapping과 command semantics, UI feedback, diagnostics가 아직 하나의 imperative block으로 결합돼 있다는 점이다.

## 3. 목표

1. `processes/canvas-runtime/keyboard`가 keyboard command registry와 keymap resolution의 owner가 된다.
2. `GraphCanvas.tsx`는 keyboard host consumer가 되고, command branching owner 역할을 내려놓는다.
3. key chord와 action semantics를 분리해 이후 customization과 확장을 쉽게 만든다.
4. feedback과 trace를 structured contract로 올려 locale/diagnostics 유지보수성을 높인다.

## 4. 비목표

1. 앱 전역 i18n framework 도입
2. mouse/pointer/gesture input까지 포함한 통합 input runtime 설계
3. keyboard settings UI 또는 persisted user preference 저장
4. layout subsystem 전체 logging 정리

## 5. 핵심 설계 결정

### 결정 1. command registry와 keymap registry를 분리한다

이 slice가 여는 가장 중요한 경계는 아래 두 레이어다.

- `commands`: 어떤 동작을 할 수 있는가
- `keymap`: 어떤 chord가 어떤 command를 가리키는가

이 둘이 분리되면 다음이 가능해진다.

- 같은 command를 다른 key로 매핑
- platform 별 keymap 차등 적용
- user custom keybinding 도입 시 registry 교체

### 결정 2. `handleKeyDown`은 dispatcher만 담당한다

`handleKeyDown`은 아래를 넘어서지 않는다.

1. text input focus 여부 같은 global gate 확인
2. DOM event normalization
3. keymap lookup
4. dispatcher 호출

undo/redo/copy/paste별 로직은 command registry 안으로 이동한다.

### 결정 3. feedback은 toast string이 아니라 message key contract를 따른다

command 실행 결과는 "toast를 직접 띄운다"가 아니라 "어떤 feedback이 필요한가"를 반환한다.

예:

- `history.undo.success`
- `history.undo.failure`
- `clipboard.copy.success`

처음 단계에서는 message key를 `GraphCanvas`가 로컬 resolver로 해석해도 된다.

중요한 점은 command layer가 한국어 문장을 직접 소유하지 않는다는 것이다.

### 결정 4. tracing은 keyboard 전용 event schema를 먼저 고정한다

이 slice에서 tracing backend를 열린 선택지로 두지 않는다.

keyboard tracing은 기존 의존성인 `pino`를 structured logger로 사용한다.

하지만 `pino`를 command layer에 직접 노출하지 않고, event schema와 adapter 경계를 먼저 고정한다.

예:

- `command.resolved`
- `command.skipped`
- `command.executed`
- `command.failed`
- `clipboard.read.invalid`

초기 sink는 `trace.ts` 안의 `pino` child logger wrapper로 충분하다.

### 결정 5. `pino`는 adapter 뒤에 숨긴다

이번 keyboard boundary는 `pino`를 아래 방식으로 사용한다.

1. `trace.ts`가 `canvas-keyboard` subsystem child logger를 만든다.
2. dispatcher와 command layer는 plain trace event object만 만든다.
3. trace adapter가 그 event를 `logger.debug/info/warn/error`로 매핑한다.

예상 field:

- `subsystem`
- `event`
- `commandId`
- `bindingId`
- `outcome`
- `durationMs`
- `reason`
- `payload`

이렇게 하면 구현 초기에 `console.*`를 걷어내면서도, 나중에 exporter나 shipping 전략을 바꿀 때 command contract를 다시 건드리지 않아도 된다.

## 6. 권장 모듈 배치

1. `app/processes/canvas-runtime/keyboard/types.ts`
- normalized key chord, command, key binding, feedback, trace contract 정의

2. `app/processes/canvas-runtime/keyboard/normalizeKeyEvent.ts`
- DOM keyboard event를 machine-friendly chord로 변환

3. `app/processes/canvas-runtime/keyboard/keymap.ts`
- 기본 keybinding registry와 lookup 로직

4. `app/processes/canvas-runtime/keyboard/commands.ts`
- clipboard/history/navigation/tool selection command registry

5. `app/processes/canvas-runtime/keyboard/dispatchKeyCommand.ts`
- `commandId` resolution 이후 execute/trace/feedback orchestration

6. `app/processes/canvas-runtime/keyboard/feedback.ts`
- message key -> toast text 임시 resolver 또는 presenter helper

7. `app/processes/canvas-runtime/keyboard/trace.ts`
- `pino` child logger 기반 structured trace helper

8. `app/processes/canvas-runtime/bindings/keyboardHost.ts`
- `GraphCanvas`가 소비하는 host binding

## 7. Phase 상세

## Phase 0. Command / keymap contract 고정

### 목표

- keyboard boundary의 public surface를 먼저 잠근다.

### 작업

1. normalized key chord 타입을 정의한다.
2. keyboard command result contract를 정의한다.
3. feedback / trace payload contract를 정의한다.

### 완료 기준

- 후속 구현이 `KeyboardEvent`와 toast string을 직접 command layer에 끌고 다니지 않는다.

## Phase 1. Keyboard runtime 도입

### 목표

- keymap lookup과 command registry를 `processes/canvas-runtime/keyboard`로 이동한다.

### 작업

1. event normalization 모듈을 만든다.
2. default keymap registry를 만든다.
3. clipboard/history/navigation command registry를 만든다.
4. dispatcher를 만든다.

### 완료 기준

- key chord와 action semantics가 서로 다른 파일에서 관리된다.

## Phase 2. Shared shell adoption

### 목표

- `GraphCanvas.tsx`가 keyboard binding consumer가 되도록 한 번만 마이그레이션한다.

### 작업

1. `handleKeyDown`을 keyboard host binding consumer로 바꾼다.
2. direct `showToast` 호출을 feedback result 해석 경로로 줄인다.
3. keyboard-specific `console.*` 호출을 trace helper로 바꾼다.

### 완료 기준

- `GraphCanvas.tsx`에 keyboard command-specific branching이 크게 남지 않는다.

## Phase 3. Verification과 guardrail

### 목표

- keymap/command 분리가 이후에도 깨지지 않도록 테스트로 고정한다.

### 작업

1. chord normalization과 keymap resolution 테스트를 추가한다.
2. command dispatcher의 success/failure/skip behavior를 테스트한다.
3. `GraphCanvas` adoption 테스트를 추가한다.

### 완료 기준

- 새 keyboard command를 추가할 때 shared shell file 수정이 필요한지 테스트가 바로 드러난다.

## 8. 리스크와 대응

1. keyboard abstraction이 과도하게 generic 해지는 위험
- 대응: 현재 필요한 clipboard/history/navigation 범위만 다루고, speculative plugin system은 만들지 않는다.

2. feedback contract가 반쯤 추상화된 채로 `showToast`를 우회하지 못하는 위험
- 대응: 적어도 success/failure message key와 params는 command result에 포함시키고, UI 문자열은 host에서 해석한다.

3. tracing이 또 다른 ad-hoc logger가 되는 위험
- 대응: event name과 payload shape를 먼저 문서와 테스트로 고정한다.

4. `GraphCanvas.tsx`가 여전히 command registry를 import해 직접 분기할 위험
- 대응: host binding을 별도 파일로 두고, adoption 테스트가 `GraphCanvas.tsx`가 dispatcher consumer인지 검증한다.

5. browser keyboard tracing에 `pino`를 바로 노출해 command code가 logger API에 결합되는 위험
- 대응: `trace.ts`만 `pino`를 import하고, command/dispatcher는 trace event contract만 다룬다.

## 9. 완료 정의

1. `processes/canvas-runtime/keyboard`가 keymap과 command registry를 소유한다.
2. `GraphCanvas.tsx`의 keyboard handling은 dispatcher consumer 역할만 남긴다.
3. keyboard feedback은 message key 기반 contract를 따른다.
4. keyboard diagnostics는 `pino` 기반 structured trace event를 남긴다.
5. 이후 key customization이 keymap 교체 수준에서 가능하도록 경계가 정리된다.
