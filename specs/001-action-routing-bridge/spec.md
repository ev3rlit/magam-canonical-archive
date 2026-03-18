# Feature Specification: Action Routing Bridge

**Feature Branch**: `001-action-routing-bridge`  
**Created**: 2026-03-18  
**Status**: Draft  
**Input**: User description: "`/Users/danghamo/Documents/gituhb/magam-feature-dbfcp-action-routing-bridge/docs/features/database-first-canvas-platform/canvas-ui-entrypoints/entrypoint-foundation/action-routing-bridge/README.md`"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Unified Routing Contract for All UI Entrypoints (Priority: P1)

캔버스 UI 개발자는 `toolbar`, `selection-floating-menu`, `pane-context-menu`, `node-context-menu`가 각각 ad-hoc write path를 만들지 않고 하나의 action bridge로 intent를 전달하길 원한다.

**Why this priority**: 공통 진입점 계약이 먼저 고정되지 않으면 후속 표면별 구현이 다시 분기되고 충돌한다.

**Independent Test**: 네 UI surface에서 대표 intent를 실행했을 때, 각 surface가 bridge API만 호출하고 직접 mutation/query 실행 경로를 만들지 않으면 독립 검증 가능하다.

**Acceptance Scenarios**:

1. **Given** 네 UI surface가 활성화되어 있고, **When** 사용자가 surface별 대표 액션을 실행하면, **Then** 모든 요청은 bridge의 공통 intent 입력 shape로 전달된다.
2. **Given** bridge가 dispatch descriptor를 반환할 때, **When** surface가 결과를 처리하면, **Then** 결과 타입은 `canonical mutation`, `canonical query`, `runtime-only action` 중 하나로만 표현된다.

---

### User Story 2 - Intent Gating and Payload Normalization (Priority: P1)

UI surface 개발자는 intent 노출 조건과 payload 해석이 surface마다 다르게 구현되지 않고 canonical metadata 및 공통 context 기준으로 일관되게 동작하길 원한다.

**Why this priority**: intent 등록/gating/정규화가 분산되면 같은 사용자 의도라도 surface마다 다른 동작이 발생한다.

**Independent Test**: 같은 intent를 서로 다른 surface에서 실행했을 때 enable/disable 판단과 canonical payload 결과가 동일하면 독립 검증 가능하다.

**Acceptance Scenarios**:

1. **Given** intent가 bridge registry에 등록되어 있을 때, **When** surface가 intent 실행 가능 여부를 조회하면, **Then** 판단은 selection context와 canonical metadata 기반으로 일관되게 나온다.
2. **Given** UI raw payload가 입력되었을 때, **When** bridge가 변환을 수행하면, **Then** surface별 임시 필드 없이 canonical action payload로 정규화된다.
3. **Given** 하나의 intent가 다중 mutation을 필요로 할 때, **When** bridge가 dispatch plan을 생성하면, **Then** surface는 내부 순서를 알지 못한 채 계획만 소비한다.

---

### User Story 3 - Optimistic and Rollback Reliability (Priority: P2)

에디터 사용자와 클라이언트 개발자는 optimistic 업데이트가 적용되더라도 실패 시 롤백이 명시적으로 수행되고 실패 원인이 숨겨지지 않길 원한다.

**Why this priority**: bridge가 성공 모양으로 오류를 숨기면 편집 신뢰성과 디버깅 가능성이 급격히 떨어진다.

**Independent Test**: validation failure/버전 충돌/미등록 intent를 각각 유발했을 때, pending 상태와 rollback, 오류 표면화가 일관되게 동작하면 독립 검증 가능하다.

**Acceptance Scenarios**:

1. **Given** bridge가 optimistic dispatch descriptor를 반환할 때, **When** 클라이언트가 실행하면, **Then** `baseVersion`과 pending key가 함께 전달되어 runtime state와 연결된다.
2. **Given** mutation이 실패할 때, **When** bridge를 통한 응답이 surface에 전달되면, **Then** 오류는 canonical validation/error contract를 유지한 채 노출된다.
3. **Given** runtime-only action과 mutation action이 함께 필요한 intent가 있을 때, **When** bridge가 계획을 생성하면, **Then** 단일 진입점에서 순서를 일관되게 보장한다.

### Edge Cases

