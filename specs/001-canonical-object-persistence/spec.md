# Feature Specification: Canonical Object Persistence

**Feature Branch**: `001-canonical-object-persistence`  
**Created**: 2026-03-17  
**Status**: Draft  
**Input**: User description: "`docs/features/database-first-canvas-platform/canonical-object-persistence/README.md`"

## Clarifications

### Session 2026-03-17

- Q: canonical object id의 유일성 범위는 어디까지인가? → A: `object.id`는 `workspace` 범위에서 유일하다.
- Q: canonical object를 삭제할 때 참조 중인 canvas 데이터가 있으면 어떻게 처리하는가? → A: object는 삭제하되 canvas에는 tombstone/placeholder 참조를 남긴다.
- Q: native node와 canonical object의 기본 관계는 어떻게 두는가? → A: 모든 native node는 canonical object를 가져야 한다.
- Q: `object_relations`가 존재하지 않는 object를 가리키는 상태를 허용하는가? → A: 존재하지 않는 object를 가리키는 relation은 저장 시 거부한다.
- Q: 같은 canonical object를 여러 document가 참조할 수 있는가? → A: 가능하다. 다만 editable note-like object는 기본 clone 대상이며, 현재 slice에서는 non-note object만 여러 document가 같은 canonical object를 참조할 수 있다. editable note shared-template 경로는 backlog로 미룬다.
- Q: `SC-001`에서 검증할 canonical alias 입력 샘플은 무엇인가? → A: `Node`, `Shape`, `Sticky`, `Image`, `Markdown`, `Sticker`, `Sequence`를 canonical 저장 shape 검증 fixture 집합으로 사용한다.
- Q: `primary content kind`가 비어 있는 상태는 어떻게 저장하는가? → A: direct `capabilities.content`와 `contentBlocks`가 모두 없을 때만 `primaryContentKind`를 `NULL`로 저장할 수 있고, direct content 또는 body blocks가 있으면 그 canonical body projection과 반드시 일치해야 한다.
- Q: tombstone placeholder 경로는 어떤 canvas 참조에 적용되는가? → A: canvas node와 binding 모두 canonical payload를 복제하지 않고 placeholder/diagnostic 경로를 유지해야 한다.
- Q: 기존 선언형 `Node`/`Sticky` 안의 여러 text/markdown children은 database-first에서 어떻게 저장하는가? → A: canonical object가 ordered `contentBlocks`를 직접 저장하고, 각 block은 stable id를 가진 extensible block envelope로 표현된다. v1 core block은 `text`, `markdown`이며 이후 custom block도 같은 배열에 담을 수 있다.
- Q: `contentBlocks`를 가진 object의 `primaryContentKind`는 어떻게 정하는가? → A: direct content가 있으면 그 값을 따른다. direct content가 없고 `contentBlocks`만 있으면 built-in markdown block이 하나라도 있으면 `markdown`, built-in text block만 있으면 `text`, custom block만 있으면 `NULL`을 허용한다.
- Q: 새 editable note-like object를 만들 때 초기 본문이 없으면 어떻게 하는가? → A: persistence create 경로가 빈 `text` block 하나를 자동 seed한다.
- Q: editable note-like canonical object도 여러 document에서 그대로 공유하는가? → A: 아니다. note-like object는 create/duplicate/import 시 canonical object와 body blocks를 기본 clone하며, shared-template 예외는 현재 slice 범위에서 제외한다.
- Q: 나중에 Notion처럼 다양한 block을 한 노드 안에 넣고 싶을 때 persistence가 다시 바뀌어야 하는가? → A: 아니다. `contentBlocks`는 extensible block container로 두고, v1은 core block 몇 개만 first-class validation/rendering 대상으로 시작한다.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Canonical Object Storage Shape (Priority: P1)

플랫폼 개발자는 native object를 alias 중심 저장 형태가 아니라 단일 canonical object 저장 형태로 유지하고 싶다.

**Why this priority**: 이후 mutation/query, CLI, plugin이 모두 이 저장 형태를 전제로 동작하므로 가장 먼저 고정되어야 한다.

**Independent Test**: canonical object를 생성/조회하는 저장 경로만으로도 저장 shape가 일관되게 유지되는지 독립 검증 가능하다.

**Acceptance Scenarios**:

1. **Given** canonical object를 생성하려는 요청이 있을 때, **When** 저장이 수행되면, **Then** 객체는 `semantic role`, `primary content kind`, source provenance, capability payload, capability provenance를 포함하는 단일 canonical shape로 저장된다.
2. **Given** 서로 다른 public alias 계열에서 유입된 객체가 있을 때, **When** 저장 모델로 정규화하면, **Then** alias 전용 저장 테이블 없이 같은 canonical 저장 구조로 수용된다.
3. **Given** 같은 workspace 안의 여러 document가 동일 non-note native object를 참조하려 할 때, **When** 저장을 수행하면, **Then** 시스템은 canonical object를 중복 생성하지 않고 같은 canonical object 식별자를 재사용할 수 있다.

