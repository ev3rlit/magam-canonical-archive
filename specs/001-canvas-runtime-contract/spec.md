# Feature Specification: Canvas Runtime Contract

**Feature Branch**: `001-canvas-runtime-contract`  
**Created**: 2026-03-27  
**Status**: Draft  
**Input**: User description: "Use `docs/features/m2/canvas-runtime-contract` as the primary source of truth and fix the shared Canvas Runtime Contract as a framework-neutral published contract for current editor clients, headless automation, and future external consumers."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - React UI Editor Consumes One Runtime Contract (Priority: P1)

As the team maintaining the current React UI editor, we need one shared runtime contract for reading canvas state and submitting mutations so the editor stops owning the runtime meaning model and can behave as a consumer and adapter.

**Why this priority**: The current editor already carries too much runtime meaning. Until the shared contract is fixed, every downstream consumer stays coupled to editor-specific behavior and the runtime cannot become the stable owner of canvas semantics.

**Independent Test**: A reviewer can trace a create, move, content edit, and undo flow using only the published projections, command vocabulary, and result envelopes defined in this spec, without relying on raw storage rows, renderer payloads, or editor-only command names.

**Acceptance Scenarios**:

1. **Given** the editor needs structural, rendering, and edit-target information for the same canvas, **When** it reads the runtime contract, **Then** it receives separate hierarchy, render, and editing projections with distinct responsibilities and no raw storage payload leakage.
2. **Given** the editor submits a mutation with revision expectations, **When** the mutation succeeds, fails validation, or conflicts with a newer revision, **Then** the runtime returns the same shared mutation result family with version boundary, changed set, diagnostics, structured error code, and retryable metadata.
3. **Given** the editor performs body-block edits and later triggers undo or redo, **When** the runtime replays history, **Then** replay uses canonical mutation targets rather than raw UI selection or anchor payloads.

---

### User Story 2 - Headless CLI And Agents Use The Same Language (Priority: P1)

As a headless CLI or AI agent, I need to inspect canvas structure and editing affordances through the same runtime contract so automation can compose domain mutations without touching raw persistence shapes or transport-specific grammar.

**Why this priority**: Headless mutation is the main forcing function for this feature. If automation needs a separate meaning model, the contract has failed its primary purpose.

**Independent Test**: A reviewer can read a canvas tree, identify an editable object body target, run a dry-run mutation, and submit a body-block reorder or node move using only the published contract defined in this spec.

**Acceptance Scenarios**:

1. **Given** a headless consumer needs to understand the canvas, **When** it reads the hierarchy projection, **Then** it can traverse the node tree, parent-child topology, surface membership, and mindmap relationships without reading raw database rows.
2. **Given** a headless consumer needs to mutate object body blocks, **When** it reads the editing projection, **Then** it can target insert, update, remove, and reorder operations through published selection, anchor, or ordered-index metadata instead of transport-specific block grammar.
3. **Given** a headless consumer wants to preview a mutation safely, **When** it requests a dry-run, **Then** it receives validation feedback and changed-set preview through the same shared result contract family used by committed writes.

---

### User Story 3 - Future MCP And Other Clients Integrate Without Redefining Runtime Meaning (Priority: P2)

As a future MCP or other framework client, I need a framework-neutral published language so I can consume the runtime without inventing a second model for canvas structure, rendering metadata, editing affordances, or write outcomes.

**Why this priority**: The contract only becomes durable if new consumers can attach to it directly instead of rebuilding a parallel vocabulary around a renderer, transport, or storage shape.

**Independent Test**: A reviewer can map the responsibilities of a new consumer to the published projections, command vocabulary, and result envelopes without introducing renderer-specific payloads or consumer-owned runtime types.

**Acceptance Scenarios**:

1. **Given** a new consumer needs read access, **When** it adopts the published contract, **Then** it can choose from hierarchy, render, and editing projections according to responsibility instead of reinterpreting one generic payload.
2. **Given** a new consumer needs write access, **When** it submits supported mutations, **Then** it uses the same domain-intent command names and receives the same mutation result, dry-run, conflict, and history semantics as every other consumer.

---

### User Story 4 - Platform Maintainers Keep Storage Behind The Runtime Boundary (Priority: P2)

As a platform maintainer, I need the runtime contract to sit between consumers and persistence so storage evolution stays isolated behind repository translation and downstream consumers never couple themselves to raw rows, ad-hoc patches, or transport-specific payloads.

**Why this priority**: The contract loses its value if consumers can bypass it and mutate persistence directly. The storage boundary is what keeps the runtime language authoritative.

**Independent Test**: A reviewer can classify each in-scope interaction as `consumer -> runtime contract -> canonical business logic -> repository -> persistence` and confirm that no supported flow requires a direct storage or transport shortcut.

**Acceptance Scenarios**:

