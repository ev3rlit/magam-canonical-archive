# Feature Specification: Overlay Host

**Feature Branch**: `009-overlay-host`  
**Created**: 2026-03-18  
**Status**: Draft  
**Input**: User description: "`/Users/danghamo/Documents/gituhb/magam-feature-dbfcp-overlay-host/docs/features/database-first-canvas-platform/canvas-ui-entrypoints/entrypoint-foundation/overlay-host/README.md`"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 공통 Overlay Host 계약 고정 (Priority: P1)

플랫폼 개발자는 toolbar, selection floating menu, pane context menu, node context menu가 서로 다른 구현체를 가지더라도 같은 overlay host contract를 사용하길 원한다.

**Why this priority**: host contract가 먼저 고정되지 않으면 surface마다 portal, dismiss, focus 규칙이 중복되어 후속 병렬 개발이 깨진다.

**Independent Test**: 네 surface가 동일한 host API(`open`, `close`, `replace`, anchor, layer priority, dismiss reason)를 통해 열리고 닫히는지 확인하면 독립 검증 가능하다.

**Acceptance Scenarios**:

1. **Given** 두 개 이상의 overlay surface가 같은 canvas session에서 실행될 때, **When** overlay를 열면, **Then** 모두 공통 host contract를 통해 lifecycle을 관리한다.
2. **Given** surface 구현이 host contract를 따를 때, **When** 신규 surface를 추가하면, **Then** portal/layering 책임을 재구현하지 않고 slot contribution만 추가한다.

---

### User Story 2 - Dismiss/Focus 일관성 확보 (Priority: P1)

에디터 개발자는 overlay마다 다른 닫힘/포커스 동작이 아니라, outside click, Escape, context 전환 시 동일한 dismiss/focus lifecycle을 원한다.

**Why this priority**: dismiss/focus 불일치는 사용성 회귀와 접근성 결함을 유발하며, surface별 버그를 반복 생산한다.

**Independent Test**: pane/node menu와 selection floating menu에서 동일한 dismiss reason과 focus restore 규칙이 작동하는지 확인하면 독립 검증 가능하다.

**Acceptance Scenarios**:

1. **Given** overlay가 열린 상태에서 사용자가 Escape를 누를 때, **When** host가 이벤트를 처리하면, **Then** overlay는 명시적 dismiss reason과 함께 닫힌다.
2. **Given** overlay가 트리거 요소에서 열렸을 때, **When** overlay가 닫히면, **Then** 포커스는 지정된 return target 또는 owner로 복귀한다.
3. **Given** overlay 외부 pointer 입력이 발생할 때, **When** dismiss가 유효한 상태라면, **Then** host가 surface 공통 규칙으로 닫힘을 처리한다.

---

### User Story 3 - Positioning/Stacking 표준화 (Priority: P2)

UI 엔지니어는 overlay 종류마다 anchor 타입이 달라도 공통 positioning shell과 stacking 우선순위를 통해 안정적으로 배치되길 원한다.

**Why this priority**: anchor/viewport 처리 규칙이 분산되면 화면 경계 침범, z-index 충돌, 재배치 불일치가 반복된다.

**Independent Test**: pointer anchor 기반 메뉴와 selection anchor 기반 메뉴를 동시에 검증해 boundary clamp, layer order, 재배치가 유지되는지 확인하면 독립 검증 가능하다.

**Acceptance Scenarios**:

1. **Given** pane/node menu가 pointer anchor로 열릴 때, **When** 메뉴가 viewport 경계를 넘으려 하면, **Then** host가 safe margin을 유지하도록 위치를 조정한다.
2. **Given** selection floating menu anchor가 이동할 때, **When** selection bounds가 변경되면, **Then** host가 overlay를 재배치한다.
3. **Given** 복수 overlay가 열릴 수 있는 상태일 때, **When** 레이어 충돌 가능성이 생기면, **Then** host가 선언된 우선순위로 stacking 순서를 결정한다.

---

### User Story 4 - Existing Overlay 동작 흡수 (Priority: P2)

플랫폼 개발자는 기존 context menu 구현의 동작을 공통 host primitive로 흡수해 중복 listener/portal 코드를 제거하고 싶다.

**Why this priority**: 기존 동작을 안전하게 흡수하지 못하면 회귀 없이 host 전환을 완료할 수 없다.

**Independent Test**: 기존 context menu shell이 제공하던 portal, viewport clamp, dismiss, initial focus가 host primitive로 동일하게 재현되는지 검증하면 독립 테스트 가능하다.

**Acceptance Scenarios**:

1. **Given** 기존 context menu가 동작 중일 때, **When** host primitive로 전환하면, **Then** 사용자 관찰 가능한 dismiss/focus/positioning 동작이 기능적으로 동일하게 유지된다.
2. **Given** canvas 내부 overlay와 bubble/drag feedback/toast가 공존할 때, **When** overlay를 여닫으면, **Then** 시각적 레이어 충돌 없이 규칙이 유지된다.

### Edge Cases

