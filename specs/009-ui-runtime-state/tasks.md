# Tasks: UI Runtime State

**Input**: Design documents from `/Users/danghamo/Documents/gituhb/magam-feature-dbfcp-ui-runtime-state/specs/009-ui-runtime-state/`  
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`

**Tests**: Included. The spec and source docs define explicit verification behavior for dismiss, anchor cleanup, and pending lifecycle, so story-level test tasks are included.

**Organization**: Tasks are grouped by user story so each story can be implemented and validated independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Task can run in parallel (different files, no blocking dependency)
- **[Story]**: User story label for story phases (`US1`~`US4`)
- Every task includes exact file paths

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare runtime-state module scaffolding and reusable test helpers.

- [X] T001 Create runtime-state module scaffolding in `app/features/canvas-ui-entrypoints/ui-runtime-state/{types.ts,selectors.ts,actions.ts,reducer.ts}`
- [X] T002 [P] Create runtime-state test fixture helpers in `app/store/__fixtures__/entrypointRuntimeState.ts`
- [X] T003 [P] Add feature barrel export for runtime-state module in `app/features/canvas-ui-entrypoints/ui-runtime-state/index.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish single store ownership and baseline runtime contract wiring required by all stories.

**⚠️ CRITICAL**: No user story work begins until this phase is complete.

- [X] T004 Wire `entrypointRuntime` sub-slice defaults and store fields in `app/store/graph.ts`
- [X] T005 [P] Implement foundational selectors/action bindings between `app/store/graph.ts` and `app/features/canvas-ui-entrypoints/ui-runtime-state/{selectors.ts,actions.ts,reducer.ts}`
- [X] T006 [P] Add foundational state invariants tests for runtime-only slice presence in `app/store/graph.test.ts`
- [X] T007 [P] Preserve and adapter-map existing hover registry ownership into runtime contract in `app/store/graph.ts` and `app/features/canvas-ui-entrypoints/ui-runtime-state/types.ts`

**Checkpoint**: Graph store hosts one runtime-state owner with baseline selectors/actions and tests.

---

## Phase 3: User Story 1 - Shared Runtime Contract for Entrypoint Surfaces (Priority: P1) 🎯 MVP

**Goal**: Make toolbar and context-menu surfaces consume a single runtime-state owner for active tool and open-surface coordination.

**Independent Test**: Open toolbar and context menus in one session and verify they resolve through shared selectors/actions rather than independent local ownership.

### Tests for User Story 1

- [X] T008 [P] [US1] Add active-tool/open-surface selector-action tests in `app/store/graph.test.ts`
- [X] T009 [P] [US1] Add shared-contract interaction tests for canvas shell, toolbar, and context-menu consumers in `app/components/GraphCanvas.test.tsx`, `app/components/FloatingToolbar.test.tsx`, and `app/components/ContextMenu.test.tsx`

### Implementation for User Story 1

- [X] T010 [US1] Migrate active tool ownership from local component state to runtime slice in `app/components/GraphCanvas.tsx` and `app/store/graph.ts`
- [X] T011 [US1] Migrate toolbar menu open state to runtime `openSurface` contract in `app/components/FloatingToolbar.tsx`
- [X] T012 [US1] Convert context-menu hook to runtime-state adapter in `app/hooks/useContextMenu.ts` and `app/types/contextMenu.ts`
- [X] T013 [US1] Update menu rendering and dismiss integration to shared runtime descriptor in `app/components/ContextMenu.tsx`

**Checkpoint**: US1 is complete when toolbar and context-menu surfaces share one runtime owner for active tool and open surface behavior.

---

## Phase 4: User Story 2 - Deterministic Surface Dismiss and Anchor Lifecycle (Priority: P1)

**Goal**: Centralize open/dismiss rules and anchor snapshot lifecycle for predictable surface behavior.

**Independent Test**: Change selection, pan/zoom viewport, and open competing surfaces to confirm deterministic dismiss and stale-anchor cleanup.

