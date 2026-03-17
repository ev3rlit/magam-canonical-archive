# Feature Specification: Workspace `className` Runtime

**Feature Branch**: `001-workspace-classname-runtime`  
**Created**: 2026-03-15  
**Status**: Draft  
**Input**: User description: "`docs/features/workspace-classname-runtime/README.md`"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Instant Workspace Style Feedback (Priority: P1)

워크스페이스 작성자는 `.tsx` 파일의 `className`을 수정했을 때, 편집 중인 캔버스에서 스타일 결과를 바로 확인하고 싶다. 스타일 수정만으로 편집 세션이 끊기거나 앱 전체가 다시 준비되는 경험은 없어야 한다.

**Why this priority**: 이 기능의 핵심 가치는 "workspace 스타일 수정이 무거운 앱 갱신 없이 바로 보인다"는 점이며, 이 흐름이 해결되지 않으면 다른 확장 요구보다 먼저 사용자 불만이 발생한다.

**Independent Test**: 사용자가 지원 범위 내 `className`을 수정한 뒤 저장 또는 반영했을 때, 편집 세션이 유지된 채 캔버스 시각 결과만 갱신되면 독립적으로 검증 가능하다.

**Acceptance Scenarios**:

1. **Given** 사용자가 편집 가능한 workspace 파일을 열어 둔 상태이고 대상 오브젝트가 캔버스에 보이는 상태에서, **When** 해당 오브젝트의 `className`을 지원 범위 내 값으로 수정하면, **Then** 사용자는 편집 세션을 끊지 않고 갱신된 스타일 결과를 캔버스에서 확인할 수 있어야 한다.
2. **Given** 사용자가 스타일만 수정한 상태에서, **When** 변경이 반영되면, **Then** 현재 선택 상태와 캔버스 편집 맥락은 유지되어야 한다.
3. **Given** 사용자가 같은 오브젝트의 `className`을 연속으로 여러 번 수정하면, **When** 각 수정이 반영되면, **Then** 캔버스에는 가장 마지막 입력 기준의 스타일만 보여야 한다.

---

### User Story 2 - Predictable Styling by Supported Class Category (Priority: P2)

워크스페이스 작성자와 AI 편집 사용자는 특정 node family 이름보다, 현재 styling/size props를 이미 지원하는 오브젝트에서 `className`이 예측 가능한 방식으로 적용되길 원한다. 같은 입력은 같은 시각 결과를 만들어야 하고, 파일을 다시 열어도 기대 결과가 유지되어야 한다.

**Why this priority**: 즉시 반영만으로는 충분하지 않고, 결과가 일관되어야 스타일링을 신뢰할 수 있다. v1에서 어떤 class category를 우선 지원하는지가 불분명하면 기능 채택이 늘지 않는다.

**Independent Test**: 문서화된 eligible object와 지원 class category에서 같은 `className` 값을 적용해도 동일한 결과가 나오고, 파일을 다시 열거나 다시 렌더한 뒤에도 결과가 유지되면 독립적으로 검증 가능하다.

**Acceptance Scenarios**:

1. **Given** styling 또는 size 관련 props를 이미 지원하는 eligible 오브젝트가 있고, **When** 사용자가 문서화된 지원 class category의 `className`을 적용하면, **Then** 시스템은 해당 오브젝트에 일관된 시각 결과를 보여야 한다.
2. **Given** 같은 `className`이 같은 capability를 가진 eligible 오브젝트 두 개에 적용되어 있고, **When** 캔버스를 확인하면, **Then** 두 오브젝트는 동일한 스타일 결과를 보여야 한다.
3. **Given** eligible 오브젝트의 스타일이 반영된 상태에서, **When** 사용자가 파일을 다시 열거나 캔버스를 다시 확인하면, **Then** 마지막으로 반영된 스타일 결과가 유지되어야 한다.

---

### User Story 3 - Clear Handling of Unsupported Styling (Priority: P3)

워크스페이스 작성자는 지원되지 않는 `className` 패턴을 사용했을 때, 무엇이 적용되지 않았는지 이해할 수 있길 원한다. 실패가 조용히 묻히면 같은 시도를 반복하게 되고, AI가 생성한 스타일 제안도 신뢰하기 어려워진다.

**Why this priority**: 기능이 일부 범위만 지원하더라도, 경계가 명확하면 사용자 혼란과 디버깅 비용을 크게 줄일 수 있다.

**Independent Test**: 사용자가 지원되지 않는 `className` 패턴을 입력했을 때, 시스템이 이를 진단 가능하게 표시하고 지원되는 부분만 일관되게 처리하면 독립적으로 검증 가능하다.

