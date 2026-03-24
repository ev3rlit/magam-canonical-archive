# Tasks: Node Create

**Input**: Design notes from `docs/features/m2/canvas-editor/node-create/README.md` and `docs/features/m2/canvas-editor/node-create/implementation-plan.md`
**Prerequisites**: `README.md`, `implementation-plan.md`, `canvas-node-body-contract.ts`, `docs/adr/ADR-0005-database-first-canvas-platform.md`, `docs/adr/ADR-0006-shared-canonical-contract-and-drizzle-split.md`

**Generation Note**: This task list follows the `speckit-tasks` checklist format but is derived from the feature-local README and implementation plan because this slice does not yet have a `.specify` feature scaffold.

**Tests**: Automated coverage is recommended for shared mutation contracts and routing regressions because this slice changes create ownership, revision semantics, and body seed behavior. UI-only polish for floating menus is intentionally excluded because it now belongs to `docs/features/m2/canvas-editor/floating-action-menu/`.

**Organization**: Tasks are grouped by implementation phase and user story so `mindmap-first` create can land as the MVP, followed by body seed, slash command body mutation, and generic native create expansion.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel when the listed files do not overlap with incomplete tasks
- **[Story]**: Which user story the task belongs to (`[US1]`, `[US2]`, `[US3]`, `[US4]`)
- Every task includes the exact file path(s) expected for implementation

## Phase 1: Setup (Shared Scaffolding)

**Purpose**: Create the feature-local contract draft and shared helper scaffolding needed before mutation work starts.

