# Feature Specification: MindMap Polymorphic Children

**Feature Branch**: `003-mindmap-polymorphic-children`  
**Created**: 2026-03-02  
**Status**: Draft  
**Input**: User description: "MindMap 자식을 Node 전용에서 확장해 id/from 기반의 다형성 자식 구조로 전환하고, from 누락/중첩 MindMap 정책 및 비동기 재레이아웃 트리거를 정리한다."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Any Component Can Join MindMap Hierarchy (Priority: P1)

As a diagram author, I can place `Sticky`, `Shape`, `Sequence` (and existing `Node`) inside a `MindMap`, and each child with `id` + `from` behaves as a MindMap node for layout and edge connection.

**Why this priority**: This is the core feature value. Without polymorphic children, the feature does not exist.

**Independent Test**: Can be fully tested by rendering one MindMap containing mixed child component types and verifying every child with `from` appears in one tree with expected edges.

**Acceptance Scenarios**:

1. **Given** a MindMap with mixed child types (`Node`, `Sticky`, `Shape`, `Sequence`) and valid `from`, **When** the file is rendered, **Then** all of them participate in the same MindMap tree and are laid out by MindMap layout.
2. **Given** a child component inside MindMap has `from={{ node, edge }}`, **When** rendered, **Then** the relationship (`node`) and edge visuals (`edge`) are applied through one `from` prop.
3. **Given** multiple MindMaps exist on one Canvas, **When** rendered, **Then** each group is layouted independently and globally positioned together without cross-group contamination.

---

### User Story 2 - Invalid MindMap Topology Fails Fast (Priority: P2)

As a diagram author, invalid MindMap authoring is surfaced as explicit errors so I can fix structure quickly.

**Why this priority**: The team decided root guessing is not allowed; explicit topology is required for predictable behavior.

**Independent Test**: Can be tested by feeding malformed inputs and asserting parser errors are emitted with actionable messages.

**Acceptance Scenarios**:

1. **Given** a child component inside MindMap without `from`, **When** rendered, **Then** parsing fails with an explicit error describing missing required `from`.
2. **Given** a `MindMap` nested inside another `MindMap`, **When** rendered, **Then** parsing fails with an explicit unsupported-usage error.
3. **Given** a top-level Canvas with two sibling MindMaps, **When** rendered, **Then** no topology error is raised.

---

### User Story 3 - Async Content Re-triggers Layout Safely (Priority: P3)

As a diagram viewer, when async-rendered content (e.g., images or markdown/code blocks) changes node size after initial render, the MindMap is re-layouted automatically without oscillation.

**Why this priority**: Polymorphic nodes increase size variance; without safe re-layout triggers, final visuals can drift.

**Independent Test**: Can be tested by loading delayed image/markdown content that changes dimensions and asserting automatic bounded re-layout occurs.

**Acceptance Scenarios**:

1. **Given** initial MindMap layout has completed, **When** a MindMap node size changes due to async content, **Then** a debounced auto re-layout is triggered.
2. **Given** small post-layout size jitter, **When** measurements fluctuate within threshold, **Then** no redundant re-layout loop occurs.
3. **Given** repeated size updates, **When** re-layout limit is reached for a graph version, **Then** auto re-layout stops and the UI remains usable.

---

## Edge Cases

- MindMap child uses `from` as string and object forms interchangeably in one graph.
- `from.node` references node ports (`nodeId:portId`) and fully-qualified ids (`map.nodeId`).
- Edge style object omits `edge` subfield (`from={{ node: "root" }}`) and should still connect.
- Child component renders async media that expands late (image decode, markdown code highlight).
- MindMap group contains heavy mixed-size nodes with one very large sequence diagram.
- Multiple sibling MindMaps on one canvas update at different times.
- Existing legacy props (`edgeLabel`, `edgeClassName`) remain in source and require compatibility behavior or migration handling.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST treat any MindMap child component with both `id` and `from` as a MindMap tree node regardless of visual component type.
- **FR-002**: System MUST parse `from` as either `string` or object `{ node: string; edge?: EdgeStyle }`.
- **FR-003**: System MUST create MindMap relationship edges only from parsed `from` data (relation + visual options).
- **FR-004**: System MUST assign MindMap `groupId` to all valid MindMap-participating children so group layout remains type-agnostic.
- **FR-005**: System MUST reject MindMap children missing `from` with a parse-time error (no root inference fallback).
- **FR-006**: System MUST reject nested MindMap usage as unsupported.
- **FR-007**: System MUST allow multiple sibling MindMaps on a single Canvas and process each group independently.
- **FR-008**: System MUST preserve current ELK-based group layout pipeline and use measured node dimensions for placement.
- **FR-009**: System MUST detect post-layout MindMap node dimension changes and schedule debounced auto re-layout in MindMap mode.
- **FR-010**: System MUST include re-layout loop guards (in-flight guard, thresholding, cooldown, and per-graph max retries).
- **FR-011**: System MUST keep UI visible and interactive even if auto re-layout fails.
- **FR-012**: System MUST keep Canvas-only mode behavior unchanged (no MindMap auto-layout trigger logic leakage).
- **FR-013**: System MUST provide deterministic, actionable error messages for invalid topology (`missing from`, `nested mindmap`).

### Key Entities *(include if feature involves data)*

- **FromProp**: Relation declaration for a MindMap child (`string` or object with `node`/`edge`); source of truth for edge creation.
- **MindMapNodeMembership**: Derived runtime membership of a rendered node in a MindMap group (`groupId`, resolved id, node type).
- **MindMapTopologyError**: Structured parser error representing invalid topology authoring cases.
- **LayoutSignature**: Quantized dimension signature of MindMap nodes used to detect meaningful post-layout size changes.
- **RelayoutPolicyState**: Runtime guard state for auto re-layout (last signature, debounce timer, in-flight flag, per-graph count, cooldown timestamp).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In a mixed-component MindMap fixture, 100% of children with valid `from` are included in one group layout and rendered with edges.
- **SC-002**: Invalid topology fixtures (`missing from`, `nested mindmap`) fail deterministically with explicit parse errors in 100% of runs.
- **SC-003**: Async dimension-change fixture triggers at least one automatic re-layout within 500ms after size stabilization.
- **SC-004**: Auto re-layout guard prevents unbounded loops: no fixture exceeds configured max auto re-layout count per graph version.
- **SC-005**: Existing non-MindMap canvas fixtures render without behavior regression in node positioning and interaction.
