# Feature Specification: Canonical Mutation Query Core

**Feature Branch**: `008-canonical-mutation-query-core`  
**Created**: 2026-03-17  
**Status**: Draft  
**Input**: User description: "`/Users/danghamo/Documents/gituhb/magam-feature-canonical-mutation-query-core/docs/features/database-first-canvas-platform/canonical-mutation-query-core/README.md`"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Shared Canonical Mutation Surface (Priority: P1)

플랫폼 개발자는 UI action과 다음 slice의 AI CLI action이 같은 shared canonical mutation surface를 공유하길 원한다.

**Why this priority**: database-first 전환에서 mutation 계약이 먼저 고정되지 않으면 현재 UI 경로와 이후 AI CLI 경로가 서로 다른 domain rule로 분기되어 이후 slice가 흔들린다.

**Independent Test**: 동일한 사용자 의도를 shared executor와 WS adapter 경로로 실행했을 때 mutation result와 validation behavior가 일치하고, 같은 envelope contract가 다음 slice의 AI CLI handoff에 그대로 재사용 가능하면 독립 검증 가능하다.

**Acceptance Scenarios**:

1. **Given** 동일한 object patch intent가 UI adapter 경로와 다음 slice의 AI transport가 소비할 shared contract로 들어올 때, **When** mutation을 적용하면, **Then** 같은 validator와 executor를 거쳐 동일한 결과 envelope를 반환해야 한다.
2. **Given** 허용 surface를 벗어난 capability/content patch가 들어올 때, **When** mutation을 적용하면, **Then** 요청은 명시적으로 실패하고 실패 원인을 구조화된 오류로 반환해야 한다.
3. **Given** 같은 mutation batch를 같은 기준 revision에서 재생할 때, **When** executor가 처리하면, **Then** 결과 state와 changed-set은 결정적으로 동일해야 한다.

---

### User Story 2 - Partial Query and Surface Load (Priority: P1)

플랫폼 개발자는 giant document 전체를 읽지 않고 필요한 canonical object/surface 정보만 부분 조회하고 싶다.

**Why this priority**: database-first 모델의 핵심 이점은 부분 조회이며, query 계약이 없으면 UI/AI 모두 전체 payload 의존으로 회귀한다.

**Independent Test**: filter/include/cursor/bounds를 조합한 query 요청에서 필요한 subset만 반환되고 불필요한 데이터가 제외되며, 지원되지 않는 include 요청은 부분 성공 없이 명시적으로 거부되는지 확인하면 독립 검증 가능하다.

**Acceptance Scenarios**:

1. **Given** semantic role, primary content kind, capability 기준 필터가 주어진 상태에서, **When** object query를 실행하면, **Then** 조건을 만족하는 canonical object만 반환해야 한다.
2. **Given** include/limit/cursor가 주어진 상태에서, **When** query를 실행하면, **Then** 응답은 요청된 subset과 pagination 정보만 포함해야 한다.
3. **Given** 지원되지 않는 include 필드가 요청에 포함될 때, **When** query를 실행하면, **Then** 응답은 부분 성공 없이 구조화된 validation failure로 전체 요청을 거부해야 한다.
4. **Given** 특정 document/surface를 로드할 때, **When** load query를 실행하면, **Then** canvas placement 데이터와 canonical object 데이터가 일관된 read model로 결합되어 반환되어야 한다.

---

### User Story 3 - Note Body Block Mutation and Clone Safety (Priority: P1)

플랫폼 개발자는 note-like object body를 block 단위로 안전하게 수정하고, editable object 공유로 인한 교차 문서 오염을 방지하고 싶다.

**Why this priority**: note body의 ordered block mutation이 불안정하면 기존 authoring 경험이 깨지고, clone-vs-share 규칙이 불명확하면 데이터 오염이 발생한다.

**Independent Test**: replace/insert/update/remove/reorder를 순차 적용했을 때 block 순서와 body projection이 유지되고, duplicate/import 시 clone 규칙이 강제되면 독립 검증 가능하다.

**Acceptance Scenarios**:

1. **Given** note-like object가 ordered contentBlocks를 가진 상태에서, **When** block mutation을 실행하면, **Then** block id 안정성, 순서, body projection이 일관되게 유지되어야 한다.
2. **Given** content.kind와 block payload가 충돌하는 입력이 들어올 때, **When** mutation을 실행하면, **Then** 요청은 명시적으로 거부되고 위반 필드가 진단되어야 한다.
3. **Given** editable note-like object를 생성/복제/가져오기 하는 상황에서, **When** mutation을 실행하면, **Then** 기본 동작은 clone-on-create로 적용되어 기존 canonical id 재사용이 발생하지 않아야 한다.

---

### User Story 4 - Transport-Neutral Handoff to Next Slice (Priority: P2)