---

### User Story 2 - Canonical vs Canvas Ownership Boundary (Priority: P1)

플랫폼 개발자는 native object 의미 데이터와 canvas 배치 데이터를 분리 저장해 중복 소유와 충돌을 방지하고 싶다.

**Why this priority**: 저장 책임이 섞이면 patch gate와 sync 동작이 불안정해지고 이후 feature 전체가 흔들린다.

**Independent Test**: canonical object와 canvas node/binding을 함께 저장한 뒤 필드 소유 경계와 tombstone placeholder 경로를 검증하는 데이터 테스트로 독립 검증 가능하다.

**Acceptance Scenarios**:

1. **Given** canonical object에 semantic/content/capability payload가 있는 상태에서, **When** 같은 객체를 canvas에 배치하면, **Then** canvas 저장 레이어는 배치/표현 정보만 소유하고 canonical payload를 중복 저장하지 않는다.
2. **Given** canvas node의 local display 변경이 발생했을 때, **When** 저장을 수행하면, **Then** canonical object의 의미/계약 데이터는 변경되지 않는다.
3. **Given** canvas node 또는 binding이 tombstoned canonical object를 참조하고 있을 때, **When** 조회 또는 재수화가 수행되면, **Then** 시스템은 canonical payload를 canvas 저장소에 복제하지 않고 placeholder/diagnostic 상태로 해석한다.

---

### User Story 3 - Editable Note Body Preservation (Priority: P1)

플랫폼 개발자는 기존 선언형 `Node`/`Sticky`처럼 하나의 노드 안에 여러 body block을 보존하고, 장기적으로는 Notion처럼 text/markdown 외 구조화된 custom block도 같은 canonical 계약 안에 담길 수 있길 원한다.

**Why this priority**: freeform note 본문이 단일 문자열로 축소되면 기존 authoring 표현력이 사라지고 DB-first 전환 자체가 회귀가 된다.

**Independent Test**: legacy multi-block note fixture와 custom-block fixture를 canonical object로 저장하고 다시 읽어 block 순서, built-in/custom 구분, text flatten 결과, clone semantics를 확인하면 독립 검증 가능하다.

**Acceptance Scenarios**:

1. **Given** 기존 `Node` 또는 `Sticky`가 여러 text/markdown children을 가진 상태에서, **When** canonical persistence로 정규화하면, **Then** 시스템은 ordered `contentBlocks`를 저장하고 단일 문자열로 평탄화해 원본 block 구조를 잃지 않아야 한다.
2. **Given** 새 editable note-like node 생성 요청에 initial body가 없을 때, **When** canonical object가 생성되면, **Then** 시스템은 빈 `text` block 하나를 seed하고 canvas 저장 레이어에는 canonical body를 복제하지 않아야 한다.
3. **Given** `contentBlocks` 안에 text와 markdown block이 섞여 있을 때, **When** canonical record를 저장하면, **Then** `primaryContentKind`는 `markdown`으로 projection되고 `canonicalText`는 block order 기준으로 재계산되어야 한다.
4. **Given** `contentBlocks` 안에 custom block이 들어올 때, **When** 저장을 수행하면, **Then** 시스템은 namespaced block type과 payload를 손실 없이 저장하고, optional `textualProjection`만 검색 텍스트에 반영해야 한다.
5. **Given** editable note-like node를 다른 document로 복제하거나 생성할 때, **When** persistence write가 수행되면, **Then** 시스템은 같은 canonical object id를 재사용하지 않고 body를 포함한 새 canonical object를 clone해야 한다.

---

### User Story 4 - Persistence Contract Readiness for Next Slice (Priority: P2)

플랫폼 개발자는 다음 slice에서 바로 mutation/query core를 구현할 수 있도록 persistence 계약, migration, mapper 경계를 확정하고 싶다.

**Why this priority**: 저장 계약이 불완전하면 다음 단계에서 서비스 계약이 재작업된다.

**Independent Test**: migration 적용과 기본 repository 경로를 실행해 다음 slice가 소비할 계약 산출물이 준비됐는지 확인하면 독립 검증 가능하다.

**Acceptance Scenarios**:

1. **Given** 초기 저장소 상태에서, **When** migration을 적용하면, **Then** canonical object persistence에 필요한 핵심 엔티티 구조가 생성된다.
2. **Given** persistence adapter가 준비된 상태에서, **When** canonical object를 write/read하면, **Then** 다음 slice가 사용할 일관된 저장 계약과 mapper 경계가 제공된다.