- overlay가 닫히는 중 target 변경으로 같은 종류 overlay가 즉시 다시 열릴 때, close 후 reopen이 아니라 replace로 처리해야 할지 명확히 규정돼야 한다.
- selection change와 outside pointer dismiss가 동시에 발생할 때 dismiss reason 우선순위가 일관돼야 한다.
- pointer anchor가 viewport 바깥 값으로 들어올 때도 메뉴는 safe margin 안에서 열려야 한다.
- nested overlay(예: 향후 submenu)로 확장될 때 부모/자식 dismiss ordering이 역전되지 않아야 한다.
- canvas 외부 전역 overlay와 canvas overlay가 동시에 존재해도 책임 경계가 섞이지 않아야 한다.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 시스템은 canvas entrypoint overlay를 위한 공통 host contract를 제공해야 한다.
- **FR-002**: 시스템은 `toolbar`, `selection-floating-menu`, `pane-context-menu`, `node-context-menu`를 host slot으로 선언 가능해야 한다.
- **FR-003**: 시스템은 `open`, `close`, `replace` lifecycle API를 제공해야 한다.
- **FR-004**: 시스템은 overlay open/close 시 dismiss reason을 명시적 값으로 기록/전달해야 한다.
- **FR-005**: 시스템은 outside pointer 입력과 Escape 입력을 공통 dismiss 규칙으로 처리해야 한다.
- **FR-006**: 시스템은 overlay open 시 focus target 지정 또는 첫 actionable focus 규칙을 지원해야 한다.
- **FR-007**: 시스템은 overlay close 시 focus return target 또는 owner 복귀 규칙을 지원해야 한다.
- **FR-008**: 시스템은 pointer anchor, selection anchor, viewport-fixed anchor를 공통 positioning shell에서 처리해야 한다.
- **FR-009**: 시스템은 viewport boundary clamp와 safe margin 규칙을 공통 적용해야 한다.
- **FR-010**: 시스템은 복수 overlay 동시 노출 시 layer priority 기반 stacking을 보장해야 한다.
- **FR-011**: 시스템은 target/context 변경 시 overlay를 close 또는 replace로 일관 처리해야 한다.
- **FR-012**: 시스템은 기존 context menu shell 동작(portal, clamp, dismiss, initial focus)을 host primitive로 흡수해야 한다.
- **FR-013**: 시스템은 canvas-level overlay layer order가 bubble overlay, drag feedback, toast와 충돌하지 않도록 유지해야 한다.
- **FR-014**: 시스템은 canvas 외부 전역 overlay(dialog/search/tab menu)와 canvas host overlay의 책임 경계를 명시해야 한다.
- **FR-015**: 시스템은 surface별 action enable/disable 판단을 host가 소유하지 않아야 하며 기존 resolver/routing/state 경계에 남겨야 한다.
- **FR-016**: 시스템은 후속 surface 구현이 개별 `createPortal` 및 전역 document listener를 중복 소유하지 않도록 유도해야 한다.

### Key Entities *(include if feature involves data)*

- **Overlay Host Contract**: overlay lifecycle API와 dismiss/focus/stacking 규칙을 정의하는 공통 계약.
- **Overlay Slot Contribution**: 각 UI surface가 host에 제공하는 slot 등록 단위(종류, 우선순위, anchor 타입, dismiss 정책).
- **Overlay Instance State**: 열린 overlay의 anchor, layer, dismiss reason, focus return target을 담는 runtime 상태.
- **Anchor Descriptor**: pointer 좌표, selection bounds, viewport-fixed 위치를 표준화한 배치 입력 단위.
- **Dismiss Event**: outside pointer, Escape, selection change, teardown 등 닫힘 원인을 표현하는 이벤트 단위.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 대상 4개 surface(`toolbar`, `selection-floating-menu`, `pane-context-menu`, `node-context-menu`)가 100% 동일 host contract를 사용한다.
- **SC-002**: overlay dismiss 회귀 시나리오(outside click, Escape, selection change)에서 규칙 불일치 케이스가 0건이다.
- **SC-003**: overlay focus lifecycle 회귀 시나리오(open focus, close restore)에서 실패율이 0%다.
- **SC-004**: viewport 경계 근처 anchor 배치 시나리오에서 overlay 경계 침범이 0건이다.
- **SC-005**: overlay/bubble/drag feedback/toast 공존 시각 회귀 시나리오에서 z-index 충돌 케이스가 0건이다.
- **SC-006**: 새 overlay surface 추가 시 portal/listener 중복 구현 없이 slot contribution만으로 연결되는 검증 사례를 최소 1건 확보한다.

## Assumptions

- 이 feature는 canvas entrypoint overlay에 한정되며, workspace-level global dialog 계층은 기존 구조를 유지한다.
- overlay host는 runtime-only UI 계층이며 persisted domain state를 직접 소유하지 않는다.
- surface별 action 노출/가시성 판단은 `selection-context-resolver`, `action-routing-bridge`, `ui-runtime-state` 경계를 유지한다.

## Dependencies

- `/Users/danghamo/Documents/gituhb/magam-feature-dbfcp-overlay-host/docs/features/database-first-canvas-platform/canvas-ui-entrypoints/entrypoint-foundation/README.md`
- `/Users/danghamo/Documents/gituhb/magam-feature-dbfcp-overlay-host/docs/features/database-first-canvas-platform/canvas-ui-entrypoints/entrypoint-foundation/overlay-host/README.md`
- `/Users/danghamo/Documents/gituhb/magam-feature-dbfcp-overlay-host/docs/features/database-first-canvas-platform/canvas-ui-entrypoints/README.md`
- `/Users/danghamo/Documents/gituhb/magam-feature-dbfcp-overlay-host/specs/007-object-capability-composition/spec.md`

## Out of Scope

- toolbar/menu 액션 정의 자체, selection 해석, mutation dispatch 구현
- inspector/shortcut/plugin-owned contextual action 확장
- canvas 외부 전역 overlay(dialog/search/tab menu) 구조 변경
- arbitrary non-canvas overlay system 통합