1. **Given** any current or future consumer submits a supported mutation, **When** the mutation is processed, **Then** the public path passes through the runtime contract and repository translation boundary before reaching persistence.
2. **Given** persistence changes shape internally, **When** the runtime contract remains within scope, **Then** published projections, commands, and result envelopes stay stable because storage translation remains outside the published language.

### Edge Cases

- A consumer only needs one projection type; the runtime still must not force a fallback to raw storage or renderer-specific payloads for the missing responsibilities.
- A body-block target reference based on selection, anchor, or ordered index resolves ambiguously or no longer resolves at write time; the runtime must fail explicitly through the shared error envelope rather than guessing a block.
- A dry-run fails validation or detects a conflict; the runtime must still use the shared result contract family and include actionable diagnostics without mutating state.
- An undo or redo request is attempted after the canvas revision has changed; the runtime must report an explicit conflict instead of silently rebasing the history entry.
- A command affects both canvas topology and object content in one logical mutation batch; the result envelope must still report one coherent changed set and version boundary.
- A downstream client tries to treat raw storage rows, renderer payloads, or transport-specific grammar as published language; those payloads remain outside contract scope and are not supported compatibility surfaces.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST define `Canvas Runtime` as a single bounded context and core domain for shared canvas reading, editing, and history semantics.
- **FR-002**: The system MUST keep `Canvas Aggregate` and `Canonical Object Aggregate` inside the same bounded context while preserving separate ownership boundaries.
- **FR-003**: The system MUST treat the current React UI editor, headless CLI or agent, and future MCP or other external consumers as downstream consumers of the same published language, and those consumers MUST NOT redefine runtime meaning in their own contracts.
- **FR-004**: The system MUST keep persistence and database concerns outside the runtime bounded context and connect to them only through a repository translation boundary.
- **FR-005**: The published language MUST include hierarchy projection, render projection, editing projection, command vocabulary, mutation result envelope, dry-run semantics, conflict envelope, and history, undo, redo semantics.
- **FR-006**: The hierarchy projection MUST be tree-first and MUST expose canvas identity, node hierarchy, parent-child topology, surface membership, mindmap membership or topology, and canonical object linkage for structural understanding.
- **FR-007**: The render projection MUST expose framework-neutral rendering metadata, including surface identity, ordering, bounds or layout state, and other consumer-safe rendering descriptors needed before any renderer-specific adaptation.
- **FR-008**: The editing projection MUST expose editability, capability metadata, source identity, edit target identity, body entry capability, stable body block metadata, and selection, anchor, index targeting metadata for non-interactive and interactive consumers alike.
- **FR-009**: Hierarchy, render, and editing projections MUST remain distinct read contracts with different responsibilities and MUST NOT be treated as substitutes for one another.
- **FR-010**: Published projections MUST NOT expose raw database row shape, ad-hoc patch syntax, or renderer-specific payloads as part of the contract.
- **FR-011**: The command vocabulary MUST express domain intent rather than UI events, transport grammar, or raw persistence patch operations.
- **FR-012**: Equivalent mutations initiated by direct interaction, batch automation, or any other consumer MUST converge on the same published command names and intent semantics.
- **FR-013**: The published canvas command vocabulary MUST include `canvas.node.create`, `canvas.node.move`, `canvas.node.reparent`, `canvas.node.resize`, `canvas.node.rotate`, `canvas.node.presentation-style.update`, `canvas.node.render-profile.update`, `canvas.node.rename`, `canvas.node.delete`, and `canvas.node.z-order.update`.
- **FR-014**: The published object command vocabulary MUST include `object.content.update`, `object.capability.patch`, `object.body.block.insert`, `object.body.block.update`, `object.body.block.remove`, and `object.body.block.reorder`.
- **FR-015**: `canvas.node.resize` MUST use `handle + nextSize + constraint` semantics at the public boundary and MUST NOT use raw drag delta as its contract language.
- **FR-016**: `canvas.node.rotate` MUST use normalized absolute clockwise `nextRotation` semantics at the public boundary.
- **FR-017**: Body-block mutation commands MUST accept location meaning at the input boundary through selection, anchor, or ordered-index targeting semantics rather than forcing consumers to originate raw block identifiers for authoring intent.
- **FR-018**: The `Canvas Aggregate` MUST own canvas revision, node hierarchy, parent-child topology, surface membership, z-order, and mindmap membership or topology semantics.
- **FR-019**: The `Canonical Object Aggregate` MUST own canonical content, capability payloads, ordered body block collections, and body block adjacency or ordering semantics.
- **FR-020**: `BodyBlock` MUST remain an entity-like member inside the `Canonical Object Aggregate` and MUST NOT be promoted to a separate aggregate in this feature.
- **FR-021**: `CanvasNode` MUST reference canonical content through `canonicalObjectId` rather than a direct embedded object contract.
- **FR-022**: The editing projection MUST publish stable per-block metadata so consumers can resolve block targeting and later normalize successful mutations into canonical history replay form.
- **FR-023**: Every write surface MUST return the same mutation result envelope family, including success or failure, version boundary, changed set, warnings, diagnostics metadata, structured error code, and retryable metadata.
- **FR-024**: Dry-run MUST be part of the shared runtime contract, MUST perform validation plus changed-set preview without persisting mutations, and MUST use the same result contract family as committed writes.
- **FR-025**: Version conflicts MUST be expressed through a shared conflict envelope rather than consumer-specific error behavior.
- **FR-026**: Validation failures, dry-run outcomes, and conflicts MUST be first-class runtime outcomes and MUST NOT be treated as UI-only concerns.
- **FR-027**: History MUST record successful semantic mutation batches in canonical replay form and MUST NOT persist raw selection, anchor, or ordered-index references as replay artifacts.
- **FR-028**: Undo and redo semantics MUST be revision-aware and MUST fail explicitly on conflict rather than silently rebasing or guessing a replay target.
- **FR-029**: The public contract MUST define changed-set semantics that let consumers understand which canvases, nodes, objects, body blocks, and related runtime surfaces were affected by a mutation.
- **FR-030**: This feature MUST exclude renderer implementation details, CLI command syntax, external transport implementation, raw database schema publication, full realtime collaboration protocol, plugin publish lifecycle, completion of the full editor refactor, new client implementations, and standalone CLI implementation from scope.

