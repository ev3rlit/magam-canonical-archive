# Feature Specification: Object Capability Composition

**Feature Branch**: `007-object-capability-composition`  
**Created**: 2026-03-16  
**Status**: Draft  
**Input**: User description: "`/Users/danghamo/Documents/gituhb/magam-object-capability-model-docs/docs/features/object-capability-composition/README.md`"

## Clarifications

### Session 2026-03-16

- Q: canonical 저장 모델에서 `semantic role`을 어느 수준까지 세분화할까요? → A: 최소 canonical role 집합으로 시작한다.
- Q: legacy 문서에 capability metadata가 명시적으로 없을 때, 기본 호환 해석 규칙을 무엇으로 둘까요? → A: parser가 기존 alias와 legacy props에서 capability set을 자동 추론한다.
- Q: alias preset 기본값과 사용자가 명시한 capability 값이 충돌할 때 어떤 우선순위로 해석할까요? → A: 명시적 user capability가 우선하고, alias preset은 값이 없을 때만 기본값을 채운다.
- Q: `Sticky` alias가 sticky를 정의하는 capability 조합 없이 선언되거나, 그 조합이 explicit override로 제거되면 어떻게 해석할까요? → A: `Sticky` alias로 작성된 객체는 sticky semantic을 유지한다.
- Q: `content:media` 객체에 text 전용 필드가 들어오는 식의 content-kind 불일치가 발생하면 어떻게 처리할까요? → A: 정규화 또는 검증 단계에서 명시적으로 오류를 내고 위반 필드를 진단한다.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 단일 Canonical Object 모델 정착 (Priority: P1)

플랫폼 개발자는 `Node`, `Shape`, `Sticky`, `Image`, `Markdown` 같은 공개 surface를 유지한 채, 내부 저장/편집/렌더링 모델이 하나의 canonical object core로 정규화되길 원한다.

**Why this priority**: 내부 canonical 모델이 통일되지 않으면 이후 capability 기반 확장과 중복 제거가 불가능하며, 모든 하위 작업이 막힌다.

**Independent Test**: 기존 alias 컴포넌트로 작성된 문서를 로드하고 저장했을 때, 내부 판단 경로가 canonical object + capability 메타데이터를 기준으로 동작하는지 확인하면 독립 검증 가능하다.

**Acceptance Scenarios**:

1. **Given** 기존 `Node`/`Shape`/`Sticky`/`Image`/`Markdown` 사용 문서가 있을 때, **When** 문서를 파싱하면, **Then** 내부 객체는 공통 object core와 capability 집합으로 정규화된다.
2. **Given** 정규화된 내부 모델이 존재할 때, **When** 문서를 다시 직렬화하면, **Then** 기존 공개 API 호환성은 유지된다.

---

### User Story 2 - Capability 재사용 확장 (Priority: P1)

플랫폼 개발자는 재질, 텍스처, attach, frame 같은 시각/배치 기능을 특정 객체군 전용 로직이 아니라 capability 조합으로 재사용하길 원한다.

**Why this priority**: 이번 feature의 핵심 가치가 "새 base type 추가 없이 확장"이며, 특히 Sticky 계열 재사용성이 가장 큰 설계 동기다.

**Independent Test**: Sticky 별칭 외 일반 object alias에서도 `material`/`texture`/`attach`/`frame` capability를 허용 정책 내에서 적용했을 때 동일 규칙으로 동작하면 독립 검증 가능하다.

**Acceptance Scenarios**:

1. **Given** sticky preset alias가 있을 때, **When** 내부 모델로 해석하면, **Then** 독립 primitive가 아니라 capability preset 조합으로 처리된다.
2. **Given** general object alias가 있을 때, **When** 동일 capability를 선언하면, **Then** tag 이름 분기 없이 capability 규칙으로 렌더/편집 가능 여부가 결정된다.

---

### User Story 3 - Content Contract 경계 보존 (Priority: P2)

플랫폼 개발자는 단일 object core로 통합하더라도 `media`, `markdown`, `sequence` 같은 content contract 경계가 유지되길 원한다.

**Why this priority**: content contract가 깨지면 `Image`/`Markdown`/`Sequence`의 편집기 동작과 검증 규칙이 붕괴되어 사용자 경험 회귀가 발생한다.

**Independent Test**: `content:text`, `content:markdown`, `content:media`, `content:sequence` 각각에 대해 허용 필드와 검증 규칙이 분리되어 적용되는지 확인하면 독립 검증 가능하다.

**Acceptance Scenarios**:

