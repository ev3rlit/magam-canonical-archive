# Feature Specification: Action Routing Bridge

**Feature Branch**: `008-action-routing-bridge`  
**Created**: 2026-03-18  
**Status**: Draft  
**Input**: User description: "`/Users/danghamo/Documents/gituhb/magam-feature-dbfcp-selection-floating-menu/docs/features/database-first-canvas-platform/canvas-ui-entrypoints/entrypoint-foundation/action-routing-bridge/README.md`"

## User Scenarios & Testing *(mandatory)*

<!--
  IMPORTANT: User stories should be PRIORITIZED as user journeys ordered by importance.
  Each user story/journey must be INDEPENDENTLY TESTABLE - meaning if you implement just ONE of them,
  you should still have a viable MVP (Minimum Viable Product) that delivers value.
  
  Assign priorities (P1, P2, P3, etc.) to each story, where P1 is the most critical.
  Think of each story as a standalone slice of functionality that can be:
  - Developed independently
  - Tested independently
  - Deployed independently
  - Demonstrated to users independently
-->

### User Story 1 - UI Intent 공통 라우팅 정착 (Priority: P1)

엔트리포인트 기능 개발자는 toolbar, selection floating menu, pane context menu, node context menu가 직접 mutation 함수를 호출하지 않고 하나의 action routing bridge를 통해 intent를 canonical action으로 보낼 수 있어야 한다.

**Why this priority**: 공통 bridge가 없으면 surface별 ad-hoc write path가 재발하고 foundation의 병렬 분리 목표가 깨진다.

**Independent Test**: 각 surface에서 대표 intent(create, rename, style update, add child)를 발생시켰을 때 bridge가 canonical action 조합을 일관되게 생성하면 독립 검증 가능하다.

**Acceptance Scenarios**:

1. **Given** toolbar가 create intent를 보낸 상태에서, **When** bridge가 dispatch를 수행하면, **Then** `object.create`와 `canvas-node.create`가 정의된 순서로 생성된다.
2. **Given** node context menu가 add child intent를 보낸 상태에서, **When** bridge가 dispatch를 수행하면, **Then** `object.create` + `object-relation.create` + `canvas-node.create` 조합이 한 흐름으로 실행된다.
3. **Given** surface 코드가 bridge 우회 write path를 시도할 때, **When** entrypoint integration 검증을 수행하면, **Then** direct mutation 경로가 실패하거나 검출되어 merge 기준을 통과하지 못한다.

---

### User Story 2 - Payload 정규화와 실행 가능성 게이팅 (Priority: P1)

엔트리포인트 기능 개발자는 UI에서 올라오는 느슨한 payload를 canonical ID/shape로 정규화하고, 실행 가능 여부를 renderer 이름이 아니라 semantic metadata와 capability/editability summary로 판정해야 한다.

**Why this priority**: database-first 기준에서 metadata 기반 게이팅은 필수 경계이며, 이를 누락하면 잘못된 action 실행과 surface 간 drift가 발생한다.

**Independent Test**: 동일 intent를 서로 다른 renderer alias로 보냈을 때 metadata가 같으면 동일 게이팅 결과가 나오고, 위반 payload는 명시적 오류를 반환하면 독립 검증 가능하다.

**Acceptance Scenarios**:

1. **Given** semanticRole과 primaryContentKind가 실행 조건을 만족하는 selection context가 있을 때, **When** style update intent를 dispatch하면, **Then** bridge는 정규화된 payload와 함께 canonical mutation을 실행한다.
2. **Given** capability 허용 범위를 벗어난 payload가 들어올 때, **When** bridge가 검증하면, **Then** silent ignore 없이 surface와 intent를 포함한 명시적 오류를 반환한다.
3. **Given** canonical id로 해석 불가능한 payload가 들어올 때, **When** bridge가 정규화하면, **Then** 실행하지 않고 진단 가능한 실패 응답을 반환한다.

---

### User Story 3 - Optimistic/Rollback 공통 라이프사이클 연결 (Priority: P2)

엔트리포인트 기능 개발자는 bridge를 통해 optimistic apply/commit/reject 이벤트를 공통으로 받고, pending state 저장은 ui-runtime-state가 담당하도록 책임을 분리해야 한다.

**Why this priority**: surface별 optimistic 구현이 분산되면 롤백 일관성이 무너지고 디버깅 비용이 급증한다.

**Independent Test**: 복합 intent 성공/실패 시나리오에서 optimistic token과 rollback token이 일관되게 생성/정리되는지 확인하면 독립 검증 가능하다.

**Acceptance Scenarios**:

1. **Given** 복합 intent가 성공하는 경우, **When** bridge가 dispatch를 완료하면, **Then** optimistic apply 후 commit 이벤트가 순서대로 기록된다.
2. **Given** 복합 intent 중간 단계가 실패하는 경우, **When** bridge가 실패를 처리하면, **Then** reject/rollback 이벤트가 발생하고 실패 원인이 intent 단위로 노출된다.
3. **Given** ui-runtime-state가 pending state를 관찰하는 경우, **When** bridge 이벤트를 수신하면, **Then** pending state는 apply/commit/reject 흐름에 맞춰 누수 없이 정리된다.

---

### Edge Cases

