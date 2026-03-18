# Feature Specification: UI Runtime State

**Feature Branch**: `009-ui-runtime-state`  
**Created**: 2026-03-18  
**Status**: Draft  
**Input**: User description: "Use docs/features/database-first-canvas-platform/canvas-ui-entrypoints/entrypoint-foundation/ui-runtime-state/README.md and implementation-plan.md as source of truth for the database-first canvas platform ui-runtime-state sub-slice."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Shared Runtime Contract for Entrypoint Surfaces (Priority: P1)

As an entrypoint foundation maintainer, I need a single runtime-only UI state contract so toolbar and context-menu surfaces can coordinate through one owner instead of disconnected local state.

**Why this priority**: Without a shared contract, each surface implements conflicting open/close rules and feature work regresses behavior across surfaces.

**Independent Test**: Open and switch between toolbar and context-menu surfaces in one canvas session and verify all targeted surfaces read/write one shared runtime state source.

**Acceptance Scenarios**:

1. **Given** the user opens a toolbar surface, **When** a pane or node context menu is opened, **Then** the previous primary surface closes and only one primary surface remains open.
2. **Given** a surface requires active tool or hover context, **When** it renders, **Then** it reads values from the shared runtime state contract rather than isolated component-local state.

---

### User Story 2 - Deterministic Surface Dismiss and Anchor Lifecycle (Priority: P1)

As an editor user, I need menus and floating surfaces to open, reposition, and dismiss predictably as selection and viewport change.

**Why this priority**: Overlay behavior is the visible interaction baseline; inconsistent dismiss and stale anchors directly break editing flow.

**Independent Test**: Open pane and node context menus, then change selection, pan/zoom viewport, and click canvas to confirm dismiss and anchor cleanup rules are consistently applied.

**Acceptance Scenarios**:

1. **Given** node or selection-tied surface is open, **When** selection changes, **Then** affected surfaces close and stale selection anchors are removed.
2. **Given** a pointer-based pane menu is open, **When** viewport moves or the user clicks canvas, **Then** the menu dismisses according to shared rules.
3. **Given** an anchor target is deleted or invalidated, **When** cleanup runs, **Then** the corresponding anchor snapshot is removed from runtime state.

---

### User Story 3 - Runtime Pending State for Editing Feedback (Priority: P2)

As a user executing edit commands, I need optimistic pending UI state to disable duplicate actions and recover cleanly on success or failure.

**Why this priority**: Pending feedback is required for reliable editing UX and avoids repeated command dispatch while async completion is unresolved.

**Independent Test**: Trigger an edit command that enters pending, then complete once with success and once with failure to confirm lifecycle state and UI feedback cleanup.

**Acceptance Scenarios**:

1. **Given** a command request starts, **When** pending state is recorded by request or command ID, **Then** affected UI surfaces can show loading or disabled states.
2. **Given** the command completes or fails, **When** completion handling runs, **Then** the pending registry entry is updated and cleared without mixing into persisted canvas state.

---

### User Story 4 - Scope-Safe Migration of Existing UI State (Priority: P2)

As a platform maintainer, I need migration boundaries that keep this slice focused on runtime coordination only, so adjacent concerns do not expand scope.

**Why this priority**: The value of this slice is boundary clarity; scope drift into persistence or schema design would block delivery and ownership clarity.

**Independent Test**: Review resulting runtime-state artifacts and verify all in-scope surfaces are migrated while out-of-scope state paths remain owned by existing modules.

**Acceptance Scenarios**:

1. **Given** runtime state migration is complete, **When** inspecting state ownership, **Then** persisted canvas/document/object schema remains unchanged.
2. **Given** selection metadata already has an owner, **When** runtime state consumes selection context, **Then** it uses selection as input and does not duplicate selection metadata ownership.
3. **Given** this sub-slice is delivered, **When** reviewing artifacts, **Then** it does not define canonical mutation schema or action schema contracts.

### Edge Cases

