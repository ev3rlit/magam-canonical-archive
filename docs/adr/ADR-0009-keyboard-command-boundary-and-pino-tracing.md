---
title: ADR-0009 Keyboard Command Boundary and Pino-Based Structured Tracing
date: 2026-03-18
status: accepted
authors:
  - platform-team
tags:
  - adr
  - architecture
  - keyboard
  - commands
  - keymap
  - tracing
  - pino
aliases:
  - Keyboard Command Boundary ADR
  - Pino Keyboard Tracing ADR
  - GraphCanvas keyboard boundary ADR
---

# ADR-0009: Separate Keyboard Commands, Keymap, and Pino-Based Tracing

## Context

`shell-adapter-boundary` 이후에도 `GraphCanvas.tsx`에는 큰 keyboard hot spot이 남아 있었다.

기존 `handleKeyDown`은 한 함수 안에서 다음을 동시에 처리했다.

- DOM keyboard event branching
- undo/redo/copy/paste/Washi shortcut 판정
- clipboard/history 실행
- toast 출력
- `console.log` / `console.debug` / `console.error`

이 구조는 다음 문제를 만들었다.

1. key chord와 action semantics가 하드코딩 분기에 묶인다.
2. 새 shortcut 추가 시 `GraphCanvas.tsx`를 다시 직접 수정해야 한다.
3. feedback 문자열이 inline 한국어 문장으로 남아 locale 유지보수성이 낮다.
4. tracing이 구조화된 event가 아니라 ad-hoc console 출력에 의존한다.

즉 keyboard handling도 다른 surface wiring과 마찬가지로 boundary 분리가 필요한 상태였다.

## Decision Drivers

- keymap과 command semantics를 분리할 것
- `handleKeyDown`을 branching owner가 아니라 dispatcher로 축소할 것
- keyboard feedback을 message key 중심 contract로 올릴 것
- tracing을 ad-hoc `console.*` 대신 structured logging으로 남길 것
- logging backend는 이미 저장소에 있는 `pino`를 재사용할 것

## Decision

keyboard handling을 `processes/canvas-runtime/keyboard` 경계로 분리하고, tracing backend는 `pino`를 사용한다.

구체적으로는 다음을 채택한다.

1. DOM keyboard event는 normalized chord로 변환한다.
2. keymap은 chord를 `commandId`로 해석한다.
3. command registry는 actual behavior를 소유한다.
4. dispatcher는 resolved command를 실행하고 feedback/trace를 오케스트레이션한다.
5. trace adapter는 `pino` child logger를 사용해 structured keyboard event를 기록한다.
6. `GraphCanvas.tsx`는 `keyboardHost` binding consumer가 된다.

## Decision Details

### Keyboard Runtime Shape

keyboard boundary는 아래 모듈로 나뉜다.

- `types.ts`
- `normalizeKeyEvent.ts`
- `keymap.ts`
- `commands.ts`
- `dispatchKeyCommand.ts`
- `feedback.ts`
- `trace.ts`
- `bindings/keyboardHost.ts`

### Keymap / Command Separation

`Cmd+Z`는 더 이상 곧바로 undo implementation을 뜻하지 않는다.

먼저 normalized chord가 keymap에서 `history.undo` 같은 command id를 얻고, command registry가 실제 `execute/when/onFailure`를 결정한다.

이 방식은 이후 다음 확장에 유리하다.

- platform-specific key differences 흡수
- later binding wins 방식의 user customization
- command behavior 재사용

### Feedback Contract

command는 직접 toast를 띄우지 않는다.

대신 아래 같은 feedback contract를 반환한다.

- `messageKey`
- `defaultMessage`
- `kind`
- `params`

호스트는 이를 실제 UI feedback으로 해석한다.

### Pino Tracing

keyboard tracing은 generic logger abstraction을 두지 않고 `pino`를 backend로 고정한다.

다만 command code가 `pino` API에 직접 의존하지 않도록 다음 규칙을 둔다.

1. command/dispatcher는 plain trace event object만 만든다.
2. `trace.ts`만 `pino`를 import한다.
3. `trace.ts`가 `canvas-keyboard` child logger로 JSON-friendly structured event를 남긴다.

대표 field는 다음과 같다.

- `subsystem`
- `event`
- `commandId`
- `bindingId`
- `outcome`
- `durationMs`
- `reason`
- `payload`

## Alternatives Considered

### A. 기존 `handleKeyDown` 분기 구조를 유지한다

- 장점: 초기 수정이 적다.
- 단점: key customization, locale, tracing 개선이 모두 같은 파일에 다시 쌓인다.
- 결론: 비채택

### B. keymap과 command를 분리하되 tracing은 계속 `console.*`를 사용한다

- 장점: 구현이 더 빠를 수 있다.
- 단점: structured diagnostics와 운영 가능한 logging 계약을 얻지 못한다.
- 결론: 비채택

### C. OpenTelemetry/Sentry 같은 heavier tracing stack을 바로 도입한다

- 장점: 더 넓은 observability 체계로 연결 가능하다.
- 단점: 현재 keyboard boundary 범위에 비해 과도하고 운영 의존성이 커진다.
- 결론: 비채택

### D. keyboard command boundary + `pino` structured tracing (채택)

- 장점: 유지보수성과 확장성, structured diagnostics를 함께 확보한다.
- 장점: 이미 저장소에 있는 `pino`를 재사용할 수 있다.
- 장점: distributed tracing 수준의 무거움 없이 command-level observability를 얻는다.
- 결론: 최종 채택

## Consequences

### Positive

- `handleKeyDown`이 dispatcher consumer로 축소된다.
- 새 keyboard action 추가 시 keymap/commands/binding 쪽으로 책임이 분산된다.
- feedback 문자열과 host UI 호출이 command logic에서 분리된다.
- keyboard diagnostics가 JSON-friendly structured log로 남는다.
- 향후 key customization과 locale 정리가 더 쉬워진다.

### Negative

- keyboard 모듈 수와 테스트 수가 늘어난다.
- feedback contract와 host resolver를 함께 유지해야 한다.
- `pino` browser-side usage를 trace adapter 내부에 잘 가둬야 한다.

## Follow-up

1. keyboard feedback을 더 넓은 locale/message system으로 연결할지 후속 결정이 필요하다.
2. keyboard trace sink를 remote shipping이나 analytics와 연결할 필요가 생기면 adapter layer에서만 확장한다.
3. 다른 shell surface shortcut도 동일한 keymap/command boundary로 통합 가능한지 검토한다.

## Related Decisions

- ADR-0007: runtime composition root와 fixed slot strategy를 정의한다.
- ADR-0008: shared shell file을 runtime binding consumer로 바꾸는 one-time adoption을 정의한다.
