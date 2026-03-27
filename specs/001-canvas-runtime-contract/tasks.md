# Tasks: Canvas Runtime Contract

**Input**: Design documents from `/Users/danghamo/Documents/gituhb/magam-canvas-runtime-contract/specs/001-canvas-runtime-contract/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Included because the implementation plan and constitution require explicit contract, boundary, and regression verification for runtime projections, mutation envelopes, and adapter isolation.

**Organization**: Tasks are grouped by user story so each story can be implemented and validated as an independent increment.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: User story label (`[US1]`, `[US2]`, `[US3]`, `[US4]`)
- Every task includes exact file paths

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the runtime feature root and shared scaffolding required by all later work

- [X] T001 Create the shared runtime package scaffolding in `libs/shared/src/lib/canvas-runtime/index.ts`, `libs/shared/src/lib/canvas-runtime/contracts/index.ts`, `libs/shared/src/lib/canvas-runtime/application/index.ts`, `libs/shared/src/lib/canvas-runtime/projections/index.ts`, and `libs/shared/src/lib/canvas-runtime/history/index.ts`
- [X] T002 [P] Add shared runtime architecture test scaffolding in `libs/shared/src/lib/canvas-runtime/architecture.spec.ts`
- [X] T003 [P] Add feature-level implementation tracking notes in `specs/001-canvas-runtime-contract/tasks.md` and `specs/001-canvas-runtime-contract/contracts/runtime-core-boundary.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Lock the shared runtime boundary, repository ports, and common mutation envelope before any story-specific work begins

**⚠️ CRITICAL**: No user story work should start before this phase is complete

- [X] T004 Mirror the published runtime contract entrypoints in `libs/shared/src/lib/canvas-runtime/contracts/{core.ts,commands.ts,events.ts,projections.ts,results.ts,index.ts}`
- [X] T005 [P] Define runtime repository port interfaces and service context in `libs/shared/src/lib/canvas-runtime/application/{repositoryPorts.ts,serviceContext.ts}`
- [X] T006 [P] Create projection and history service scaffolding in `libs/shared/src/lib/canvas-runtime/projections/{buildHierarchyProjection.ts,buildRenderProjection.ts,buildEditingProjection.ts}` and `libs/shared/src/lib/canvas-runtime/history/{resolveBodyBlockTargets.ts,normalizeReplay.ts}`
- [X] T007 [P] Add shared mutation envelope and changed-set helpers in `libs/shared/src/lib/canvas-runtime/application/mutationEnvelope.ts`
- [X] T008 Adapt `libs/shared/src/lib/canonical-persistence/{repository.ts,index.ts}` to expose runtime-safe repository adapters for the new runtime ports
- [X] T009 Establish runtime application service shells in `libs/shared/src/lib/canvas-runtime/application/{dispatchCanvasMutation.ts,publishRuntimeEvents.ts,repositoryAdapter.ts}`

**Checkpoint**: Shared runtime scaffolding, repository boundary, and common mutation envelope are ready for story work

---

## Phase 3: User Story 1 - React UI Editor Consumes One Runtime Contract (Priority: P1) 🎯 MVP

**Goal**: Make the current React UI editor consume shared render/editing projections and shared mutation result semantics instead of owning runtime meaning locally

**Independent Test**: A reviewer can trace create, move, content edit, and undo flows through shared projections and shared result envelopes without relying on raw storage shapes or editor-owned command semantics

### Tests for User Story 1

- [X] T010 [P] [US1] Add shared projection contract tests for editor read flows in `libs/shared/src/lib/canvas-runtime/projections/projections.spec.ts`
- [X] T011 [P] [US1] Add React editor adapter regression coverage in `app/features/editor/pages/CanvasEditorPage.runtime.spec.tsx` and `app/components/GraphCanvas.test.tsx`

### Implementation for User Story 1