플랫폼 개발자는 다음 slice(Headless CLI/App-attached)가 같은 domain contract를 transport만 바꿔 재사용하길 원한다.

**Why this priority**: CLI/API/WS가 서로 다른 응답 구조를 가지면 이후 slice에서 adapter 비용이 급격히 증가한다.

**Independent Test**: 같은 query/mutation 결과를 현재 WS adapter와 다음 slice handoff fixture에서 동일 envelope로 직렬화할 수 있고, stale base revision과 missing base revision이 서로 다른 실패 계약으로 고정되면 독립 검증 가능하다.

**Acceptance Scenarios**:

1. **Given** query 또는 mutation 실행 결과가 있을 때, **When** transport adapter가 응답을 포장하면, **Then** structured JSON envelope shape가 일관되어야 한다.
2. **Given** optimistic concurrency 전제가 필요한 요청이 들어올 때, **When** base revision과 head revision이 불일치하면, **Then** 충돌은 명시적인 conflict 결과로 반환되어야 한다.
3. **Given** optimistic concurrency 전제가 필요한 mutation 요청에 base revision이 누락될 때, **When** executor가 요청을 검증하면, **Then** 요청은 conflict가 아니라 구조화된 validation failure로 거부되어야 한다.
4. **Given** mutation이 성공했을 때, **When** 결과를 반환하면, **Then** revision append 결과와 changed-set 정보가 함께 제공되어야 한다.

### Edge Cases

- 같은 mutation이 이미 반영된 revision에서 중복 재시도될 때 idempotency를 어떻게 해석하는가?
- cursor 기반 pagination 중간에 데이터가 바뀌면 query 일관성을 어떻게 보장하는가?
- `contentBlocks` reorder 대상에 없는 block id가 요청에 포함되면 어떻게 거부하는가?
- custom block type namespace 형식이 잘못되거나 payload가 구조화되지 않으면 어떻게 진단하는가?
- `object.patch-capability`가 capability allow-list 외 키를 포함하면 어떤 오류를 반환하는가?
- `canvas-node.reparent`가 cycle 또는 scope boundary 위반을 만들면 어떻게 거부하는가?
- relation mutation에서 endpoint object가 없거나 tombstoned 상태면 어떤 실패 계약을 반환하는가?
- base revision 누락 요청은 optimistic concurrency conflict가 아니라 validation failure로 거부해야 한다.
- include 파라미터가 지원되지 않는 필드를 요청하면 부분 성공 없이 요청 전체를 validation failure로 거부해야 한다.
- document/surface load에서 binding이 tombstoned object를 가리킬 때 placeholder 진단을 어떻게 표현하는가?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 시스템은 canonical object/canvas mutation을 위한 typed mutation envelope를 제공해야 한다.
- **FR-002**: 시스템은 canonical object query에서 `semanticRole`, `primaryContentKind`, `hasCapability`, `alias` 필터를 지원해야 한다.
- **FR-003**: 시스템은 partial read를 위해 `include`, `limit`, `cursor`, `bounds` 입력을 지원해야 하며, 지원되지 않는 `include` 필드는 부분 성공 없이 구조화된 validation failure로 전체 요청을 거부해야 한다.
- **FR-004**: 시스템은 object mutation으로 `update-core`, `update-content`, `patch-capability`를 지원해야 한다.
- **FR-005**: 시스템은 note body mutation으로 `replace`, `block.insert`, `block.update`, `block.remove`, `block.reorder`를 지원해야 한다.
- **FR-006**: 시스템은 object relation mutation을 지원해야 한다.
- **FR-007**: 시스템은 canvas node mutation으로 `move`, `reparent`, `create`, `remove`를 지원해야 한다.
- **FR-008**: 시스템은 document/surface load query를 지원해야 한다.
- **FR-009**: 시스템은 capability allow-list 위반을 명시적 validation failure로 거부해야 한다.
- **FR-010**: 시스템은 content-kind boundary 위반을 명시적 validation failure로 거부해야 한다.
- **FR-011**: 시스템은 content block shape/order 위반을 명시적 validation failure로 거부해야 한다.
- **FR-012**: 시스템은 custom block namespace/payload 위반을 명시적 validation failure로 거부해야 한다.
- **FR-013**: 시스템은 editable note-like object create/duplicate/import에서 clone-vs-share 규칙을 강제해야 한다.
- **FR-014**: 시스템은 허용 patch surface를 벗어나는 요청을 명시적으로 거부해야 한다.
- **FR-015**: 시스템은 validation 오류를 코드, 경로, 메시지를 포함한 구조화된 오류로 반환해야 한다.
- **FR-016**: 시스템은 mutation 성공 시 changed-set과 revision append 결과를 함께 반환해야 한다.
- **FR-017**: 시스템은 optimistic concurrency 모델에서 base revision 불일치를 명시적 conflict로 반환해야 하며, base revision 누락 요청은 conflict가 아니라 구조화된 validation failure로 거부해야 한다.
- **FR-018**: 시스템은 동일 mutation replay에 대해 결정적 결과를 보장해야 한다.
- **FR-019**: 시스템은 `content.kind`와 맞지 않는 patch field를 조용히 무시하지 않고 거부해야 한다.
- **FR-020**: 시스템은 `Node`/`Sticky`의 text/markdown body block 생성/수정/재정렬을 canonical mutation만으로 표현 가능해야 한다.
- **FR-021**: 시스템은 style/content patch가 capability profile 허용 surface를 벗어나면 거부해야 한다.
- **FR-022**: 시스템은 transport 종류와 무관하게 동일 JSON envelope shape를 제공해야 하며, 현재 slice에서는 이를 WS adapter와 다음 slice handoff contract 기준으로 보장해야 한다.
- **FR-023**: 시스템은 다음 slice가 별도 domain rule 추가 없이 재사용 가능한 query/mutation service contract를 제공해야 한다.
- **FR-024**: 시스템은 현재 범위에서 shell-facing CLI UX와 app-attached session 동작을 직접 포함하지 않아야 한다.
- **FR-025**: 시스템은 현재 범위에서 plugin runtime 실행 로직을 포함하지 않아야 한다.
- **FR-026**: 시스템은 현재 범위에서 고급 export/import 기능을 포함하지 않아야 한다.

