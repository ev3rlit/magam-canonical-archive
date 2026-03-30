# Keyboard Command Boundary

## 개요

이 sub-slice는 `shell-adapter-boundary` 이후에도 남아 있는 `GraphCanvas.tsx`의 keyboard hot spot을 분리하는 후속 작업이다.

현재 `handleKeyDown`은 key chord 해석, action 선택, clipboard/history 실행, toast 메시지 출력, debug log를 한 함수에서 함께 처리한다.

그 결과 keyboard behavior를 하나 추가할 때도 `GraphCanvas.tsx` 내부 분기와 문자열, 부수효과를 동시에 수정해야 하고, 이후 key customization이나 locale 확장도 같은 파일에 다시 결합된다.

이 slice의 목표는 keyboard input을 command pattern으로 재구성해 `키 입력 해석`, `명령 정의`, `키 매핑`, `실행 후 피드백`, `trace`를 서로 다른 경계로 분리하는 것이다.

## 현재 문제

### `handleKeyDown` 함수의 문제

- `isUndo`, `isRedo` 같은 하드코딩 분기와 if/else 체인이 누적된다.
- key mapping과 action semantics가 하나의 코드 경로에 묶여 있다.
- `showToast(...)`가 command 실행 경로 안에 직접 노출돼 있다.
- toast 문자열이 한국어 문장으로 inline 정의돼 locale 유지보수성이 낮다.
- clipboard/history/tool selection 같은 서로 다른 책임이 같은 함수에 공존한다.

### 디버깅 / 추적의 문제

- `console.log`, `console.debug`, `console.error`가 흐름별 contract 없이 산재한다.
- command 실행 결과를 일관된 event name과 payload로 추적하지 못한다.
- keyboard-specific 문제를 디버깅해도 layout, clipboard, edit flow 로그와 뒤섞인다.

### 구조 문제

- 너무 많은 handler와 callback이 `GraphCanvas.tsx`에 남아 있다.
- 이후 keyboard shortcut 추가/변경이 shared shell file을 기본 수정 경로로 다시 만든다.
- key customization을 위해 필요한 "key -> command" 레이어가 아직 없다.

## 범위

- keyboard command registry
- key chord normalization / keymap resolution
- keyboard dispatcher boundary
- command execution feedback contract
- keyboard trace / diagnostics contract
- `GraphCanvas.tsx` keyboard adoption

## 비범위

- 전체 앱 공통 i18n 시스템 도입
- layout pipeline 전체 logging 리팩터링
- mouse / pointer / gesture 입력 체계 통합
- toolbar/context-menu shortcut inventory 자체 확장
- 사용자 설정 UI까지 포함한 keybinding 편집 화면

## 선행조건

- `shell-adapter-boundary`
- `entrypoint-foundation/ui-runtime-state`
- `action-routing-bridge`

## 왜 필요한가

`shell-adapter-boundary`로 surface wiring은 `processes/canvas-runtime`로 옮겼지만, keyboard handling은 아직 `GraphCanvas.tsx` 안에 큰 imperative block으로 남아 있다.

따라서 지금 상태는 다음과 같은 반쯤 분리된 구조다.

- toolbar/context-menu/dispatch는 binding consumer가 됐다.
- keyboard behavior는 여전히 shared shell file의 local branching에 묶여 있다.

후속 유지보수에서 keyboard command를 독립 owner로 다루려면 이 부분도 같은 수준의 boundary가 필요하다.

## 목표 구조

권장 구조는 아래와 같다.

- `app/processes/canvas-runtime/keyboard/types.ts`
- `app/processes/canvas-runtime/keyboard/normalizeKeyEvent.ts`
- `app/processes/canvas-runtime/keyboard/keymap.ts`
- `app/processes/canvas-runtime/keyboard/commands.ts`
- `app/processes/canvas-runtime/keyboard/dispatchKeyCommand.ts`
- `app/processes/canvas-runtime/keyboard/feedback.ts`
- `app/processes/canvas-runtime/keyboard/trace.ts`
- `app/processes/canvas-runtime/bindings/keyboardHost.ts`

참고:

- 첫 단계에서는 keyboard scope를 `GraphCanvas.tsx` 하나로 한정한다.
- 장기적으로는 다른 shell surface도 같은 command/keymap contract를 재사용할 수 있다.
- 이번 slice는 generalized input framework가 아니라 keyboard boundary만 연다.