**Acceptance Scenarios**:

1. **Given** 사용자가 지원되지 않는 `className` 패턴을 입력하면, **When** 시스템이 이를 해석하려고 시도하면, **Then** 사용자는 어떤 입력이 지원 범위를 벗어났는지 확인할 수 있어야 한다.
2. **Given** `className` 문자열에 지원되는 항목과 지원되지 않는 항목이 함께 포함되어 있으면, **When** 반영 결과를 확인하면, **Then** 지원되는 항목은 적용되고 지원되지 않는 항목은 진단 가능하게 남아야 한다.
3. **Given** 사용자가 지원되지 않는 패턴을 제거하거나 수정하면, **When** 다시 반영하면, **Then** 이전 진단 상태는 최신 입력 기준으로 갱신되어야 한다.

### Edge Cases

- 현재 styling/size props가 없는 오브젝트에 `className`이 지정되면 사용자에게 어떻게 경계를 보여주는가?
- 빈 `className`으로 변경하거나 `className` 자체를 제거하면 기존 시각 상태가 정상적으로 해제되는가?
- 같은 파일 안에서 여러 오브젝트의 `className`이 짧은 간격으로 연속 변경되면 마지막 반영 상태가 꼬이지 않는가?
- 지원되는 스타일 항목과 지원되지 않는 스타일 항목이 섞여 있을 때 부분 적용 결과가 일관되게 유지되는가?
- 재열기 또는 다시 렌더한 뒤에도 이전 진단 메시지가 최신 입력 기준으로 정리되는가?
- size, shadow, outline처럼 현재 props와 의미가 겹치는 category가 서로 충돌할 때 우선순위는 어떻게 적용되는가?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 시스템은 workspace 파일의 `className` 변경을 전체 편집 세션을 중단시키지 않고 캔버스 시각 결과에 반영해야 한다.
- **FR-002**: 시스템은 스타일만 변경된 경우 현재 선택 상태, 편집 위치, 캔버스 맥락을 유지해야 한다.
- **FR-003**: 시스템은 같은 오브젝트에 대한 연속 스타일 변경에서 항상 마지막 입력을 기준으로 결과를 반영해야 한다.
- **FR-004**: 시스템은 현재 styling 또는 size 관련 props를 이미 지원하는 오브젝트를 기준으로 eligible object 규칙을 문서화해야 한다.
- **FR-005**: 시스템은 eligible object에 대해 `className` 기반 스타일 결과를 일관되게 적용해야 한다.
- **FR-006**: 시스템은 같은 `className` 입력에 대해 같은 capability를 가진 eligible object에서 동일한 시각 결과를 제공해야 한다.
- **FR-007**: 시스템은 사용자가 파일을 다시 열거나 캔버스를 다시 확인해도 마지막으로 반영된 스타일 결과를 유지해야 한다.
- **FR-008**: 시스템은 문서화된 지원 class category 범위를 제공해야 한다.
- **FR-009**: 시스템은 지원 범위 밖의 `className` 패턴이 있을 때 이를 조용히 성공한 것처럼 처리하면 안 된다.
- **FR-010**: 시스템은 지원되지 않는 `className` 패턴이 있을 때 사용자가 원인을 추적할 수 있는 진단 정보를 제공해야 한다.
- **FR-011**: 시스템은 `className` 문자열에 지원되는 항목과 지원되지 않는 항목이 혼합되어 있을 때 지원되는 항목만 반영하고, 지원되지 않는 항목은 진단 대상으로 남겨야 한다.
- **FR-012**: 시스템은 빈 `className` 또는 제거된 `className`에 대해 이전 스타일 결과를 해제해야 한다.
- **FR-013**: 시스템은 eligible object가 아닌 오브젝트에 `className`이 지정된 경우, 해당 입력이 현재 범위 밖임을 사용자가 이해할 수 있게 해야 한다.
- **FR-014**: 시스템은 동일한 workspace 세션 안에서 스타일 해석 결과가 최신 입력 기준으로 갱신되도록 해야 한다.
- **FR-015**: 시스템은 기능 도입 이후에도 workspace 스타일링과 애플리케이션 자체 스타일링이 서로의 사용자 경험을 방해하지 않도록 유지해야 한다.
- **FR-016**: 시스템은 현재 지원하는 props와 의미가 직접 대응되는 class category를 v1 최우선 지원 범위로 삼아야 한다.
- **FR-017**: 시스템은 v1에서 최소한 size, 기본 visual styling, shadow/elevation, outline/emphasis category를 우선 지원 대상으로 정의해야 한다.
- **FR-018**: 시스템은 sticker outline처럼 현재 제품에서 자주 쓰는 강조 표현을 일반 visual styling과 별도로 검토 가능한 우선 category로 다뤄야 한다.
- **FR-019**: 시스템은 runtime styling 도입 중에도 기존 safelist 기반 dev bootstrap과 공존해야 하며, 기존 개발 흐름을 깨면 안 된다.
- **FR-020**: 시스템은 safelist 생성 또는 dev bootstrap 경로가 runtime styling 경로 도입 이후에도 계속 동작하는지 검증 가능해야 한다.