- [X] T012 [P] [US1] Implement the shared render projection builder in `libs/shared/src/lib/canvas-runtime/projections/buildRenderProjection.ts`
- [X] T013 [P] [US1] Implement the shared editing projection builder in `libs/shared/src/lib/canvas-runtime/projections/buildEditingProjection.ts`
- [X] T014 [US1] Refactor `app/features/render/parseRenderGraph.ts` to map render projection DTOs into ReactFlow-specific payloads instead of deriving runtime meaning locally
- [X] T015 [US1] Refactor `app/features/editing/editability.ts` and `app/components/editor/workspaceEditUtils.ts` to consume editing projection metadata for allowed commands, target identity, and body block targeting
- [X] T016 [US1] Update `app/components/GraphCanvas.tsx` and `app/features/editor/pages/CanvasEditorPage.tsx` to emit published runtime commands and consume shared mutation result envelopes
- [X] T017 [US1] Adapt `app/hooks/useCanvasRuntime.ts` to request shared projections and handle shared dry-run, conflict, and history result envelopes for editor flows

**Checkpoint**: User Story 1 is functional when the React editor reads shared projections and submits runtime-owned mutations without local ownership drift

---

## Phase 4: User Story 2 - Headless CLI And Agents Use The Same Language (Priority: P1)

**Goal**: Provide tree-first hierarchy reads, batch mutation dispatch, body block targeting, and dry-run/history semantics that headless consumers can use without transport-specific grammar

**Independent Test**: A reviewer can read a canvas tree, resolve an editable body target, run a dry-run, and submit a body-block reorder or node move using only the shared runtime contract

### Tests for User Story 2

- [X] T018 [P] [US2] Add headless hierarchy and command-dispatch contract tests in `libs/shared/src/lib/canvas-runtime/projections/hierarchyProjection.spec.ts` and `libs/shared/src/lib/canvas-runtime/application/commandDispatcher.spec.ts`
- [X] T019 [P] [US2] Add history normalization tests for body block targeting in `libs/shared/src/lib/canvas-runtime/history/historyReplay.spec.ts`

### Implementation for User Story 2

- [X] T020 [P] [US2] Implement the shared hierarchy projection builder in `libs/shared/src/lib/canvas-runtime/projections/buildHierarchyProjection.ts`
- [X] T021 [P] [US2] Implement the published mutation dispatcher and aggregate routing in `libs/shared/src/lib/canvas-runtime/application/dispatchCanvasMutation.ts`
- [X] T022 [P] [US2] Implement body-block target resolution and canonical replay normalization in `libs/shared/src/lib/canvas-runtime/history/{resolveBodyBlockTargets.ts,normalizeReplay.ts}`
- [X] T023 [US2] Refactor `libs/shared/src/lib/canonical-mutation/{types.ts,executor.ts,object.ts,canvas-node.ts,createCanvasNode.ts}` to sit behind published command translation instead of acting as the public mutation language
- [X] T024 [US2] Refactor `libs/shared/src/lib/canonical-query/{index.ts,render-canvas.ts,workspace-canvas.ts,object-surface-search.ts}` to serve runtime projection inputs and headless read flows rather than storage-shaped query outputs

**Checkpoint**: User Story 2 is functional when a headless consumer can traverse hierarchy data, submit batch mutations, use dry-run, and rely on canonical history replay

---

## Phase 5: User Story 3 - Future MCP And Other Clients Integrate Without Redefining Runtime Meaning (Priority: P2)

**Goal**: Seal a framework-neutral published surface that future clients can consume without inheriting ReactFlow, JSON-RPC, or app-owned runtime types

**Independent Test**: A reviewer can map a new client to shared projection, command, event, and result modules without importing React or transport-specific types

### Tests for User Story 3

- [X] T025 [P] [US3] Add contract leak-prevention tests in `libs/shared/src/lib/canvas-runtime/contracts/contracts.spec.ts` and `libs/shared/src/lib/canvas-runtime/architecture.spec.ts`

### Implementation for User Story 3

- [X] T026 [P] [US3] Finalize framework-neutral contract barrels in `libs/shared/src/lib/canvas-runtime/contracts/{core.ts,commands.ts,events.ts,projections.ts,results.ts,index.ts}`
- [X] T027 [P] [US3] Implement runtime application/control event publishing and invalidation DTOs in `libs/shared/src/lib/canvas-runtime/application/publishRuntimeEvents.ts`
- [X] T028 [US3] Separate transport and React-only types from shared runtime DTOs in `app/hooks/useCanvasRuntime.ts`, `app/ws/methods.ts`, `app/features/editing/actionRoutingBridge/types.ts`, and `app/processes/canvas-runtime/types.ts`
- [X] T029 [US3] Align `app/processes/canvas-runtime/createCanvasRuntime.ts` and `app/processes/canvas-runtime/bindings/actionDispatch.ts` so UI intent routing emits published runtime commands instead of defining the public vocabulary

