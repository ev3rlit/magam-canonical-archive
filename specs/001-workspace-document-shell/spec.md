# Feature Specification: Workspace Registry + Document Sidebar

**Feature Branch**: `001-workspace-document-shell`  
**Created**: 2026-03-20  
**Status**: Draft  
**Input**: Source brief: `/Users/danghamo/Documents/gituhb/magam-feature-dbfcp-electron-workspace-document-sidebar/docs/features/database-first-canvas-platform/workspace-document-shell/README.md`

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Workspace 등록과 활성화 (Priority: P1)

사용자는 앱 안에서 로컬 폴더를 기반으로 workspace를 생성하거나 기존 workspace를 등록하고, 여러 workspace 중 하나를 활성화해 작업 범위를 명확히 선택한다.

**Why this priority**: workspace 경계가 고정되지 않으면 이후 document 탐색, 생성, 검색, 복원이 모두 불안정해진다.

**Independent Test**: first-run 상태에서 workspace를 2개 등록하고 active workspace를 전환했을 때 각 workspace의 범위가 분리되어 보이면 독립적으로 검증 가능하다.

**Acceptance Scenarios**:

1. **Given** 등록된 workspace가 없는 상태, **When** 사용자가 `New Workspace`를 선택하고 로컬 폴더를 지정하면, **Then** 앱은 workspace를 등록하고 active workspace로 전환한다.
2. **Given** 기존 로컬 workspace 폴더가 있는 상태, **When** 사용자가 `Add Existing Workspace`로 해당 경로를 선택하면, **Then** 앱은 해당 경로를 registry에 추가하고 workspace로 사용할 수 있다.
3. **Given** 2개 이상의 registered workspace가 있는 상태, **When** 사용자가 switcher에서 다른 workspace를 선택하면, **Then** active workspace와 그 범위의 document context가 함께 전환된다.

---

### User Story 2 - Document-first 사이드바와 문서 생성 (Priority: P1)

사용자는 파일 트리 대신 document 중심 사이드바에서 문서를 탐색하고, `New Document`로 문서를 만든 즉시 해당 canvas로 진입한다.

**Why this priority**: 이 기능이 있어야 file-first 진입에서 workspace->document->canvas 진입 루프로 전환된다.

**Independent Test**: active workspace에서 사이드바를 통해 새 문서를 만들고 즉시 canvas로 열리는지 확인하면 독립 검증 가능하다.

**Acceptance Scenarios**:

1. **Given** active workspace가 존재하는 상태, **When** 사용자가 사이드바를 열면, **Then** primary navigation은 file tree가 아니라 해당 workspace의 document list로 표시된다.
2. **Given** active workspace에 문서가 없는 상태, **When** 사용자가 사이드바를 열면, **Then** empty state와 `New Document` 진입점이 표시된다.
3. **Given** active workspace가 선택된 상태, **When** 사용자가 `New Document`를 실행하면, **Then** 새 document가 persisted authoring unit으로 생성되고 즉시 main canvas가 열린다.

---

### User Story 3 - 로컬 소유성과 경로 이상 상태 처리 (Priority: P2)

사용자는 workspace의 실제 로컬 저장 위치를 확인하고, 경로가 사라졌을 때 명시적으로 reconnect 또는 remove를 선택해 복구한다.

**Why this priority**: 로컬 소유 모델의 신뢰성과 장애 대응을 보장해야 사용자 데이터 소유 가치가 유지된다.

**Independent Test**: active workspace에서 경로 표시/열기 기능을 확인하고, 경로를 의도적으로 끊은 뒤 unavailable 상태와 reconnect 흐름을 검증하면 독립적으로 테스트할 수 있다.

**Acceptance Scenarios**:

1. **Given** active workspace가 있는 상태, **When** 사용자가 workspace 유틸리티를 열면, **Then** 경로 확인, Finder에서 열기, 경로 복사 기능을 사용할 수 있다.
2. **Given** registry에 있는 workspace의 루트 경로가 접근 불가능한 상태, **When** 앱이 workspace 상태를 표시하면, **Then** unavailable 상태와 마지막 경로 및 `Reconnect`/`Remove` 선택지를 제공한다.
3. **Given** unavailable workspace 항목이 있는 상태, **When** 사용자가 reconnect로 새 경로를 지정하면, **Then** workspace는 활성 가능한 상태로 복구된다.

---

### User Story 4 - Legacy 경계 유지 (Priority: P3)

사용자는 새 authoring 루프를 document 중심으로 사용하되, 필요 시 legacy TSX 기반 자산을 compatibility 경로에서 참조하거나 import할 수 있다.

**Why this priority**: 기존 사용자 데이터를 끊지 않으면서도 제품 기본 진입점을 database-first로 전환해야 한다.

**Independent Test**: 새 sidebar의 primary path가 document 중심으로 유지되면서 legacy 경로가 compatibility 위치로만 노출되는지 확인하면 독립 검증 가능하다.

**Acceptance Scenarios**:

1. **Given** 새 sidebar 구조가 적용된 상태, **When** 사용자가 기본 탐색을 수행하면, **Then** `.tsx` file tree는 primary navigation으로 노출되지 않는다.
2. **Given** legacy 데이터가 필요한 상태, **When** 사용자가 compatibility 경로를 사용하면, **Then** 기존 자산을 참조하거나 import할 수 있지만 primary authoring 루프를 대체하지 않는다.

---

### Edge Cases