## 설계 원칙

### 원칙 1. keymap과 command는 별개다

`Cmd+Z`가 곧 undo implementation이면 안 된다.

먼저 key chord가 `history.undo` 같은 `commandId`를 고르고, 실제 command registry가 실행 semantics를 소유해야 한다.

즉 구조는 아래 순서를 따른다.

1. DOM keyboard event를 normalize한다.
2. normalize된 chord를 keymap에 질의한다.
3. keymap이 `commandId`를 반환한다.
4. command registry가 `canRun / execute / feedback / trace`를 결정한다.

### 원칙 2. `handleKeyDown`은 dispatcher로 축소한다

최종 `handleKeyDown`은 아래 역할만 남겨야 한다.

- event normalization
- keymap lookup
- command dispatch
- preventDefault 여부 적용

undo/redo/copy/paste-specific branching은 command layer로 옮긴다.

### 원칙 3. feedback은 message key 기반으로 노출한다

command는 가능한 한 직접 한국어 문장을 반환하지 않고, 아래처럼 message key와 payload를 반환해야 한다.

```ts
{
  kind: 'success',
  messageKey: 'history.undo.success',
  params: { stepCount: 1 }
}
```

이렇게 하면 locale 변경, 문구 수정, UI surface별 표현 차이를 더 작은 범위에서 다룰 수 있다.

### 원칙 4. trace는 구조화된 event contract를 따른다

`console.log('Copied node ids to clipboard')` 같은 ad-hoc logging 대신, keyboard flow는 아래 형태의 trace event를 남긴다.

```ts
{
  category: 'canvas-keyboard',
  event: 'command.executed',
  commandId: 'clipboard.copy-selection',
  outcome: 'success'
}
```

이번 slice에서는 trace sink를 generic placeholder로 두지 않고, 저장소에 이미 존재하는 `pino`를 structured logging backend로 채택한다.

즉 원칙은 아래와 같다.

- command / keymap / dispatcher는 trace event schema를 반환한다.
- `trace.ts`는 이 event를 `pino` child logger로 기록한다.
- `GraphCanvas.tsx`와 command layer는 `console.*`를 직접 호출하지 않는다.

## Tracing 선택

이번 sub-slice의 tracing backend는 `pino`로 고정한다.

선정 이유:

- 이미 저장소 의존성에 포함돼 있다.
- structured field logging에 적합하다.
- `commandId`, `bindingId`, `outcome`, `durationMs`, `payload` 같은 필드를 안정적으로 남길 수 있다.
- 이후 browser-side sink 교체나 server collection 연동 시 adapter 경계가 명확하다.

이번 단계에서 하지 않는 것:

- OpenTelemetry span 도입
- Sentry tracing 연동
- console namespace 기반 ad-hoc debug channel 유지

즉 keyboard tracing의 방향은 "distributed tracing"보다 "structured command logging"에 가깝다.

## 제안 contract

```ts
export interface CanvasKeyboardCommand {
  commandId: string;
  when?: (ctx: CanvasKeyboardContext) => boolean;
  execute: (ctx: CanvasKeyboardContext) => Promise<CanvasKeyboardResult> | CanvasKeyboardResult;
}

export interface CanvasKeyBinding {
  bindingId: string;
  chord: NormalizedKeyChord;
  commandId: string;
}

export interface CanvasKeyboardResult {
  preventDefault?: boolean;
  feedback?: CanvasKeyboardFeedback;
  trace?: CanvasKeyboardTraceEvent[];
}
```

핵심은 command가 keyboard event를 직접 알지 않고, normalized context와 command result contract만 다루는 것이다.

## 완료 기준

- keyboard command를 하나 추가할 때 `GraphCanvas.tsx`를 기본 수정 경로로 두지 않는다.
- keymap을 바꿔도 command implementation을 수정하지 않는다.
- keyboard feedback은 direct toast 문자열이 아니라 message key 기반 contract를 따른다.
- keyboard trace는 `pino` 기반 structured event contract로 남는다.
- `handleKeyDown`은 분기 owner가 아니라 dispatcher 역할만 수행한다.

## 관련 문서

- `./implementation-plan.md`
- `./tasks.md`
- `../README.md`
- `../implementation-plan.md`