### Edge Cases

- `capabilities.content`가 없는 canonical object는 `primaryContentKind = NULL` 상태로도 유효하게 저장되어야 한다.
- `contentBlocks`와 direct `capabilities.content`가 동시에 note body truth를 주장하면 어떤 규칙으로 거부하는가?
- `contentBlocks` 안의 block id가 중복되거나 block order가 깨진 경우 어떻게 진단하는가?
- custom block type이 namespace 없이 들어오거나 payload가 structured object가 아니면 어떻게 거부하는가?
- custom block만 가진 note-like object의 `primaryContentKind`를 `NULL`로 둘 때 query/filter UX는 어떻게 유지하는가?
- 새 note-like object 생성 요청에 본문이 비어 있을 때 empty seed block을 어떻게 보장하는가?
- capability payload에 허용되지 않은 capability key가 포함되면 저장 단계에서 어떻게 거부하고 진단하는가?
- source provenance의 필수 식별 정보가 누락된 객체를 저장하려 할 때 어떤 실패 계약을 반환하는가?
- relation이 참조하는 object가 존재하지 않을 때 저장 무결성을 어떻게 보장하는가?
- canvas-local display props에 canonical payload 필드가 섞여 들어오면 어떤 규칙으로 차단하는가?
- 삭제된 canonical object를 참조하던 canvas node와 binding은 tombstone 또는 placeholder 상태를 어떻게 유지하고 진단하는가?
- editable note-like object를 다른 document에 넣으려 할 때 기존 canonical object id 재사용을 시도하면 clone 또는 reject 규칙을 어떻게 적용하는가?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 시스템은 native object를 alias 이름과 무관한 단일 canonical 저장 형태로 저장해야 한다.
- **FR-002**: 시스템은 canonical object에 `semantic role`을 저장해야 한다.
- **FR-003**: 시스템은 canonical object의 `primary content kind`를 canonical body의 projection으로 저장해야 하며, direct `capabilities.content`가 있으면 해당 `kind`와 일치해야 하고, `contentBlocks`만 있으면 built-in `markdown` block이 하나라도 있을 때 `markdown`, built-in `text` block만 있을 때 `text`, custom block만 있을 때와 direct content 및 body blocks가 모두 없을 때만 `NULL` 상태를 허용해야 한다.
- **FR-004**: 시스템은 canonical object source provenance를 저장해야 한다.
- **FR-005**: 시스템은 canonical object capability payload를 저장해야 한다.
- **FR-006**: 시스템은 capability 값이 explicit/legacy-inferred/alias-default 중 어디서 왔는지 provenance를 저장할 수 있어야 한다.
- **FR-007**: 시스템은 canonical object 검색용 정규화 텍스트를 저장해야 한다.
- **FR-008**: 시스템은 canonical object 확장 데이터 저장 경로를 제공해야 한다.
- **FR-009**: 시스템은 object relation을 canonical object와 분리된 저장 엔티티로 관리해야 한다.
- **FR-010**: 시스템은 canvas 저장 레이어가 배치/composition 데이터를 소유하도록 하되 canonical 의미 데이터를 중복 저장하지 않게 해야 한다.
- **FR-011**: 시스템은 canvas-local display props와 canonical payload를 구분할 수 있어야 한다.
- **FR-012**: 시스템은 초기 상태에서 canonical object persistence 구조를 생성할 수 있는 migration 경로를 제공해야 한다.
- **FR-013**: 시스템은 canonical object row와 애플리케이션 엔티티 간 매핑 경계를 명시해야 한다.
- **FR-014**: 시스템은 다음 slice가 재사용 가능한 persistence contract를 제공해야 한다.
- **FR-015**: 시스템은 저장 단계 validation 실패를 조용히 무시하지 않고 구조화된 실패로 반환해야 한다.
- **FR-016**: 시스템은 canonical object 식별자를 `workspace` 범위에서 유일하게 보장해야 한다.
- **FR-017**: 시스템은 참조 중인 canonical object가 삭제될 경우 관련 canvas node와 binding 참조를 tombstone 또는 placeholder 상태로 유지할 수 있어야 한다.
- **FR-018**: 시스템은 모든 native node가 하나의 canonical object를 참조하도록 보장해야 한다.
- **FR-019**: 시스템은 존재하지 않는 canonical object를 가리키는 relation 저장을 허용하지 않아야 한다.
- **FR-020**: 시스템은 같은 workspace 안에서 non-note canonical object가 여러 document에 의해 재사용될 수 있도록 저장해야 한다.
- **FR-021**: 시스템은 editable note-like canonical object(`Node`, `Sticky`)에 대해 ordered `contentBlocks`를 저장할 수 있어야 하며, 각 block은 stable id와 extensible `blockType`을 가져야 한다.
- **FR-022**: 시스템은 `contentBlocks`와 direct `capabilities.content`가 동일 note body의 canonical truth를 동시에 주장하는 입력을 저장 단계에서 명시적으로 거부해야 한다.
- **FR-023**: 시스템은 새 editable note-like object 생성 시 initial body가 없으면 빈 `text` block 하나를 자동 seed해야 한다.
- **FR-024**: 시스템은 `contentBlocks`가 존재할 때 `canonicalText`를 block order 기준 flatten 결과로 저장해야 하며, custom block은 선택적 `textualProjection`을 통해서만 여기에 기여해야 한다.
- **FR-025**: 시스템은 editable note-like object를 create/duplicate/import 경로에서 기본적으로 clone-on-create semantics로 저장해야 하며, 같은 canonical object id를 다른 document에 재사용하지 않아야 한다.
- **FR-026**: 시스템은 다음 slice가 `contentBlocks`의 replace/insert/update/remove/reorder mutation을 정의할 수 있을 만큼 persistence record shape를 명시해야 한다.
- **FR-027**: 시스템은 v1에서 `text`, `markdown` core block을 first-class로 검증하되, namespaced custom block type과 structured payload를 손실 없이 저장할 수 있어야 한다.
- **FR-028**: 시스템은 custom block type 추가를 위해 `primaryContentKind` enum이나 alias-specific table을 매번 확장하지 않아야 한다.