### Key Entities *(include if feature involves data)*

- **Query Request**: canonical object/surface를 부분 조회하기 위한 입력으로, filter/include/pagination/bounds를 포함한다.
- **Query Result Envelope**: 조회 결과 데이터와 cursor 등 탐색 정보를 담는 구조화된 응답 단위다.
- **Mutation Envelope**: 실행 intent와 대상, payload, concurrency 메타데이터를 담는 요청 단위다.
- **Mutation Result Envelope**: 성공/실패 상태, validation 오류, changed-set, revision 정보를 담는 응답 단위다.
- **Content Block Operation**: note body의 block-level 수정 의도를 표현하는 값 객체다.
- **Revision Token**: optimistic concurrency 검증과 replay 일관성 판단에 사용하는 문서 상태 식별자다.
- **Validation Failure**: 오류 코드, 경로, 설명을 포함하는 계약된 실패 표현 단위다.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: UI 경로와 다음 slice AI handoff contract 검증 시나리오의 100%에서 shared mutation intent의 결과 envelope와 validation code가 일치한다.
- **SC-002**: 동일 mutation replay 회귀 시나리오의 100%에서 결과 state와 changed-set이 결정적으로 동일하다.
- **SC-003**: partial query 회귀 시나리오의 100%에서 include/filter/pagination 조건에 맞는 subset만 반환된다.
- **SC-004**: `content.kind` 불일치 patch 시나리오의 100%가 명시적 validation failure로 종료되고 조용한 성공 사례는 0건이다.
- **SC-005**: `Node`/`Sticky` body block create/update/reorder 회귀 시나리오의 100%가 canonical mutation만으로 성공한다.
- **SC-006**: clone-on-create 검증 시나리오에서 editable note-like object canonical id 재사용 사례가 0건이다.
- **SC-007**: optimistic concurrency 충돌 시나리오의 100%가 명시적 conflict 결과를 반환한다.
- **SC-008**: headless CLI handoff 검증에서 required JSON response shape 누락 항목이 0건이다.

## Assumptions

- canonical persistence slice가 제공한 canonical object/contentBlocks/clone 규칙은 본 feature에서 변경하지 않고 소비한다.
- query/mutation core는 domain service 계약에 집중하며 transport/UX 별 세부 동작은 다음 slice에서 어댑터로 구현한다.
- 현재 slice에서 실제로 연결하는 in-repo adapter는 WS/editor 경로이며, headless AI CLI transport 구현 자체는 다음 slice 책임이다.
- validation 오류 코드는 기존 canonical contract에서 합의된 코드 집합을 우선 재사용한다.

## Dependencies

- `docs/features/database-first-canvas-platform/canonical-object-persistence/README.md`
- `docs/features/database-first-canvas-platform/entity-modeling.md`
- `docs/features/database-first-canvas-platform/schema-modeling.md`
- `docs/features/database-first-canvas-platform/implementation-plan.md`
- `docs/adr/ADR-0007-canonical-mutation-query-core-transport-staging.md`

## Out of Scope

- shell-facing CLI UX 세부 명령 설계
- app-attached selection/session bridge 동작
- plugin runtime execution/sandbox
- 고급 export/import
