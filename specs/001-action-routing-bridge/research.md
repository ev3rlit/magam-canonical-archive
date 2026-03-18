# Phase 0 Research: Action Routing Bridge

## Decision 1: Bridge는 UI surface 공통 입력 계약을 강제한다

- Decision: 모든 UI surface는 `UIIntentEnvelope`를 통해서만 action 실행을 요청한다.
- Rationale: surface별 ad-hoc payload shape를 허용하면 gating/normalization 일관성이 깨진다.
- Alternatives considered:
  - surface별 adapter 유지: drift 위험이 높고 검증 비용이 증가한다.
  - 기존 RPC 직접 호출 유지: bridge 도입 목표(단일 routing 경로)와 충돌한다.

## Decision 2: intent 등록과 gating은 registry 소유로 분리한다

- Decision: intent별 enable/disable 조건과 payload normalization rule은 bridge registry가 소유한다.
- Rationale: UI 컴포넌트가 조건식을 직접 들고 있으면 surface 추가 시 재사용이 어렵다.
- Alternatives considered:
  - UI 컴포넌트 내부 분기 유지: 책임이 분산되어 유지보수가 어려워진다.
  - 서버 전담 gating: 클라이언트 affordance 제어와 UX 피드백 시점이 늦어진다.

## Decision 3: gating 기준은 canonical metadata 우선으로 고정한다

- Decision: `semanticRole`, `primaryContentKind`, capability profile, selection context를 gating 기준으로 사용한다.
- Rationale: renderer/tag 이름 기반 분기는 alias 변화에 취약하다.
- Alternatives considered:
  - renderer 이름 기반 분기: 향후 object family 확장 시 규칙 누수가 발생한다.
  - surface별 bespoke rule: 동일 intent 결과가 surface마다 달라진다.

## Decision 4: Bridge 출력은 세 가지 descriptor로 제한한다

- Decision: bridge 결과는 `canonical mutation`, `canonical query`, `runtime-only action`으로만 표현한다.
- Rationale: descriptor 종류를 제한해야 execution 경로가 추론 가능하고 테스트가 단순해진다.
- Alternatives considered:
  - 자유형 실행 객체 허용: 실행기와 테스트가 빠르게 복잡해진다.

## Decision 5: 다중 mutation intent는 ordered dispatch plan으로 명시한다

- Decision: 하나의 intent가 여러 단계 실행을 요구할 때 bridge가 순서를 가진 plan을 반환한다.
- Rationale: UI가 실행 순서를 직접 알면 bridge 추상화가 무너진다.
- Alternatives considered:
  - UI에서 수동 체이닝: surface별 순서 차이와 부분 실패 처리가 발생한다.

## Decision 6: optimistic metadata를 descriptor에 내장한다

- Decision: dispatch descriptor에 `baseVersion`, pending key, rollback metadata를 포함한다.
- Rationale: optimistic/rollback 경로를 별도 채널로 분리하면 실패 시 정합성 누락 가능성이 높다.
- Alternatives considered:
  - 별도 optimistic registry 유지: descriptor와 상태 관리가 분리되어 디버깅이 어렵다.

## Decision 7: 오류는 canonical contract를 유지한 채 전파한다

- Decision: bridge는 validation/rpc 오류를 성공 모양으로 감싸지 않고 원형 contract로 surface에 전달한다.
- Rationale: 실패 가시성은 rollback 정확성과 사용자 안내 품질에 직접 연결된다.
- Alternatives considered:
  - bridge 내부 generic 오류로 통합: 원인 추적이 어려워지고 회귀 테스트 신뢰도가 낮아진다.

## Decision 8: 전환은 surface 단위로 순차 적용한다

- Decision: `toolbar -> floating menu -> pane context menu -> node context menu` 순서로 bridge 경로 전환을 진행한다.
- Rationale: 한 번에 전환하면 실패 지점과 회귀 원인 분리가 어렵다.
- Alternatives considered:
  - 일괄 전환: 초기 충돌 시 원인 분해와 롤백 비용이 증가한다.

## Clarification Resolution Status

- `spec.md` 기준으로 범위/비범위/완료 기준이 충분히 구체화되어 있어 `/speckit.clarify`는 생략했다.
- Outstanding high-impact ambiguity 없음.
