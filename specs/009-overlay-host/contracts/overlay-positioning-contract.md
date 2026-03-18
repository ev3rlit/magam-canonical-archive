# Contract: Overlay Positioning and Stacking

## 목적

overlay 종류별 anchor 입력을 공통 positioning shell에서 처리하고 stacking 순서를 일관되게 보장한다.

## Positioning Inputs

- `OverlayAnchorDescriptor`
- viewport size
- safe margin
- overlay size
- slot priority

## Positioning Rules

1. pointer anchor 메뉴는 raw 좌표를 기준으로 시작하되 viewport safe margin 내로 clamp한다.
2. selection anchor 메뉴는 selection bounds를 기준으로 계산하고 bounds 이동 시 재배치한다.
3. viewport-fixed overlay(toolbar)는 viewport 기준 고정 슬롯 좌표를 따른다.
4. clamp 이후에도 경계 침범이 남으면 방향 전환(flip) 규칙을 적용한다.
5. resolved position은 항상 safe margin 안에 있어야 한다.

## Stacking Rules

1. stacking은 `priority`가 높은 overlay가 위에 배치된다.
2. 동일 priority에서는 `openedAt` 최신 순으로 위에 배치된다.
3. bubble overlay/drag feedback/toast와 충돌하지 않도록 canvas-level z-layer budget을 유지한다.
4. surface는 priority를 선언만 하며, 실제 정렬과 충돌 해소는 host가 수행한다.

## Failure Contract

- unresolved placement: `OVERLAY_POSITION_UNRESOLVED`
- out-of-viewport after resolve: `OVERLAY_POSITION_BOUNDS_VIOLATION`
- invalid stacking priority: `OVERLAY_PRIORITY_INVALID`