### Tests for User Story 2

- [X] T014 [P] [US2] Add exclusivity and dismiss regression tests in `app/components/GraphCanvas.test.tsx`
- [X] T015 [P] [US2] Add anchor registration and invalidation reducer tests in `app/store/graph.test.ts`

### Implementation for User Story 2

- [X] T016 [US2] Implement one-primary-surface exclusivity and dismiss-policy reducers in `app/features/canvas-ui-entrypoints/ui-runtime-state/reducer.ts`
- [X] T017 [US2] Implement pane/node/selection anchor snapshot registration in `app/components/GraphCanvas.tsx` and `app/features/canvas-ui-entrypoints/ui-runtime-state/actions.ts`
- [X] T018 [US2] Implement stale-anchor cleanup for selection/node/viewport invalidation in `app/store/graph.ts` and `app/features/canvas-ui-entrypoints/ui-runtime-state/reducer.ts`
- [X] T019 [US2] Align pane/node menu open flows to shared anchor and dismiss contract in `app/hooks/useContextMenu.ts` and `app/components/ContextMenu.tsx`

**Checkpoint**: US2 is complete when dismiss and anchor behavior is deterministic and shared across targeted surfaces.

---

## Phase 5: User Story 3 - Runtime Pending State for Editing Feedback (Priority: P2)

**Goal**: Provide request-keyed pending lifecycle state that powers disable/loading/rollback UI behavior.

**Independent Test**: Trigger pending command success and failure flows and verify pending entries are created, transitioned, and cleared correctly.

### Tests for User Story 3

- [X] T020 [P] [US3] Add pending lifecycle reducer tests in `app/store/graph.test.ts`
- [X] T021 [P] [US3] Add pending UI behavior tests in `app/components/GraphCanvas.test.tsx` and `app/components/FloatingToolbar.test.tsx`

### Implementation for User Story 3

- [X] T022 [US3] Implement pending lifecycle actions/selectors (`begin/commit/fail/clear`) in `app/features/canvas-ui-entrypoints/ui-runtime-state/{actions.ts,selectors.ts,reducer.ts}`
- [X] T023 [US3] Wire pending lifecycle state transitions into graph store completion handling in `app/store/graph.ts`
- [X] T024 [US3] Connect command or request identifiers to pending lifecycle integration in `app/features/editing/commands.ts` and `app/store/graph.ts`
- [X] T025 [US3] Consume pending selectors for disable/loading behavior in `app/components/FloatingToolbar.tsx` and `app/components/GraphCanvas.tsx`

**Checkpoint**: US3 is complete when pending feedback is request-keyed, deterministic, and runtime-only.

---

## Phase 6: User Story 4 - Scope-Safe Migration of Existing UI State (Priority: P2)

**Goal**: Complete migration without crossing persistence, mutation-schema, or selection ownership boundaries.

**Independent Test**: Verify migrated files preserve out-of-scope ownership and runtime-only constraints while removing duplicated cross-surface local owners.

### Tests for User Story 4

- [X] T026 [P] [US4] Add runtime-only boundary regression tests (non-persistence of runtime slice) in `app/store/graph.test.ts`
- [X] T027 [P] [US4] Add selection-ownership non-duplication regression tests in `app/components/GraphCanvas.test.tsx`

### Implementation for User Story 4

- [X] T028 [US4] Remove duplicated cross-surface local ownership booleans in `app/components/GraphCanvas.tsx`, `app/components/FloatingToolbar.tsx`, and `app/hooks/useContextMenu.ts`
- [X] T029 [US4] Preserve out-of-scope state paths (search/text-edit/export) during migration and keep `BubbleContext` explicitly external to runtime-state ownership in `app/components/GraphCanvas.tsx`, `app/features/canvas-ui-entrypoints/ui-runtime-state/types.ts`, and `specs/009-ui-runtime-state/quickstart.md`
- [X] T030 [US4] Enforce selection-as-input contract (no duplicate selection ownership fields) in `app/features/canvas-ui-entrypoints/ui-runtime-state/types.ts` and `app/store/graph.ts`
- [X] T031 [US4] Stabilize reusable selector/action surface for future `selection-floating-menu` consumers in `app/features/canvas-ui-entrypoints/ui-runtime-state/{selectors.ts,actions.ts}`