- A rapid sequence of surface-open actions must still converge to one open primary surface.
- Selection changes during an open node menu must dismiss selection-dependent surfaces immediately.
- Viewport pan/zoom after anchor registration must not leave stale screen coordinates that keep menus misplaced.
- Command failures must clear pending state and leave no stale pending entry for the same request ID.
- Runtime-only tool mode changes must not survive full page reload.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST define a single foundation-owned runtime-only UI state slice for canvas entrypoint surfaces.
- **FR-002**: The runtime state slice MUST include active tool state, open primary surface descriptor, anchor snapshot registry, foundation hover registry, and optimistic pending registry.
- **FR-003**: The system MUST keep this slice runtime-only and MUST NOT introduce persisted canvas/document/object schema changes.
- **FR-004**: The system MUST preserve existing selection ownership and consume selection context as input rather than duplicating selection metadata ownership.
- **FR-005**: The system MUST NOT define or redefine canonical mutation schema or action schema contracts in this feature.
- **FR-006**: The system MUST enforce that at most one primary surface is open at any time.
- **FR-007**: The system MUST apply shared dismiss rules for pane context menu, node context menu, toolbar menus, and selection-tied floating surfaces.
- **FR-008**: The system MUST close selection-dependent surfaces when selection changes.
- **FR-009**: The system MUST register runtime anchors as serializable snapshots and MUST NOT store DOM references as state.
- **FR-010**: The system MUST remove stale anchors when related node ownership, selection ownership, or viewport assumptions become invalid.
- **FR-011**: The system MUST provide selectors and actions for opening/closing surfaces, tool switching, anchor registry updates, and pending lifecycle transitions.
- **FR-012**: The system MUST model optimistic pending UI state with request or command IDs as stable keys.
- **FR-013**: The system MUST provide pending lifecycle transitions for begin, commit, fail, and clear behaviors.
- **FR-014**: The system MUST allow consumer surfaces to derive disable/loading/rollback UI from pending state without reading persisted mutation payload.
- **FR-015**: The system MUST allow `canvas-toolbar`, `pane-context-menu`, and `node-context-menu` to consume the same runtime contract.
- **FR-016**: The system MUST keep search UI state, text-edit draft/session state, export dialog state, and unrelated app-wide modal state out of this feature scope.
- **FR-017**: The system MUST avoid introducing a second independent global store for this sub-slice.
- **FR-018**: The system MUST preserve compatibility for future `selection-floating-menu` usage by reusing the same runtime selectors/actions.

### Key Entities *(include if feature involves data)*

- **Entrypoint Runtime State**: Session-lifetime state owned by entrypoint foundation for cross-surface UI coordination.
- **Active Tool State**: Current interaction mode and create mode used by toolbar and canvas consumers.
- **Open Surface Descriptor**: Canonical description of the currently open primary surface, dismissal flags, and anchor linkage.
- **Anchor Snapshot**: Serializable anchor descriptor containing anchor kind, coordinate snapshot, and owner linkage used for overlay positioning.
- **Foundation Hover Registry**: Hover-focused state required by multiple entrypoint surfaces.
- **Pending UI Action**: Request-scoped runtime descriptor for optimistic lifecycle status and UI diagnostics linkage.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In manual verification, 100% of targeted entrypoint surfaces (`canvas-toolbar`, `pane-context-menu`, `node-context-menu`) read/write the same runtime state contract for tool/open-surface coordination.
- **SC-002**: In manual interaction scenarios, the system never presents more than one open primary surface at the same time.
- **SC-003**: In selection-change scenarios, 100% of selection-dependent surfaces dismiss on the selection change event.
- **SC-004**: In pending command lifecycle scenarios (success and failure), stale pending entries for the completed request ID are reduced to zero by the end of lifecycle handling.
- **SC-005**: Reload verification shows active tool and open-surface state are session-only and not persisted across reload.

## Assumptions

- Existing graph/session store ownership is the correct host for runtime UI state in this sub-slice.
- Selection context resolver, overlay host, and action-routing bridge are adjacent consumers/producers and can integrate through documented contracts.
- Surface migration is incremental; consumers can move in phases as long as single ownership is preserved per migrated state.

## Dependencies

- Existing graph store state and selector/action extension points.
- Existing entrypoint surface components and context-menu hook integration points.
- Editing command completion events needed for pending lifecycle transitions.

## Out of Scope

- Persisted schema changes for canvas, document, object, or viewport storage models.
- Canonical mutation schema or new action schema definition.
- Ownership transfer of selection metadata source-of-truth.
- Full redesign of search state, text-edit state, export dialog flows, or app-wide modal systems.
- Full immediate migration of BubbleContext into the foundation overlay host.
