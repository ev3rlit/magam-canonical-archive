# Phase 0 Research: Action Routing Bridge

## Decision 1: Bridge는 canonical mutation/query core의 소비 계층으로만 둔다

- Decision: bridge는 새 mutation schema를 정의하지 않고, 기존 canonical executor contract만 소비한다.
- Rationale: foundation 범위는 intent routing 경계 고정이며 domain contract owner를 분리해야 surface 병렬 개발이 안전하다.
- Alternatives considered:
  - bridge에서 임시 mutation schema를 추가: ownership이 깨지고 core와 drift가 발생한다.
  - surface가 executor를 직접 호출: ad-hoc write path가 다시 생긴다.

## Decision 2: Intent taxonomy는 `mutation/query/runtime-only` 3축으로 고정한다

- Decision: 모든 surface intent를 세 유형으로 분류하고 dispatch recipe를 intent catalog로 관리한다.
- Rationale: runtime-only action과 persisted mutation을 명확히 분리해야 rollback 책임 경계를 명확히 할 수 있다.
- Alternatives considered:
  - mutation/query만 유지: viewport 같은 runtime action의 수명주기가 누락된다.
  - surface별 taxonomy 분리: 동일 intent가 다른 경로로 실행되는 drift 위험이 커진다.

## Decision 3: 실행 가능성 게이팅은 semantic/capability 기반으로 통일한다

- Decision: renderer alias 대신 `semanticRole`, `primaryContentKind`, capability/editability summary를 게이팅 기준으로 사용한다.
- Rationale: database-first 원칙에서 alias 이름은 작성 편의 레이어이며 실행 권한 기준이 될 수 없다.
- Alternatives considered:
  - alias 기반 게이팅 유지: canonical metadata 전환 목표와 충돌한다.
  - payload만 검사: selection context와 실제 편집 가능성 불일치를 막기 어렵다.

## Decision 4: Payload normalization은 strict failure 정책을 사용한다

- Decision: canonical id/reference 해석 실패, capability surface 위반, content-kind 위반은 모두 명시적 오류로 반환한다.
- Rationale: silent fallback은 문제를 숨기고 surface별 회피 코드를 유도한다.
- Alternatives considered:
  - best-effort normalize 후 실행: 잘못된 객체 수정 가능성을 키운다.
  - 오류를 runtime 로그로만 남김: 사용자/개발자가 실패 원인을 확인하기 어렵다.

## Decision 5: 복합 intent orchestration 책임은 bridge가 가진다

- Decision: `object.create + canvas-node.create`, `object.create + object-relation.create + canvas-node.create` 같은 복합 조합은 bridge recipe로 고정한다.
- Rationale: surface가 순서를 직접 조립하면 실패 처리, rollback, telemetry가 분산된다.
- Alternatives considered:
  - surface별 조립: 구현 중복과 ordering bug가 발생한다.
  - executor에서 모든 조합 흡수: UI intent 단위 추적성이 약해진다.

## Decision 6: optimistic lifecycle은 이벤트 계약으로 분리한다

- Decision: bridge는 `apply/commit/reject` 이벤트만 발행하고 pending state 저장은 ui-runtime-state가 담당한다.
- Rationale: 상태 소유자와 이벤트 발행자를 분리하면 UI 상태 누수와 중복 저장을 줄일 수 있다.
- Alternatives considered:
  - bridge가 pending state 직접 저장: runtime-state와 책임 충돌이 생긴다.
  - surface별 optimistic 처리: reject/rollback 일관성이 깨진다.

## Decision 7: Surface adoption은 policy + 테스트로 강제한다

- Decision: entrypoint surface는 bridge dispatch API만 사용하도록 규약화하고 direct mutation 호출 검출 테스트를 추가한다.
- Rationale: 문서 규칙만으로는 우회 경로 재발을 막기 어렵다.
- Alternatives considered:
  - 코드 리뷰 규칙만 적용: 회귀 방지 자동화가 약하다.
  - 강제 래퍼 없이 점진 전환: migration 기간 동안 이중 경로가 장기화된다.

## Clarification Resolution Status

- `spec.md` 기준으로 scope/contract/검증 기준이 충분히 구체적이어서 `/speckit.clarify`는 생략했다.
- Outstanding high-impact ambiguity 없음.
- Deferred:
  - surface별 세부 UX 문구/배치(본 feature 비범위)
  - overlay positioning 세부 정책(overlay-host slice 소관)