### Key Entities *(include if feature involves data)*

- **Canvas Runtime**: The bounded context and published language that defines how consumers read canvas state, submit domain-intent mutations, and interpret write outcomes.
- **Canvas Aggregate**: The owner of canvas revision, node hierarchy, surface membership, z-order, and mindmap topology.
- **Canonical Object Aggregate**: The owner of canonical content, capability payloads, ordered body blocks, and body block ordering rules referenced by canvas nodes.
- **Canvas Node**: The structural and placement unit inside a canvas that refers to a canonical object through `canonicalObjectId`.
- **Body Block**: An entity-like ordered member of a canonical object body that can be inserted, updated, removed, and reordered but is not its own aggregate.
- **Hierarchy Projection**: The tree-first read contract for structural understanding of node relationships and object linkage.
- **Render Projection**: The framework-neutral read contract for rendering metadata such as surface, ordering, bounds, and layout-relevant information.
- **Editing Projection**: The read contract for editability, command capability, edit target identity, body entry, and stable block targeting metadata.
- **Mutation Result Envelope**: The shared write outcome contract that reports success or failure, version boundaries, changed set, diagnostics, and retryability.
- **Conflict Envelope**: The runtime-level failure contract for version mismatches and other explicit retryable conflicts.
- **History Entry**: The canonical replay record for successful semantic mutation batches used by undo and redo flows.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of the primary read concerns named in this feature map to exactly one published projection category: hierarchy, render, or editing.
- **SC-002**: 100% of the in-scope mutation intents listed in this feature map to one published command name and one owning aggregate.
- **SC-003**: 100% of supported write outcomes in scope, including success, validation failure, dry-run, version conflict, undo, and redo, are described through one shared runtime result vocabulary rather than consumer-specific result formats.
- **SC-004**: 0 supported consumer flows in scope require direct dependence on raw persistence rows, ad-hoc patch payloads, or transport-specific grammar.
- **SC-005**: 100% of documented body-block authoring scenarios in scope can be initiated from published selection, anchor, or ordered-index metadata and replayed through canonical history form.
- **SC-006**: 100% of target consumer classes in scope can complete their documented read and write scenarios by consuming published runtime surfaces only, without redefining the runtime model.

## Assumptions

- The current visual editor, headless tooling, and future external consumers will adopt the published contract incrementally rather than all at once.
- One logical mutation batch may coordinate canvas-owned and object-owned changes while still presenting one shared runtime result envelope to consumers.
- Repository translation absorbs storage-language change so published runtime language can stay stable even if persistence evolves.
- This feature fixes the contract boundary and consumer value first; implementation plans and refactors follow in later work.

## Dependencies

- Source-of-truth contract documents under `docs/features/m2/canvas-runtime-contract` remain aligned with the published feature boundary defined here.
- Repository translation must exist as the only supported bridge between runtime language and storage language.
- Downstream consumer work must adopt the published projections, command vocabulary, and result envelopes instead of creating parallel contracts.
- Later planning work must define validation, changed-set generation, and history normalization behavior consistent with this specification.

## Out of Scope

- Current renderer implementation details
- Headless CLI command syntax or conversational UX grammar
- External transport implementation details
- Raw database schema publication
- Full realtime collaboration protocol
- Plugin publish lifecycle
- Completion of the full editor refactor in this phase
- New client implementations in other frameworks
- Standalone CLI implementation work
