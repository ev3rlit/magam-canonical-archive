# Feature Specification: TSX-Backed Canvas Editing Commands

**Feature Branch**: `006-canvas-editing-commands`  
**Created**: 2026-03-13  
**Status**: Draft  
**Input**: User description: "`/Users/danghamo/Documents/gituhb/magam-feature-web-editing-board-document/docs/features/canvas-editing/README.md`"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Safe Direct Edit for Existing Objects (Priority: P1)

캔버스 편집자는 기존 오브젝트를 드래그하거나, 텍스트를 수정하거나, 허용된 스타일만 조정할 때 코드에서는 의도한 필드만 바뀌고 나머지 구조는 그대로 유지되길 원한다.

**Why this priority**: 가장 자주 발생하는 편집 동작이며, "웹에서 고쳤더니 코드가 과도하게 바뀌는 문제"를 먼저 해결해야 전체 편집 신뢰도가 확보된다.

**Independent Test**: 사용자가 오브젝트 이동, 텍스트 수정, 허용된 스타일 수정을 각각 수행한 뒤 TSX diff를 확인했을 때, 이동은 좌표 관련 필드만, 텍스트 편집은 콘텐츠 관련 필드만, 스타일 수정은 허용된 스타일 필드만 바뀌면 독립 검증이 가능하다.

**Acceptance Scenarios**:

1. **Given** 절대 좌표 기반 오브젝트가 있고, **When** 사용자가 위치를 이동하면, **Then** 시스템은 위치 관련 값만 변경한다.
2. **Given** 텍스트 또는 마크다운 콘텐츠를 가진 오브젝트가 있고, **When** 사용자가 내용을 수정하면, **Then** 시스템은 해당 오브젝트의 콘텐츠 표현만 변경한다.
3. **Given** 스타일 편집이 허용된 오브젝트가 있고, **When** 사용자가 허용된 스타일 필드를 수정하면, **Then** 시스템은 허용된 스타일 필드만 변경한다.
4. **Given** 편집 반영 대상이 선택된 오브젝트 하나로 결정되어 있고, **When** 편집을 저장하면, **Then** 비선택 오브젝트에는 변경이 없어야 한다.

---

### User Story 2 - Create New Objects from Web Editing (Priority: P1)

캔버스 편집자는 웹에서 도형/텍스트/마크다운/장식 오브젝트를 새로 만들고, 그 결과가 TSX에 일관된 구조로 반영되길 원한다.

**Why this priority**: "직접 만든다"는 소유감은 수정뿐 아니라 생성 경험에서 가장 강하게 형성되며, 생성이 없으면 웹 편집 가치는 제한된다.

**Independent Test**: 사용자가 Canvas 생성과 MindMap 자식/형제 생성을 각각 수행했을 때, 생성된 오브젝트가 즉시 렌더되고 TSX에도 유효한 신규 요소로 저장되면 독립 검증이 가능하다.

**Acceptance Scenarios**:

1. **Given** 사용자가 Canvas 생성 도구를 선택했고, **When** 캔버스 빈 공간에서 생성을 실행하면, **Then** 새 오브젝트가 생성되고 TSX에 저장된다.
2. **Given** 사용자가 MindMap 노드를 선택했고, **When** "자식 추가"를 실행하면, **Then** 새 자식 노드가 올바른 부모 관계로 생성되어 저장된다.
3. **Given** 사용자가 MindMap 노드를 선택했고, **When** "형제 추가"를 실행하면, **Then** 같은 부모 맥락의 새 노드가 생성되어 저장된다.

---

### User Story 3 - Structure Editing for MindMap (Priority: P2)

캔버스 편집자는 MindMap에서 노드 관계를 바꿀 때 좌표값 임시 조정이 아니라 구조 변경으로 저장되길 원한다.

**Why this priority**: MindMap의 핵심 가치는 구조이며, 구조 편집이 좌표 편집으로 저장되면 재편집과 자동 배치 품질이 무너진다.