### Key Entities *(include if feature involves data)*

- **Workspace Style Input**: 사용자가 workspace 파일에서 작성하는 `className` 문자열.
- **Supported Style Surface**: 현재 릴리스에서 `className` 기반 스타일링을 허용하는 eligible object 규칙과 class category 범위.
- **Styled Canvas Object**: `className` 해석 결과가 시각적으로 반영되는 캔버스 오브젝트.
- **Styling Diagnostic**: 지원되지 않는 입력 또는 범위 밖 사용을 사용자에게 설명하는 진단 정보.
- **Style Update Session**: 하나의 workspace 편집 세션 안에서 연속적으로 발생하는 스타일 변경 흐름.
- **Eligible Object Capability**: 현재 styling 또는 size props를 이미 지원해 runtime class 적용 대상이 될 수 있는 오브젝트 속성.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 지원 범위 내 스타일 수정 검증 시나리오의 95% 이상에서 사용자는 편집 세션을 다시 시작하거나 수동 새로고침하지 않고 결과를 확인할 수 있다.
- **SC-002**: 스타일만 수정하는 연속 검증 20회 중 19회 이상에서 선택 상태와 편집 맥락이 유지된다.
- **SC-003**: eligible object 회귀 시나리오의 95% 이상에서 같은 `className` 입력이 같은 시각 결과로 검증된다.
- **SC-004**: 파일 재열기 또는 재확인 시나리오의 95% 이상에서 마지막으로 반영된 스타일 결과가 유지된다.
- **SC-005**: 지원되지 않는 스타일 입력 검증 시나리오의 100%에서 사용자는 어떤 입력이 지원 범위를 벗어났는지 확인할 수 있다.
- **SC-006**: 혼합 입력 검증 시나리오의 95% 이상에서 지원되는 항목은 반영되고 지원되지 않는 항목은 진단 정보로 남는다.
- **SC-007**: 사용자 검증에서 참여자의 90% 이상이 문서화된 지원 범위 안에서 `className` 스타일 수정 작업을 도움 없이 완료한다.
- **SC-008**: size, visual styling, shadow/elevation, outline/emphasis의 우선 category 검증 시나리오에서 95% 이상이 문서화된 기대 결과와 일치한다.
- **SC-009**: runtime styling 도입 후에도 기존 safelist 기반 dev bootstrap 검증 시나리오가 100% 계속 통과한다.

## Assumptions

- workspace 작성자는 계속해서 `.tsx`의 `className`을 주요 스타일 입력 수단으로 사용한다.
- 초기 릴리스는 모든 오브젝트나 모든 스타일 구문을 지원하지 않아도 되며, 대신 eligible object 규칙과 지원 class category를 명확히 문서화한다.
- 기존 애플리케이션 자체 스타일링 방식은 유지되며, 이번 기능은 workspace 스타일 경험 개선에만 초점을 둔다.
- 현재 styling/size props와 의미가 직접 대응되는 class category가 v1 우선 지원 범위로 가장 타당하다.

## Dependencies

- 사용자가 스타일 결과를 즉시 확인할 수 있는 workspace 편집 및 캔버스 갱신 흐름
- eligible object 규칙과 지원 class category 범위를 제품 문서 또는 도움말에 반영할 수 있는 문서화 경로
- 지원되지 않는 입력을 사용자에게 노출할 수 있는 공통 진단 또는 로그 노출 방식
- 기존 safelist 생성과 dev bootstrap 경로를 유지하고 검증할 수 있는 개발 흐름

## Out of Scope

- 모든 스타일 구문, 모든 상태 표현, 모든 테마 변형에 대한 완전 호환
- 애플리케이션 전체 스타일 시스템의 교체 또는 재설계
- 모든 오브젝트 유형을 한 번에 지원 대상으로 확대하는 작업
- `className` 외 새로운 스타일 입력 문법을 이번 기능과 함께 도입하는 작업