- 미등록 intent가 들어왔을 때 bridge는 명시적 오류를 반환하고 성공 경로처럼 처리하면 안 된다.
- selection context와 target metadata가 불일치하면 intent enable/disable 판정 근거를 명확히 제공해야 한다.
- 동일 intent가 surface별로 서로 다른 raw payload를 전달해도 canonical payload 결과는 의미적으로 동일해야 한다.
- optimistic pending 중 동일 대상에 대해 후속 intent가 들어오면 pending key 기준 순서 충돌을 감지해야 한다.
- ordered dispatch plan 중간 mutation 실패 시 부분 성공 상태를 남기지 않고 rollback 가능한 단위를 유지해야 한다.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 시스템은 `toolbar`, `selection-floating-menu`, `pane-context-menu`, `node-context-menu`의 UI intent를 단일 bridge 입력 계약으로 받아야 한다.
- **FR-002**: 시스템은 bridge 입력에 `surfaceId`, `intentId`, selection/target 참조, raw UI payload, optimistic 필요 여부를 포함해야 한다.
- **FR-003**: 시스템은 bridge 출력을 `canonical mutation`, `canonical query`, `runtime-only action`의 세 가지 dispatch descriptor 유형으로 제한해야 한다.
- **FR-004**: 시스템은 UI surface가 canonical mutation/query를 직접 호출하는 ad-hoc write path를 허용하지 않아야 한다.
- **FR-005**: 시스템은 intent 등록을 bridge registry로 일원화해야 한다.
- **FR-006**: 시스템은 intent enable/disable 판단을 selection context와 canonical metadata 기반으로 수행해야 한다.
- **FR-007**: 시스템은 renderer 이름 기반 분기 대신 `semanticRole`, `primaryContentKind`, capability 기반 gating 규칙을 우선 적용해야 한다.
- **FR-008**: 시스템은 UI raw payload를 bridge 내부에서 canonical action payload로 정규화해야 한다.
- **FR-009**: 시스템은 다중 mutation이 필요한 intent에 대해 ordered dispatch plan을 생성해야 한다.
- **FR-010**: 시스템은 surface가 ordered dispatch 내부 순서에 직접 결합되지 않도록 유지해야 한다.
- **FR-011**: 시스템은 dispatch descriptor에 optimistic 처리에 필요한 `baseVersion`, pending key, rollback 최소 metadata를 포함해야 한다.
- **FR-012**: 시스템은 실패 결과를 canonical validation/error contract 그대로 상위 surface에 전달해야 한다.
- **FR-013**: 시스템은 bridge 내부에서 실패를 성공처럼 숨기거나 silent fallback으로 변환하면 안 된다.
- **FR-014**: 시스템은 runtime-only action과 mutation action이 혼합된 intent를 단일 bridge 경로로 조정해야 한다.
- **FR-015**: 시스템은 네 UI surface를 순차적으로 bridge 경로로 전환할 수 있어야 한다.
- **FR-016**: 시스템은 미등록 intent, invalid capability payload, optimistic rollback 경로를 회귀 검증 대상으로 포함해야 한다.
- **FR-017**: 시스템은 canonical mutation schema 자체 정의를 본 범위에 포함하지 않아야 한다.
- **FR-018**: 시스템은 selection 해석 및 overlay 위치 계산 자체를 본 범위에 포함하지 않아야 한다.

### Key Entities *(include if feature involves data)*

- **UI Intent Envelope**: surface가 bridge로 전달하는 공통 intent 입력 단위(`surfaceId`, `intentId`, selection/target 참조, raw payload, optimistic 힌트).
- **Intent Registry Entry**: intent별 enable/disable 조건, payload normalization 규칙, dispatch 생성 규칙을 가진 등록 단위.
- **Dispatch Descriptor**: bridge가 반환하는 실행 계획 단위(`canonical mutation`, `canonical query`, `runtime-only action`)와 실행 metadata.
- **Ordered Dispatch Plan**: 하나의 intent를 완료하기 위해 필요한 다중 dispatch를 순서화한 계획 단위.
- **Optimistic Pending Record**: optimistic 실행 중 상태 추적과 rollback 연결에 필요한 `baseVersion`, pending key, rollback metadata 집합.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 네 UI surface의 대표 intent 시나리오에서 100%가 bridge 단일 경로를 통해 실행된다.
- **SC-002**: 회귀 검증에서 surface별 ad-hoc write path 호출이 0건이어야 한다.
- **SC-003**: 동일 intent를 다른 surface에서 실행한 시나리오의 95% 이상에서 gating 결과와 canonical payload가 일치한다.
- **SC-004**: 다중 mutation intent 시나리오의 95% 이상에서 ordered dispatch plan 순서가 재현 가능하고 일관된다.
- **SC-005**: validation 실패/버전 충돌/미등록 intent 시나리오의 100%에서 오류가 명시적으로 표면화되고 성공 모양으로 숨겨지지 않는다.
- **SC-006**: optimistic 실패 시나리오의 100%에서 pending 상태 정리 및 rollback 경로가 완료된다.

## Assumptions

- `canonical-mutation-query-core`의 mutation/query 계약과 validation/error contract는 이미 존재하며 본 기능은 이를 소비한다.
- selection context 해석은 `selection-context-resolver`가 제공하며 bridge는 해석 결과를 입력으로 소비한다.
- runtime-only UI state 저장과 pending 상태 관리는 `ui-runtime-state`에서 제공한다.
- 네 UI surface는 공통 foundation 계약 위에서 병렬적으로 bridge를 채택할 수 있다.

## Dependencies

- `docs/features/database-first-canvas-platform/canvas-ui-entrypoints/entrypoint-foundation/action-routing-bridge/README.md`
- `selection-context-resolver`의 공통 context 계약
- `canonical-mutation-query-core`의 mutation/query + validation/error 계약
- `ui-runtime-state`의 optimistic/pending/rollback 연계 계약

## Out of Scope

- canonical mutation schema 신규 정의
- selection 자체 해석 로직 구현
- overlay 위치/stacking/focus 계산
- toolbar/menu의 실제 UI item 세트 설계