- multi-selection이 heterogeneous여서 일부 대상만 intent 실행 가능할 때, 부분 성공을 허용하지 않고 명확한 게이팅 오류를 반환해야 한다.
- 동일 intent가 짧은 시간에 중복 발생할 때, optimistic token 충돌 없이 각 요청의 상태 추적이 분리되어야 한다.
- selection context가 dispatch 직전에 stale이 된 경우, 오래된 target을 갱신하거나 실패시켜 잘못된 객체 수정을 막아야 한다.
- runtime-only action(예: viewport)과 persisted mutation action이 같은 배치에서 요청될 때, 실행 순서와 rollback 책임 경계가 보존되어야 한다.
- canonical executor가 validation error를 반환할 때, bridge는 에러 코드/메시지/실패 intent를 손실 없이 surface에 전달해야 한다.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 시스템은 `canvas-toolbar`, `selection-floating-menu`, `pane-context-menu`, `node-context-menu` intent를 단일 bridge dispatch API로 수용해야 한다.
- **FR-002**: 시스템은 bridge request contract에 최소 `surface`, `intent`, `resolvedContext`, `uiPayload`, `trigger` 필드를 포함해야 한다.
- **FR-003**: 시스템은 bridge response contract에 최소 `dispatchedActions`, `optimisticToken`, `rollbackToken`, `error` 필드를 포함해야 한다.
- **FR-004**: 시스템은 UI payload를 canonical id, relation id, capability patch shape 기준으로 정규화해야 한다.
- **FR-005**: 시스템은 게이팅 판단 시 renderer alias 이름을 기준으로 사용하지 않아야 하며, `semanticRole`, `primaryContentKind`, capability/editability summary를 우선 사용해야 한다.
- **FR-006**: 시스템은 실행 불가 요청을 silent fallback 처리하지 않아야 하며, surface와 intent를 포함한 진단 가능한 오류를 반환해야 한다.
- **FR-007**: 시스템은 `object.create + canvas-node.create` 복합 intent를 bridge 내부 orchestration으로 지원해야 한다.
- **FR-008**: 시스템은 `object.create + object-relation.create + canvas-node.create` 복합 intent를 bridge 내부 orchestration으로 지원해야 한다.
- **FR-009**: 시스템은 runtime-only action과 canonical mutation/query action을 intent 타입으로 구분해야 한다.
- **FR-010**: 시스템은 optimistic apply/commit/reject 이벤트를 bridge에서 공통 발행해야 한다.
- **FR-011**: 시스템은 pending state의 저장/표시 책임을 `ui-runtime-state`에 두고, bridge는 상태 이벤트만 제공해야 한다.
- **FR-012**: 시스템은 rollback 시 broad generic 실패가 아니라 intent 단위 실패 원인과 함께 reject 정보를 반환해야 한다.
- **FR-013**: 시스템은 selection-context-resolver가 제공한 `resolvedContext`를 bridge 입력의 신뢰 경계로 사용해야 한다.
- **FR-014**: 시스템은 모든 UI entrypoint에서 direct mutation 호출 경로를 제거하거나 차단해야 한다.
- **FR-015**: 시스템은 새 surface intent 확장을 bridge mapping 추가 방식으로 수용 가능해야 하며 기존 contract 호환성을 깨지 않아야 한다.
- **FR-016**: 시스템은 canonical mutation schema 자체 변경을 본 feature 범위에 포함하지 않아야 한다.
- **FR-017**: 시스템은 selection 해석 로직과 overlay 위치 계산 로직을 본 feature 범위에 포함하지 않아야 한다.

### Key Entities *(include if feature involves data)*

- **Intent Catalog Entry**: `surface`, `intent`, `intentType(mutation/query/runtime-only)`, `dispatchRecipe`로 구성되는 라우팅 단위.
- **Bridge Request**: UI가 bridge에 전달하는 표준 입력(`surface`, `intent`, `resolvedContext`, `uiPayload`, `trigger`).
- **Bridge Response**: bridge 처리 결과(`dispatchedActions`, optimistic/rollback token, `error`).
- **Normalized Payload**: canonical executor가 받아들일 수 있도록 정규화된 id/reference/capability shape.
- **Dispatch Recipe**: 단일 또는 복합 canonical action 실행 순서와 실패 처리 규칙을 표현하는 계약.
- **Optimistic Lifecycle Event**: `apply`, `commit`, `reject` 단계 및 token/intent를 담는 런타임 이벤트.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 지정된 4개 UI entrypoint에서 write intent의 100%가 bridge dispatch 경로를 통해 실행된다.
- **SC-002**: P1 intent 회귀 시나리오에서 canonical action 매핑 정확도가 95% 이상이다.
- **SC-003**: validation/gating 실패 시나리오에서 silent failure 없이 명시적 오류 응답 비율이 100%다.
- **SC-004**: 복합 intent 실패 시 rollback 이벤트 누락률이 0%다.
- **SC-005**: surface별 intent 확장 시 기존 bridge contract 수정 없이 mapping 추가만으로 신규 intent를 1개 이상 확장할 수 있다.

## Assumptions

- `canonical-mutation-query-core`는 본 feature가 요구하는 canonical action contract를 이미 제공한다.
- selection-context-resolver는 bridge가 신뢰할 수 있는 `resolvedContext`를 제공한다.
- ui-runtime-state는 optimistic pending state 저장과 표시 책임을 수행할 수 있다.
- 본 단계는 foundation contract 고정이 목적이며, 개별 surface의 최종 UX 튜닝은 후속 slice에서 다룬다.

## Dependencies

- `docs/features/database-first-canvas-platform/canvas-ui-entrypoints/entrypoint-foundation/README.md`
- `docs/features/database-first-canvas-platform/canvas-ui-entrypoints/README.md`
- `docs/features/database-first-canvas-platform/canonical-mutation-query-core/README.md`
- entrypoint foundation 하위 slice 중 `selection-context-resolver`, `ui-runtime-state`

## Out of Scope

- canonical mutation/query schema의 신규 정의 또는 변경
- selection 해석 알고리즘 상세 설계
- overlay anchor/positioning 계산 규칙 구현
- toolbar/floating menu/context menu의 최종 아이템 구성 및 시각 디자인
