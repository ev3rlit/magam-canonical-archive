# Phase 0 Research: Overlay Host

## Decision 1: Host mount 범위는 canvas shell로 제한한다

- Decision: overlay host는 `GraphCanvas` 범위에 mount하고 canvas entrypoint overlay만 소유한다.
- Rationale: source brief의 범위/비범위가 canvas overlay와 global overlay를 분리하고 있다.
- Alternatives considered:
  - `WorkspaceClient` 전역 host: global dialog/search/tab menu와 책임이 섞인다.
  - surface별 개별 host: 중복 구현과 규칙 드리프트가 재발한다.

## Decision 2: Slot contribution 모델로 surface 결합을 고정한다

- Decision: `toolbar`, `selection-floating-menu`, `pane-context-menu`, `node-context-menu`는 host slot contribution으로만 결합한다.
- Rationale: surface별 ownership을 유지하면서도 lifecycle/stacking 규칙을 중앙화할 수 있다.
- Alternatives considered:
  - host가 surface renderer를 직접 소유: 책임이 과도하게 커진다.
  - surface가 자체 portal/layering 유지: foundation 목적을 달성하지 못한다.

## Decision 3: Lifecycle API는 `open/close/replace` 최소 집합으로 유지한다

- Decision: host public API는 `open`, `close`, `replace`와 anchor/layer/dismiss/focus 메타를 최소 surface로 제공한다.
- Rationale: 상태 전이와 회귀 테스트를 단순화하면서 실제 요구를 충족한다.
- Alternatives considered:
  - 세분화된 명령 API 다수 도입: 초기 복잡도만 증가한다.
  - 단일 `setState` 형태: 계약이 모호해져 호출자 오남용 위험이 커진다.

## Decision 4: Dismiss reason을 명시적 enum으로 강제한다

- Decision: dismiss 원인은 `outside-pointer`, `escape-key`, `selection-change`, `viewport-teardown`, `programmatic-replace`로 표준화한다.
- Rationale: 닫힘 원인 추적과 회귀 분석에 일관된 진단 정보를 제공한다.
- Alternatives considered:
  - 단순 boolean close: 분석 가능성과 정책 제어가 떨어진다.
  - surface별 자유 문자열: 용어 드리프트가 발생한다.

## Decision 5: Focus lifecycle은 open target + close restore 쌍으로 정의한다

- Decision: open 시 focus target 정책, close 시 restore target 정책을 host가 공통 처리한다.
- Rationale: keyboard 접근성과 사용자 예측 가능성을 함께 보장할 수 있다.
- Alternatives considered:
  - surface 위임: 정책 불일치가 반복된다.
  - 항상 첫 버튼 focus: 일부 overlay 접근성 요구를 만족하지 못한다.

## Decision 6: Positioning은 anchor type 기반 단일 shell로 통합한다

- Decision: pointer, selection, viewport-fixed anchor를 단일 positioning shell에서 clamp/safe-margin/flip 규칙으로 처리한다.
- Rationale: 메뉴별 배치 로직 중복을 제거하면서 경계 조건을 공통 검증할 수 있다.
- Alternatives considered:
  - surface별 위치 계산 유지: boundary bug가 분산된다.
  - 완전 자유 좌표 입력: viewport 안전성이 보장되지 않는다.

## Decision 7: Existing ContextMenu 동작을 host primitive로 흡수한다

- Decision: 기존 `ContextMenu`의 portal, dismiss, initial focus, clamp 동작을 host primitive로 승격한다.
- Rationale: 회귀 리스크를 줄이면서 foundation 목표(공통 host)를 달성한다.
- Alternatives considered:
  - 완전 신규 구현: 기능 동등성 보장 비용이 커진다.
  - 기존 컴포넌트 유지: host 도입 효과가 제한된다.

## Decision 8: Action gating 책임은 resolver/routing/state에 남긴다

- Decision: host는 노출 여부와 mutation 가용성 계산을 소유하지 않는다.
- Rationale: source brief의 비범위와 entrypoint-foundation 책임 분리를 유지한다.
- Alternatives considered:
  - host에서 enable/disable 계산: `selection-context-resolver`와 책임 충돌이 난다.
  - host와 surface가 동시 계산: 기준 불일치로 drift가 생긴다.

## Clarify Policy

- Clarify skipped intentionally.
- Reason: source brief가 scope, 비범위, 단계, 완료 기준, 구현 접점을 이미 명시하여 plan/tasks를 바꿀 정도의 핵심 모호성이 없다.