### Key Entities *(include if feature involves data)*

- **Canonical Object Record**: native object의 내부 표준 저장 단위로, `workspace` 범위 유일 식별자와 semantic role, content kind projection, source provenance, capabilities, capability provenance, canonical text, 확장 데이터를 포함하며 non-note object는 여러 document가 재사용할 수 있다.
- **Content Block Record**: editable note-like canonical object 내부에 순서대로 저장되는 extensible block 값 객체로, stable block id, block type, structured payload, 선택적 textual projection을 가진다.
- **Object Relation Record**: canonical object 사이의 의미 관계를 저장하는 엔티티로, 그래프 관계와 관계 메타데이터를 담는다.
- **Canvas Node Record**: 문서 내 배치/표현 저장 단위로, canonical object 참조와 layout/composition 데이터를 가진다.
- **Document Revision Record**: persistence 변경 이력을 저장하는 기록 단위로, 변경 배치와 작성 주체를 추적한다.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: `Node`, `Shape`, `Sticky`, `Image`, `Markdown`, `Sticker`, `Sequence` alias 입력 샘플 100%가 alias 전용 저장 엔티티 없이 canonical object 저장 형태로 기록된다.
- **SC-002**: canonical object와 canvas node 경계 검증 시나리오에서 의미 데이터 중복 소유 사례가 0건이다.
- **SC-003**: 빈 저장소 기준 migration 실행 성공률이 100%이며, canonical persistence 핵심 엔티티가 모두 생성된다.
- **SC-004**: persistence write/read 검증 시 canonical object 핵심 필드 누락 없이 round-trip 일치율 100%를 충족한다.
- **SC-005**: legacy `Node`/`Sticky` multi-block fixture와 custom-block fixture의 100%가 block type, order, payload, `primaryContentKind`, `canonicalText` 손실 없이 round-trip 된다.
- **SC-006**: editable note-like object를 다른 document로 create/duplicate/import 하는 검증 시나리오에서 기본 canonical object id 재사용 사례가 0건이다.

## Assumptions

- canonical object의 최소 role 집합과 content-kind 경계는 기존 object capability composition 계약을 그대로 따른다.
- 이 slice에서는 저장 계약과 경계 고정이 우선이지만, note-like `contentBlocks` shape, empty seed rule, clone-vs-share semantics는 이번 단계에서 먼저 고정해야 한다.
- local profile과 production profile은 같은 논리 스키마를 최대한 공유한다.
- editable note shared-template / shared canonical note library는 현재 slice의 active contract에서 제외하고 backlog 후보로 남긴다.

## Dependencies

- `docs/features/object-capability-composition/README.md`의 canonical object 계약
- `docs/features/database-first-canvas-platform/entity-modeling.md`의 엔티티 경계
- `docs/features/database-first-canvas-platform/schema-modeling.md`의 논리 스키마 기준

## Out of Scope

- canonical mutation/query service 구현
- AI CLI command 노출
- app-attached session 확장
- plugin runtime sandbox 동작
- editable note shared-template / shared canonical note library