**Independent Test**: 사용자가 부모 변경을 수행했을 때 관계 필드만 변경되고, 사이클 같은 금지 상태는 저장 거부되는지 확인하면 독립 검증이 가능하다.

**Acceptance Scenarios**:

1. **Given** MindMap 노드가 있고, **When** 사용자가 유효한 부모 변경을 수행하면, **Then** 관계 표현이 새 부모 기준으로 저장된다.
2. **Given** 변경 시도가 사이클을 만들면, **When** 저장을 시도하면, **Then** 시스템은 반영을 거부하고 원인을 안내한다.
3. **Given** MindMap 맥락이 아닌 대상이 선택되면, **When** 구조 변경을 시도하면, **Then** 시스템은 지원 범위 밖임을 명확히 안내한다.

---

### User Story 4 - Predictable Reliability and Recovery (Priority: P2)

캔버스 편집자는 충돌 또는 실패가 발생해도 부분 반영 없이 되돌아가고, undo/redo가 편집 단위로 일관되게 동작하길 원한다.

**Why this priority**: 편집 성공률 못지않게 실패 시 예측 가능성이 중요하며, 충돌/되돌리기 품질이 낮으면 웹 편집 전체 신뢰를 잃는다.

**Independent Test**: 버전 충돌, 대상 누락, 유효성 실패를 각각 발생시켰을 때 롤백/안내/히스토리 단위가 기대대로 동작하면 독립 검증이 가능하다.

**Acceptance Scenarios**:

1. **Given** 외부 변경으로 기준 버전이 달라진 상태에서, **When** 편집 저장을 시도하면, **Then** 저장은 거부되고 재동기화 안내가 제공된다.
2. **Given** 편집이 실패했을 때, **When** UI를 확인하면, **Then** optimistic 변경은 롤백되고 실패 원인이 노출된다.
3. **Given** 사용자가 undo/redo를 실행하면, **When** 명령이 적용되면, **Then** 편집 완료 이벤트 단위로 정확히 1단계씩 반영된다.

### Edge Cases

- 대상 오브젝트의 편집 가능 패턴이 아닌 TSX 표현(복잡한 계산식, 스프레드, 불명확 children)일 때 어떻게 처리되는가?
- 동일 식별자가 이미 존재하는 상태에서 rename 또는 create를 시도하면 어떻게 차단하고 안내하는가?
- attach 기반 오브젝트 이동에서 부모/대상이 삭제되었거나 유효하지 않을 때 어떻게 처리되는가?
- MindMap 다중 루트 상황에서 sibling 생성 시 부모가 없는 경우를 어떻게 정의하는가?
- 빠른 연속 편집 중 같은 대상에 대한 이벤트 순서가 뒤바뀌면 어떤 기준으로 일관성 유지하는가?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 시스템은 웹 조작을 TSX 반영 가능한 편집 명령 단위로 해석해야 한다.
- **FR-002**: 시스템은 절대 좌표 기반 이동 편집에서 위치 관련 필드 외 변경을 만들면 안 된다.
- **FR-003**: 시스템은 상대 배치 기반 이동 편집에서 관계 의미를 유지한 채 상대값만 갱신해야 한다.
- **FR-004**: 시스템은 텍스트/마크다운 편집에서 콘텐츠 표현 외 필드 변경을 만들면 안 된다.
- **FR-005**: 시스템은 선택된 단일 대상만 편집 반영 대상으로 삼아야 한다.
- **FR-006**: 시스템은 웹에서 신규 오브젝트 생성을 지원해야 한다.
- **FR-007**: 시스템은 Canvas 생성과 MindMap 자식/형제 생성을 구분해 저장해야 한다.
- **FR-008**: 시스템은 생성 시 유효한 식별자 정책을 적용하고 중복을 거부해야 한다.
- **FR-009**: 시스템은 MindMap 부모 변경 편집을 지원해야 한다.
- **FR-010**: 시스템은 부모 변경 시 사이클이 생기면 저장을 거부해야 한다.
- **FR-011**: 시스템은 노드 rename을 지원하고 참조 무결성을 유지해야 한다.
- **FR-012**: 시스템은 편집 명령 반영 전 기준 버전 검사를 수행해야 한다.
- **FR-013**: 시스템은 충돌 또는 유효성 실패 시 부분 반영 없이 전체 명령을 거부해야 한다.
- **FR-014**: 시스템은 실패 시 사용자에게 원인을 이해 가능한 메시지로 안내해야 한다.
- **FR-015**: 시스템은 편집 완료 이벤트 히스토리를 유지해야 한다.
- **FR-016**: 시스템은 undo 1회에 편집 완료 이벤트 1건만 되돌려야 한다.
- **FR-017**: 시스템은 redo 1회에 직전 undo 이벤트 1건만 복원해야 한다.
- **FR-018**: 시스템은 편집 가능 범위를 벗어난 TSX 패턴을 read-only로 처리할 수 있어야 한다.
- **FR-019**: 시스템은 기존 렌더 및 레이아웃 동작을 깨지 않고 편집 기능을 확장해야 한다.
- **FR-020**: 시스템은 허용된 스타일 필드만 수정하는 whitelist 기반 style 편집을 지원해야 한다.