- [x] T001 Align `docs/features/m2/canvas-editor/node-create/README.md`, `docs/features/m2/canvas-editor/node-create/implementation-plan.md`, and `docs/features/m2/canvas-editor/node-create/canvas-node-body-contract.ts` with the final node-create scope after the floating-action-menu split
- [x] T002 [P] Add feature-local barrel or comments for node-create draft ownership in `docs/features/m2/canvas-editor/node-create/canvas-node-body-contract.ts`
- [x] T003 [P] Create canonical create helper scaffolding in `libs/shared/src/lib/canonical-mutation/createCanvasNode.ts` and export it from `libs/shared/src/lib/canonical-mutation/index.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Lock the shared mutation contract, repository helpers, and validation rules before user-story work begins.

**CRITICAL**: No user story work should start before this phase is complete.

- [x] T004 Extend mutation operation types for `canvas.node.create` in `libs/shared/src/lib/canonical-mutation/types.ts`
- [x] T005 [P] Add create-specific canvas node validation helpers in `libs/shared/src/lib/canonical-persistence/validators.ts`
- [x] T006 [P] Add repository support or helper composition for native canvas node creation in `libs/shared/src/lib/canonical-persistence/repository.ts`
- [x] T007 Implement `canvas.node.create` execution branch in `libs/shared/src/lib/canonical-mutation/executor.ts`
- [x] T008 Add shared mutation tests for `canvas.node.create` execution and revision append in `libs/shared/src/lib/canonical-mutation/executor.spec.ts`

**Checkpoint**: The shared DB-first create contract is stable and can be consumed by editor routing.

---

## Phase 3: User Story 1 - Mindmap Root/Child/Sibling Create (Priority: P1) 🎯 MVP

**Goal**: Users can create mindmap root, child, and sibling nodes through canonical mutation instead of the legacy file patch path.

**Independent Test**: In the editor, create a mindmap root, add a child, and add a sibling; each operation should succeed through canonical mutation, append a revision, and survive reload.

### Implementation for User Story 1

- [x] T009 [US1] Implement mindmap placement normalization in `libs/shared/src/lib/canonical-mutation/createCanvasNode.ts`
- [x] T010 [P] [US1] Add mindmap create payload normalization in `app/features/editing/commands.ts`
- [x] T011 [P] [US1] Update action-routing normalization for `mindmap.child.create` and `mindmap.sibling.create` in `app/features/editing/actionRoutingBridge/registry.ts`
- [x] T012 [US1] Route mindmap create descriptors through canonical mutation instead of legacy create descriptors in `app/features/editor/pages/CanvasEditorPage.tsx`
- [x] T013 [US1] Add routing coverage for mindmap root/child/sibling create in `app/features/editing/actionRoutingBridge/registry.test.ts`
- [x] T014 [US1] Add editor integration coverage for canonical mindmap create dispatch in `app/components/editor/WorkspaceClient.test.tsx`

**Checkpoint**: Mindmap create is the first shipped DB-first node-create path.

---

## Phase 4: User Story 2 - Default Markdown Body Seed And Immediate Entry (Priority: P1)

**Goal**: Body-capable mindmap nodes start with a default markdown WYSIWYG block and enter editing immediately after creation.

**Independent Test**: Create a new mindmap node and verify it contains exactly one default markdown block and opens directly into markdown WYSIWYG editing without requiring a second click.

### Implementation for User Story 2

- [x] T015 [US2] Implement body-capable default markdown seed logic in `libs/shared/src/lib/canonical-mutation/createCanvasNode.ts`
- [x] T016 [P] [US2] Update canonical object seed/validation rules for markdown-first body creation in `libs/shared/src/lib/canonical-persistence/validators.ts`
- [x] T017 [P] [US2] Align immediate create edit mode with markdown-first body nodes in `app/components/editor/workspaceEditUtils.ts`
- [x] T018 [US2] Wire create-complete immediate edit entry for new body-capable mindmap nodes in `app/components/GraphCanvas.tsx`
- [x] T019 [US2] Add validator coverage for default markdown body seed in `libs/shared/src/lib/canonical-persistence/validators.spec.ts`
- [x] T020 [US2] Add create-to-edit integration coverage for markdown-first body entry in `app/components/GraphCanvas.test.tsx`

**Checkpoint**: Creating a mindmap node feels like creating a note, not an empty shell.

---

## Phase 5: User Story 3 - Slash Command Block Insert (Priority: P2)

**Goal**: Users can add more body blocks to an existing node through slash commands, with block insertion expressed as canonical object body mutation.

**Independent Test**: In a body-capable node, type `/` to insert a new markdown block and then an image block; both insertions should use canonical body mutation semantics and preserve block order after reload.

### Implementation for User Story 3

- [x] T021 [US3] Extend body block mutation input types for slash-driven insert flows in `libs/shared/src/lib/canonical-mutation/types.ts`
- [x] T022 [P] [US3] Implement slash command to `object.body.block.insert` adapter logic in `app/features/editing/commands.ts`
- [x] T023 [P] [US3] Create slash command inventory for markdown/image body blocks in `app/features/editing/bodySlashCommands.ts`
- [x] T024 [US3] Wire body slash command dispatch into the active body editor path in `app/components/nodes/renderableContent.tsx`
- [x] T025 [US3] Add executor coverage for ordered body block insertion in `libs/shared/src/lib/canonical-mutation/executor.spec.ts`
- [x] T026 [US3] Add editor coverage for slash command block insertion in `app/components/nodes/renderableContent.test.tsx`

**Checkpoint**: Node body growth is mutation-driven and no longer tied to create-only behavior.

---

## Phase 6: User Story 4 - Generic Native Create Expansion And Legacy Isolation (Priority: P2)

**Goal**: The same DB-first create contract expands from mindmap nodes to generic body-capable native nodes, while the legacy file patch create path is demoted to compatibility use only.

**Independent Test**: Create text, sticky, and shape nodes through the editor and confirm they use canonical mutation, receive markdown-first body seed when body-capable, and no longer depend on the legacy file patch primary path.

### Implementation for User Story 4

- [ ] T027 [US4] Extend native create helper support for text, sticky, and shape nodes in `libs/shared/src/lib/canonical-mutation/createCanvasNode.ts`
- [ ] T028 [P] [US4] Normalize generic `node.create` payloads onto the canonical create contract in `app/features/editing/actionRoutingBridge/registry.ts`
- [ ] T029 [P] [US4] Update create gesture defaults for body-capable generic native nodes in `app/features/editing/createDefaults.ts`
- [ ] T030 [US4] Route generic native create dispatch through canonical mutation in `app/features/editor/pages/CanvasEditorPage.tsx`
- [ ] T031 [US4] Demote legacy create handling to compatibility-only code paths in `app/ws/methods.ts` and `app/ws/filePatcher.ts`
- [ ] T032 [US4] Add regression coverage for generic canonical create and legacy isolation in `app/ws/methods.test.ts` and `app/components/editor/WorkspaceClient.test.tsx`

**Checkpoint**: The primary editor no longer depends on file patching to create body-capable native nodes.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Clean up docs, exports, and follow-up notes after the main stories land.

- [ ] T033 [P] Update `docs/features/m2/canvas-editor/node-create/README.md` and `docs/features/m2/canvas-editor/node-create/implementation-plan.md` with implementation alignment notes
- [ ] T034 [P] Record follow-up boundaries between node-create and floating-action-menu in `docs/features/m2/canvas-editor/floating-action-menu/README.md`
- [ ] T035 Document remaining backlog items for plugin node body support, inline text toolbar, and apply-to-all semantics in `docs/features/m2/canvas-editor/node-create/README.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies
- **Foundational (Phase 2)**: Depends on Setup and blocks all user stories
- **US1 (Phase 3)**: Depends on Foundational
- **US2 (Phase 4)**: Depends on US1 because body seed and immediate entry build on the canonical mindmap create path
- **US3 (Phase 5)**: Depends on US2 because slash insert assumes body-capable nodes and body editor entry already exist
- **US4 (Phase 6)**: Depends on Foundational and reuses the contract proven in US1-US3
- **Polish (Phase 7)**: Depends on the stories you intend to ship