**Checkpoint**: User Story 3 is functional when a future client can depend on shared runtime exports without importing renderer or transport assumptions

---

## Phase 6: User Story 4 - Platform Maintainers Keep Storage Behind The Runtime Boundary (Priority: P2)

**Goal**: Enforce `consumer -> runtime contract -> canonical business logic -> repository -> persistence` and keep storage-language details isolated behind repository translation

**Independent Test**: A reviewer can inspect the runtime stack and confirm that runtime and app adapters consume repository-safe records rather than raw schema rows or file-patch-owned persistence semantics

### Tests for User Story 4

- [X] T030 [P] [US4] Add repository boundary regression tests in `libs/shared/src/lib/canonical-persistence/{architecture.spec.ts,repository.spec.ts}`

### Implementation for User Story 4

- [X] T031 [P] [US4] Implement the runtime repository adapter over `CanonicalPersistenceRepository` in `libs/shared/src/lib/canvas-runtime/application/repositoryAdapter.ts`
- [X] T032 [P] [US4] Constrain storage translation to `libs/shared/src/lib/canonical-persistence/{repository.ts,mappers.ts,records.ts,validators.ts}` and remove runtime-facing row assumptions from those boundaries
- [X] T033 [US4] Refactor `app/ws/methods.ts` to delegate query and mutation execution through runtime services instead of owning file-patch semantics and storage-shaped mutation behavior
- [X] T034 [US4] Rewire repository-backed projection and mutation integration points in `libs/shared/src/lib/canonical-query/{render-canvas.ts,workspace-canvas.ts}` and `libs/shared/src/lib/canonical-mutation/executor.ts`

**Checkpoint**: User Story 4 is functional when storage translation is isolated to canonical persistence and app/runtime layers no longer leak raw persistence language

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Finish migration guardrails, validate quickstart flows, and clean up remaining ownership drift across stories

- [X] T035 [P] Update feature verification docs in `specs/001-canvas-runtime-contract/{quickstart.md,contracts/runtime-core-boundary.md,contracts/app-adapter-boundary.md}`
- [X] T036 [P] Remove or tag remaining runtime-owner comments in `app/features/render/parseRenderGraph.ts`, `app/features/editing/editability.ts`, `app/components/editor/workspaceEditUtils.ts`, and `app/processes/canvas-runtime/createCanvasRuntime.ts`
- [X] T037 Run shared runtime and adapter regression checks via `bun test` for `libs/shared/src/lib/canvas-runtime`, `libs/shared/src/lib/canonical-*`, and the app hotspot test files touched above
- [X] T038 Execute the quickstart validation in `specs/001-canvas-runtime-contract/quickstart.md` and capture follow-up gaps in `specs/001-canvas-runtime-contract/contracts/app-adapter-boundary.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies
- **Foundational (Phase 2)**: Depends on Setup and blocks all story work
- **User Story 1 (Phase 3)**: Depends on Foundational
- **User Story 2 (Phase 4)**: Depends on Foundational
- **User Story 3 (Phase 5)**: Depends on Foundational and benefits from the shared projection/command work in US1 and US2
- **User Story 4 (Phase 6)**: Depends on Foundational and should land after repository ports and runtime dispatch exist
- **Polish (Phase 7)**: Depends on all intended stories completing

### User Story Dependencies

- **US1**: Starts immediately after Foundational; best MVP slice for the current editor
- **US2**: Starts immediately after Foundational; can run in parallel with US1 once shared scaffolding exists
- **US3**: Depends on stable shared contracts from US1 and shared dispatch/event semantics from US2
- **US4**: Depends on repository ports from Foundational and should integrate after US2 establishes runtime dispatch seams

### Story Completion Order

1. Setup
2. Foundational
3. US1 and US2 in parallel or in P1 order
4. US3
5. US4
6. Polish

## Parallel Opportunities

- T002 and T003 can run together after T001
- T005, T006, and T007 can run in parallel after T004
- T010/T011 and T012/T013 can run in parallel inside US1
- T018/T019 and T020/T021/T022 can run in parallel inside US2
- T025 with T026/T027 can run in parallel inside US3
- T030 with T031/T032 can run in parallel inside US4
- T035 and T036 can run in parallel during Polish

---

## Parallel Example: User Story 1

```bash
# Tests for US1
Task: "Add shared projection contract tests in libs/shared/src/lib/canvas-runtime/projections/projections.spec.ts"
Task: "Add React editor adapter regression coverage in app/features/editor/pages/CanvasEditorPage.runtime.spec.tsx and app/components/GraphCanvas.test.tsx"