**Checkpoint**: US4 is complete when migration honors all scope boundaries and leaves the feature implementation-ready.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Finalize docs alignment and run targeted verification gates.

- [X] T032 [P] Update runtime-state verification notes in `specs/009-ui-runtime-state/quickstart.md`
- [X] T033 [P] Add contract-to-task traceability notes in `specs/009-ui-runtime-state/plan.md`
- [X] T034 Run focused runtime-state regression suite from `specs/009-ui-runtime-state/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: Starts immediately.
- **Phase 2 (Foundational)**: Depends on Phase 1 and blocks all story work.
- **Phase 3 (US1)**: Depends on Phase 2 and delivers MVP.
- **Phase 4 (US2)**: Depends on Phase 2; integrates with US1 runtime contract.
- **Phase 5 (US3)**: Depends on Phase 2; integrates command completion and pending state.
- **Phase 6 (US4)**: Depends on Phase 2 and validates migration boundaries.
- **Phase 7 (Polish)**: Depends on completed target stories.

### User Story Dependencies

- **US1 (P1)**: Starts after Foundational phase; no dependency on other stories.
- **US2 (P1)**: Starts after Foundational phase; reuses US1 runtime contract patterns.
- **US3 (P2)**: Starts after Foundational phase; depends on command completion integration points.
- **US4 (P2)**: Starts after Foundational phase; validates and hardens boundaries across US1-US3 changes.

### Parallel Opportunities

- Setup: `T002`, `T003` can run in parallel after `T001`.
- Foundational: `T005`, `T006`, `T007` can run in parallel after `T004`.
- US1: `T008`, `T009` can run in parallel.
- US2: `T014`, `T015` can run in parallel.
- US3: `T020`, `T021` can run in parallel.
- US4: `T026`, `T027` can run in parallel.
- Polish: `T032`, `T033` can run in parallel before `T034`.

---

## Parallel Example: User Story 2

```bash
Task: "T014 [US2] Add exclusivity and dismiss regression tests in app/components/GraphCanvas.test.tsx"
Task: "T015 [US2] Add anchor registration and invalidation reducer tests in app/store/graph.test.ts"
```

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 and Phase 2.
2. Complete Phase 3 (US1).
3. Validate US1 independently before proceeding.

### Incremental Delivery

1. Foundation ready: complete Phase 1-2.
2. Deliver US1 (shared runtime contract).
3. Deliver US2 (dismiss and anchors).
4. Deliver US3 (pending lifecycle).
5. Deliver US4 (scope-safe migration and hardening).
6. Finish Polish phase.

### Parallel Team Strategy

1. Foundation owner: `app/store/graph.ts` and runtime-state module.
2. Surface owner: `app/components/{GraphCanvas,FloatingToolbar,ContextMenu}.tsx` and `app/hooks/useContextMenu.ts`.
3. Editing integration owner: `app/features/editing/commands.ts`.
4. Verification owner: `app/store/graph.test.ts`, `app/components/GraphCanvas.test.tsx`, `app/components/FloatingToolbar.test.tsx`, and `app/components/ContextMenu.test.tsx`.

---

## Notes

- Total tasks: 34
- US1 tasks: 6
- US2 tasks: 6
- US3 tasks: 6
- US4 tasks: 6
- Parallelizable tasks: 14
- Suggested MVP scope: Phase 1 through Phase 3 (US1)
- All tasks follow checklist format with IDs, optional `[P]`, optional `[Story]`, and file paths.