### User Story Dependencies

- **US1**: MVP after foundations
- **US2**: Builds directly on US1 create semantics
- **US3**: Builds on US2 body seed/editor presence
- **US4**: Expands the same contract to generic native nodes after the mindmap path is stable

### Within Each User Story

- Lock shared mutation and validation work before editor routing
- Finish routing before editor integration
- Land automated regression coverage before starting the next dependent story

### Parallel Opportunities

- **Phase 1**: T002 and T003 can run in parallel after T001 scope alignment
- **Phase 2**: T005 and T006 can run in parallel after T004
- **US1**: T010 and T011 can run in parallel after T009
- **US2**: T016 and T017 can run in parallel after T015
- **US3**: T022 and T023 can run in parallel after T021
- **US4**: T028 and T029 can run in parallel after T027

---

## Parallel Example: User Story 1

```bash
Task T010: Add mindmap create payload normalization in app/features/editing/commands.ts
Task T011: Update action-routing normalization for mindmap.child.create and mindmap.sibling.create in app/features/editing/actionRoutingBridge/registry.ts
```

## Parallel Example: User Story 2

```bash
Task T016: Update canonical object seed/validation rules in libs/shared/src/lib/canonical-persistence/validators.ts
Task T017: Align immediate create edit mode in app/components/editor/workspaceEditUtils.ts
```

---

## Implementation Strategy

### MVP First

1. Complete Phase 1 and Phase 2
2. Deliver Phase 3 (mindmap root/child/sibling canonical create)
3. Deliver Phase 4 (default markdown body seed + immediate entry)

### Incremental Delivery

1. Land canonical create contract and executor support
2. Ship mindmap-first create
3. Add markdown-first body seed and immediate edit entry
4. Add slash command block insertion
5. Expand to generic native create and demote the legacy path

### Suggested MVP Scope

- Phase 1
- Phase 2
- Phase 3
- Phase 4

---

## Notes

- All tasks follow the required checklist format: checkbox, task ID, optional `[P]`, optional `[US#]`, and explicit file path(s)
- `floating-action-menu` is intentionally excluded from implementation tasks here because it is now a separate feature slice
- The draft contract in `docs/features/m2/canvas-editor/node-create/canvas-node-body-contract.ts` remains feature-local until the runtime shape is stable
