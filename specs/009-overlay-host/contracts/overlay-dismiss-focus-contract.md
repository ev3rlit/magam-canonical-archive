# Contract: Overlay Dismiss and Focus Lifecycle

## 목적

overlay 닫힘 원인과 focus 이동/복귀 규칙을 surface 공통 정책으로 고정한다.

## Dismiss Inputs

- outside pointer event
- keyboard event (`Escape`)
- selection change signal
- viewport teardown signal
- explicit programmatic close

## Dismiss Reason Enum

- `outside-pointer`
- `escape-key`
- `selection-change`
- `viewport-teardown`
- `programmatic-close`
- `programmatic-replace`

## Dismiss Rules

1. 모든 close는 dismiss reason을 반드시 포함한다.
2. `dismissible=false`인 overlay는 outside pointer/Escape dismiss를 무시할 수 있다.
3. selection change로 유효성이 깨진 overlay는 `selection-change` reason으로 닫힌다.
4. viewport teardown 시 active overlay는 `viewport-teardown` reason으로 정리된다.

## Focus Rules

1. open 시 `openTarget` 정책(`first-actionable`, `explicit-target`, `none`)을 따른다.
2. close 시 `restoreTarget` 정책(`trigger`, `selection-owner`, `explicit-target`, `none`)을 따른다.
3. nested overlay가 생기면 child부터 닫히고 focus restore는 close ordering을 따른다.
4. focus target을 찾지 못하면 최소한 host는 포커스 손실 상태를 남기지 않아야 한다.

## Failure Contract

- missing reason on close: `OVERLAY_DISMISS_REASON_REQUIRED`
- invalid focus target reference: `OVERLAY_FOCUS_TARGET_INVALID`
- focus restore failure: `OVERLAY_FOCUS_RESTORE_FAILED`