# Core implementation for US1
Task: "Implement the shared render projection builder in libs/shared/src/lib/canvas-runtime/projections/buildRenderProjection.ts"
Task: "Implement the shared editing projection builder in libs/shared/src/lib/canvas-runtime/projections/buildEditingProjection.ts"
```

## Parallel Example: User Story 2

```bash
# Tests for US2
Task: "Add headless hierarchy and command-dispatch contract tests in libs/shared/src/lib/canvas-runtime/projections/hierarchyProjection.spec.ts and libs/shared/src/lib/canvas-runtime/application/commandDispatcher.spec.ts"
Task: "Add history normalization tests for body block targeting in libs/shared/src/lib/canvas-runtime/history/historyReplay.spec.ts"

# Core implementation for US2
Task: "Implement the shared hierarchy projection builder in libs/shared/src/lib/canvas-runtime/projections/buildHierarchyProjection.ts"
Task: "Implement the published mutation dispatcher and aggregate routing in libs/shared/src/lib/canvas-runtime/application/dispatchCanvasMutation.ts"
Task: "Implement body-block target resolution and canonical replay normalization in libs/shared/src/lib/canvas-runtime/history/{resolveBodyBlockTargets.ts,normalizeReplay.ts}"
```

## Parallel Example: User Story 3

```bash
# Contracts and events for US3
Task: "Add contract leak-prevention tests in libs/shared/src/lib/canvas-runtime/contracts/contracts.spec.ts and libs/shared/src/lib/canvas-runtime/architecture.spec.ts"
Task: "Finalize framework-neutral contract barrels in libs/shared/src/lib/canvas-runtime/contracts/{core.ts,commands.ts,events.ts,projections.ts,results.ts,index.ts}"
Task: "Implement runtime application/control event publishing and invalidation DTOs in libs/shared/src/lib/canvas-runtime/application/publishRuntimeEvents.ts"
```

## Parallel Example: User Story 4

```bash
# Repository-boundary work for US4
Task: "Add repository boundary regression tests in libs/shared/src/lib/canonical-persistence/{architecture.spec.ts,repository.spec.ts}"
Task: "Implement the runtime repository adapter over CanonicalPersistenceRepository in libs/shared/src/lib/canvas-runtime/application/repositoryAdapter.ts"
Task: "Constrain storage translation to libs/shared/src/lib/canonical-persistence/{repository.ts,mappers.ts,records.ts,validators.ts}"
```

## Implementation Strategy

### MVP First (User Story 1)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1
4. Validate editor read/write flows against shared projections and shared mutation envelopes
5. Stop and review before expanding to broader consumers

### Incremental Delivery

1. Setup + Foundational establish the shared runtime contract seam
2. US1 makes the current React editor a real contract consumer
3. US2 adds headless traversal, dry-run, and canonical replay semantics
4. US3 seals framework-neutral exports for future consumers
5. US4 hardens repository isolation and storage translation boundaries
6. Polish validates quickstart flows and regression coverage across all slices

### Parallel Team Strategy

1. One engineer lands Setup + Foundational
2. After Foundational:
   - Engineer A: US1
   - Engineer B: US2
3. Once US1/US2 stabilize:
   - Engineer C: US3
   - Engineer D: US4
4. Team closes with Polish and quickstart validation

## Notes

- All tasks follow the required checklist format with IDs, optional `[P]`, optional `[US#]`, and exact file paths
- Group membership remains intentionally outside the v1 published runtime contract in this task plan
- `app/processes/canvas-runtime/*` is treated as UI composition runtime, not the shared core runtime
- `app/ws/methods.ts` appears in multiple phases because it must first stop owning public vocabulary and then stop leaking storage semantics