1. **Given** `Image` alias object가 있을 때, **When** 내부 모델을 평가하면, **Then** `content:media` 계약과 자산 참조 관련 요구사항이 유지된다.
2. **Given** `Markdown` 또는 `Sequence` content를 가진 object가 있을 때, **When** 편집/검증을 수행하면, **Then** style capability와 구분된 content 전용 규칙이 적용된다.
3. **Given** object의 declared content kind와 맞지 않는 필드가 함께 들어오면, **When** 정규화 또는 검증을 수행하면, **Then** 시스템은 해당 입력을 거부하고 위반 필드를 명시적으로 진단해야 한다.

---

### User Story 4 - Capability 기반 편집/패치 규칙 전환 (Priority: P2)

에디터 개발자는 patcher/editability/router가 JSX tag 이름 기반 분기에서 capability/contract 기반 분기로 전환되길 원한다.

**Why this priority**: 새 object family 추가 시 비용을 줄이고, 내부 규칙을 선언형으로 유지하기 위한 핵심 전환점이다.

**Independent Test**: 동일 동작을 tag 이름이 다른 alias로 실행했을 때, capability 집합이 같으면 동일 patch/edit 결과가 나오는지 검증하면 독립 테스트 가능하다.

**Acceptance Scenarios**:

1. **Given** 서로 다른 alias가 동일 capability 조합을 가질 때, **When** 편집 허용 여부를 계산하면, **Then** 결과는 tag 이름과 무관하게 동일해야 한다.
2. **Given** 허용되지 않은 capability 변경 요청이 들어올 때, **When** patch를 생성하면, **Then** 시스템은 변경을 거부하고 canonical 규칙을 유지한다.

### Edge Cases

- alias preset 기본값과 사용자 입력 capability가 충돌할 때는 명시적 user capability가 우선하고, preset은 누락된 값만 채워야 한다.
- legacy 문서에 capability metadata가 누락된 객체가 있을 때도 parser는 기존 alias와 legacy props만으로 동일 capability set을 일관되게 추론해야 한다.
- `content:media` 객체에 text 전용 필드가 들어오는 등 content-kind 불일치가 발생하면 시스템은 입력을 명시적으로 거부하고 위반 필드를 진단해야 한다.
- `Sticky` alias로 작성된 객체는 일부 sticky-default capability가 제거되더라도 sticky semantic을 유지해야 하며, parser와 editor는 이를 일반 object로 자동 강등하지 않아야 한다.
- 정규화 이전/이후 객체 비교에서 의미는 같지만 필드 순서만 달라질 때 불필요 diff를 어떻게 방지하는가?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 시스템은 일반 canvas object를 단일 object core 계약으로 정규화해야 한다.
- **FR-002**: 시스템은 semantic role과 content kind를 분리된 축으로 표현해야 한다.
- **FR-003**: 시스템은 capability를 명시적 opt-in 방식으로만 허용해야 한다.
- **FR-004**: 시스템은 capability 미선언 속성을 기본 허용하지 않아야 한다.
- **FR-005**: 시스템은 `Sticky`를 독립 runtime primitive가 아닌 preset alias로 해석해야 한다.
- **FR-006**: 시스템은 `Node`, `Shape`, `Sticky`, `Image`, `Markdown` 공개 API 호환성을 유지해야 한다.
- **FR-007**: 시스템은 `Image`를 `content:media` semantic 계약을 가진 alias로 유지해야 한다.
- **FR-008**: 시스템은 `content:markdown`과 `content:sequence`를 style capability와 구분된 계약으로 유지해야 한다.
- **FR-009**: 시스템은 renderer 판단 기준을 JSX tag 이름보다 normalized capability 집합으로 우선 전환해야 한다.
- **FR-010**: 시스템은 patcher/editability 판단 기준을 alias 이름이 아닌 capability 및 content carrier 기준으로 전환해야 한다.
- **FR-011**: 시스템은 legacy alias 입력을 canonical object schema로 일관되게 변환해야 한다.
- **FR-012**: 시스템은 canonical schema에서 허용되지 않는 capability 조합을 검증 단계에서 거부해야 한다.
- **FR-013**: 시스템은 style update 허용 범위를 tag whitelist가 아닌 capability whitelist로 관리해야 한다.
- **FR-014**: 시스템은 create/patch 명령 생성을 canonical object schema 기준으로 수행해야 한다.
- **FR-015**: 시스템은 본 단계에서 공개 컴포넌트 제거를 강제하지 않아야 한다.
- **FR-016**: 시스템은 임의 TSX 컴포넌트를 editable native object 모델에 자동 편입하지 않아야 한다.
- **FR-017**: 시스템은 media 편집 확장(crop/filter/video)을 본 범위에 포함하지 않아야 한다.
- **FR-018**: 시스템은 전체 파일 포맷 일괄 마이그레이션을 본 범위에서 강제하지 않아야 한다.
- **FR-019**: 시스템은 canonical semantic role을 최소 안정 집합으로 유지해야 하며, 새 role은 capability나 content contract만으로 안전하게 표현할 수 없을 때만 추가해야 한다.
- **FR-020**: 시스템은 explicit capability metadata가 없는 legacy alias 입력에 대해서도 alias와 legacy props를 기반으로 canonical capability set을 자동 추론해야 한다.
- **FR-021**: 시스템은 alias preset 기본값과 명시적 user capability가 충돌할 때 명시적 user capability를 우선 적용하고, preset은 누락된 값만 보완해야 한다.
- **FR-022**: 시스템은 `Sticky` alias로 작성된 객체에서 일부 sticky-default capability가 제거되더라도 canonical semantic role을 `sticky-note`로 유지해야 하며, 해당 객체를 일반 object role로 자동 강등하지 않아야 한다.
- **FR-023**: 시스템은 declared content kind와 맞지 않는 필드 조합을 정규화 또는 검증 단계에서 명시적으로 거부해야 하며, 어떤 필드가 content contract를 위반했는지 진단해야 한다.