### Key Entities *(include if feature involves data)*

- **Edit Command**: 웹 조작을 저장 가능한 단위로 표현한 명령 객체.
- **Edit Target**: 렌더된 노드에서 원본 TSX 식별자로 라우팅되는 편집 대상.
- **Edit Metadata**: 대상 노드의 편집 가능 범위와 캐리어 정보를 나타내는 메타데이터.
- **Edit Completion Event**: undo/redo의 최소 단위를 이루는 완료 이벤트.
- **Creation Placement**: Canvas 절대 생성, MindMap 자식 생성, MindMap 형제 생성 맥락 정보.
- **Reference Surface**: rename 시 동기화가 필요한 관계/참조 필드 집합.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 위치 이동 회귀 시나리오의 95% 이상에서 TSX 변경이 위치 관련 필드로만 제한된다.
- **SC-002**: 콘텐츠 편집 회귀 시나리오의 95% 이상에서 TSX 변경이 콘텐츠 관련 필드로만 제한된다.
- **SC-003**: 생성 시나리오의 95% 이상에서 신규 오브젝트가 유효한 TSX로 저장되고 즉시 렌더된다.
- **SC-004**: 부모 변경 시나리오의 99% 이상에서 유효한 변경은 성공하고 사이클 시도는 100% 거부된다.
- **SC-005**: 충돌/유효성 실패 시나리오의 100%에서 부분 반영 없이 롤백과 안내가 제공된다.
- **SC-006**: undo/redo 회귀 시나리오의 99% 이상에서 이벤트 단위 1-step 동작이 보장된다.
- **SC-007**: quickstart의 수동 검증 시나리오 중 "수정 + 생성 + 구조변경"을 포함한 연속 세션 검증을 10회 수행했을 때, 최소 9회 이상에서 수동 TSX 편집이나 임시 복구 단계 없이 완료된다.
- **SC-008**: 스타일 편집 회귀 시나리오의 95% 이상에서 허용된 스타일 필드만 변경되고 비허용 필드는 유지된다.

## Assumptions

- TSX 파일이 편집의 단일 기준이며 렌더 상태는 TSX에서 파생된다.
- 현재 render metadata(`sourceMeta`)는 유지되며 필요한 편집 메타는 확장 가능하다.
- 기존 RPC/AST patch 경계를 재사용하되 명령별 patcher 분리를 허용한다.
- 본 스코프는 canvas-editing README에 정의된 TSX 기반 편집 명령 설계에 한정한다.

## Dependencies

- 웹 렌더 결과에서 원본 편집 대상을 식별할 수 있는 라우팅 메타.
- 버전 기반 충돌 제어와 파일 변경 알림 경로.
- 명령 실패를 사용자에게 노출할 공통 오류 처리 UX.

## Out of Scope

- 협업 동시 편집(CRDT/OT) 설계 및 구현
- AI 채팅 기능 자체의 확장
- 편집 범위를 벗어난 임의 TSX 패턴의 완전 자동 편집 지원