- workspace root 경로가 심볼릭 링크 또는 대소문자만 다른 경로 표현을 가질 때 중복 등록을 방지해야 한다.
- `New Document` 요청이 연속으로 발생할 때 document title 또는 식별자 충돌 없이 각각 생성돼야 한다.
- active workspace 전환 시 직전 workspace의 selection/search 결과가 다음 workspace에 누수되지 않아야 한다.
- external disk 분리 등으로 workspace가 unavailable 상태가 되더라도 앱이 임의 workspace로 자동 전환되면 안 된다.
- workspace 이름은 같지만 경로가 다른 항목이 존재할 때 switcher는 경로 기반 구분 정보를 제공해야 한다.
- reconnect 시 잘못된 경로를 지정하면 실패 이유를 명시하고 기존 entry를 silent overwrite하면 안 된다.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 시스템은 사용자가 로컬 폴더를 선택해 새 workspace를 생성할 수 있게 해야 한다.
- **FR-002**: 시스템은 사용자가 기존 workspace 폴더 경로를 등록할 수 있게 해야 한다.
- **FR-003**: 시스템은 여러 workspace를 registry로 보관해야 한다.
- **FR-004**: 시스템은 한 번에 하나의 active workspace만 허용해야 한다.
- **FR-005**: 시스템은 active workspace 전환 시 document list, current document context, recent scope를 해당 workspace 범위로 재설정해야 한다.
- **FR-006**: 시스템은 sidebar의 primary navigation을 active workspace의 document list로 제공해야 한다.
- **FR-007**: 시스템은 active workspace에 document가 없을 때 empty state와 `New Document` CTA를 제공해야 한다.
- **FR-008**: 시스템은 `New Document` 실행 시 persisted document를 생성하고 즉시 main canvas 진입을 제공해야 한다.
- **FR-009**: 시스템은 workspace 경로를 사용자가 확인할 수 있게 해야 한다.
- **FR-010**: 시스템은 workspace 경로를 Finder에서 열고 경로를 복사하는 기능을 제공해야 한다.
- **FR-011**: 시스템은 등록된 workspace 경로 접근 실패 시 unavailable 상태를 표시해야 한다.
- **FR-012**: 시스템은 unavailable workspace에 대해 reconnect와 remove 처리를 제공해야 한다.
- **FR-013**: 시스템은 workspace identity를 단순 folder basename이나 임시 파일 목록이 아닌 안정적 식별 단위로 관리해야 한다.
- **FR-014**: 시스템은 workspace별 last-opened 및 last-active document 복원에 필요한 메타데이터를 유지해야 한다.
- **FR-015**: 시스템은 active workspace 범위를 벗어난 runtime state 누수를 방지해야 한다.
- **FR-016**: 시스템은 `.tsx` file tree를 primary authoring navigation에서 제외해야 한다.
- **FR-017**: 시스템은 legacy TSX 경로를 compatibility/import 용도로 유지할 수 있어야 한다.
- **FR-018**: 시스템은 사용자에게 데이터가 선택한 로컬 경로에 저장된다는 점을 명확히 전달해야 한다.

### Key Entities *(include if feature involves data)*

- **Registered Workspace**: 앱이 기억하는 workspace 항목으로 식별자, 표시명, 루트 경로, 상태, 최근 사용 정보를 가진다.
- **Active Workspace Session**: 현재 편집/탐색의 기준 workspace 컨텍스트로 document list, 현재 문서, 검색/복원 범위를 규정한다.
- **Workspace Status**: workspace 접근 가능 여부와 복구 필요 상태를 표현하는 상태 값(`available`, `unavailable`)을 가진다.
- **Document Summary**: active workspace 안의 문서 목록 항목으로 문서 식별자, 제목, 갱신 시점, 진입 대상 canvas 정보를 가진다.
- **Workspace Utility Action**: Finder 열기, 경로 복사, reconnect, remove 등 경로 중심 제어 동작을 표현한다.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 신규 사용자 세션에서 90% 이상이 3분 이내에 workspace 생성 후 첫 document를 열 수 있다.
- **SC-002**: workspace 전환 시 잘못된 workspace 문서가 노출되는 교차 오염 사례가 릴리스 검증에서 0건이다.
- **SC-003**: `New Document` 수행 후 문서 생성 및 canvas 진입 성공률이 99% 이상이다.
- **SC-004**: workspace 경로 이상 상태(unavailable) 시나리오에서 사용자가 reconnect 또는 remove를 통해 복구/정리를 완료하는 비율이 95% 이상이다.
- **SC-005**: sidebar 사용 이벤트 기준으로 document list 진입 비중이 legacy file tree 진입 대비 2배 이상 높다.

## Assumptions

- v1은 단일 창(single-window)에서 단일 active workspace를 기본 동작으로 본다.
- workspace 데이터 저장은 사용자 지정 로컬 경로 기반이며 cloud sync는 범위에서 제외한다.
- legacy TSX 자산은 즉시 제거 대상이 아니라 transition compatibility 대상으로 유지한다.

## Dependencies

- `docs/features/database-first-canvas-platform/workspace-document-shell/README.md`
- `docs/features/database-first-canvas-platform/USECASE.md`
- `docs/features/database-first-canvas-platform/README.md`

## Out of Scope

- 여러 workspace 동시 활성화 및 동시 편집
- 팀 공유/권한/원격 동기화
- implementation 단계에서의 full migration execution