### Key Entities *(include if feature involves data)*

- **Object Core**: 모든 일반 object가 공유하는 canonical 기본 계약(`id`, 위치, 관계, children, className, source metadata).
- **Capability Set**: object가 opt-in으로 보유한 기능 집합(`frame`, `material`, `texture`, `attach`, `ports`, `bubble`, `content`).
- **Semantic Role**: object의 의미 축이며, canonical 저장 모델에서는 최소 안정 집합(`topic`, `shape`, `sticky-note`, `image`, `sticker`, `sequence`)으로 시작한다.
- **Content Kind**: object 본문 계약 축(`text`, `markdown`, `media`, `sequence`)이며, 서로 다른 content-kind 전용 필드는 혼합 허용되지 않는다.
- **Alias Preset**: 공개 API의 작성 편의 레이어(`Node`, `Shape`, `Sticky`, `Image`, `Markdown`)와 canonical 모델 간 매핑이며, preset 기본값은 명시적 user capability가 없을 때만 적용된다. `Sticky` alias는 일부 기본 capability가 제거되어도 sticky semantic을 유지하는 authoring 예외를 가진다.
- **Edit Metadata**: 편집 허용 범위 계산을 위한 내부 메타(`family`, `contentCarrier`, capability gate 정보).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 기존 alias 기반 회귀 시나리오의 95% 이상에서 canonical 정규화 후 렌더 결과가 기능적으로 동일하다.
- **SC-002**: `Sticky` 관련 기능 적용 시나리오의 95% 이상에서 non-sticky alias에도 capability 재사용이 가능하다.
- **SC-003**: `Image`/`Markdown`/`Sequence` 회귀 시나리오의 99% 이상에서 content 계약 위반 없이 기존 편집 동작을 유지한다.
- **SC-004**: editability/patcher 규칙에서 tag-name 하드코딩 분기 수를 기준선 대비 50% 이상 축소한다.
- **SC-005**: 새 visual 기능 추가 검증에서 object family별 중복 구현 없이 capability 확장만으로 적용 가능한 사례를 최소 1개 이상 입증한다.
- **SC-006**: 공개 API 호환 회귀 시나리오의 99% 이상에서 사용자-facing 문서 깨짐 없이 동작한다.

## Assumptions

- canonical object model은 기존 parser/renderer/editor 파이프라인 안에 단계적으로 도입할 수 있다.
- 공개 API는 작성 편의 alias로 유지하되 내부 모델 증가 없이 해석 레이어로 제한한다.
- 본 feature는 object capability 조합 구조 정립이 목적이며, 고급 media authoring 확장은 다음 단계로 미룬다.
- legacy 문서는 upfront migration 없이도 parser 단계의 capability 추론을 통해 계속 열리고 편집될 수 있다.

## Dependencies

- parser 단계에서 legacy alias를 normalized capability model로 변환하는 경로
- renderer/editor/patcher에서 공통으로 참조할 capability metadata 정의
- content-kind별 validation과 편집기 동작 계약을 유지할 수 있는 내부 인터페이스

## Out of Scope

- arbitrary TSX component를 native editable object로 일반화
- crop/filter/video 등 media 편집 기능 추가
- sequence content를 본 단계에서 일반 content capability로 완전 평탄화
- 기존 파일 포맷 전체의 일괄 마이그레이션 확정
