# Tasks: Canonical Object Persistence

**Input**: Feature artifacts from `/Users/danghamo/Documents/gituhb/magam-feature-database-first-canvas-platform/specs/001-canonical-object-persistence/`
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`

**Tests**: Required. This feature explicitly requires migration smoke tests, canonical round-trip tests, boundary enforcement tests, note-body projection tests, and clone-on-create regression tests.

**Organization**: Tasks are grouped by user story so each story is independently implementable/testable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on incomplete tasks)
- **[Story]**: User story label (`[US1]`, `[US2]`, `[US3]`, `[US4]`)
- Every task includes a concrete file path

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare canonical persistence module scaffolding and command entrypoints.

- [X] T001 Add canonical persistence dependencies and scripts in `package.json`, `libs/shared/package.json`, and `bun.lock`
- [X] T002 Create shared canonical contract module in `libs/shared/src/lib/canonical-object-contract.ts` and export from `libs/shared/src/index.ts`
- [X] T003 Create canonical persistence module entrypoint in `libs/shared/src/lib/canonical-persistence/index.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Lock schema/bootstrap boundaries and test harness before user-story work.

**CRITICAL**: User story implementation starts only after this phase.

- [X] T004 Create dedicated canonical Drizzle config in `drizzle.canonical.config.ts`
- [X] T005 Define canonical persistence records and structured failure contracts in `libs/shared/src/lib/canonical-persistence/records.ts`
- [X] T006 [P] Create validator and mapper scaffolds in `libs/shared/src/lib/canonical-persistence/validators.ts` and `libs/shared/src/lib/canonical-persistence/mappers.ts`
- [X] T007 [P] Create local embedded `PGlite` bootstrap and migration runner scaffold in `libs/shared/src/lib/canonical-persistence/pglite-db.ts`
- [X] T008 [P] Add import-boundary/architecture guard tests in `libs/shared/src/lib/canonical-persistence/architecture.spec.ts`

**Checkpoint**: canonical module ownership, dependency direction, and migration bootstrap are fixed.

---

## Phase 3: User Story 1 - Canonical Object Storage Shape (Priority: P1) 🎯 MVP

**Goal**: Persist alias-independent canonical objects with strict projection rules for `primaryContentKind` and `canonicalText`.

**Independent Test**: Store/read `Node`, `Shape`, `Sticky`, `Image`, `Markdown`, `Sticker`, `Sequence` fixtures through repository and verify canonical row shape, validation failures, projection invariants, and workspace-scoped uniqueness behavior.

### Tests for User Story 1

- [X] T009 [P] [US1] Add validator tests for alias normalization and content-kind projection rules in `libs/shared/src/lib/canonical-persistence/validators.spec.ts`
- [X] T010 [P] [US1] Add repository round-trip tests for canonical shape and workspace-scoped id behavior in `libs/shared/src/lib/canonical-persistence/repository.spec.ts`

### Implementation for User Story 1

- [X] T011 [US1] Extract canonical semantic/content/capability contracts into `libs/shared/src/lib/canonical-object-contract.ts`
- [X] T012 [US1] Update `app/features/render/canonicalObject.ts` to consume or re-export shared canonical contracts without reverse dependency on persistence module
- [X] T013 [P] [US1] Implement canonical object and relation tables in `libs/shared/src/lib/canonical-persistence/schema.ts`
- [X] T014 [P] [US1] Implement canonical row/entity mapping and projection helpers for `primaryContentKind` + `canonicalText` in `libs/shared/src/lib/canonical-persistence/mappers.ts`
- [X] T015 [US1] Implement provenance/capability/content validation and projection guards in `libs/shared/src/lib/canonical-persistence/validators.ts`
- [X] T016 [US1] Implement canonical object write/read repository flows with workspace-scoped identity enforcement in `libs/shared/src/lib/canonical-persistence/repository.ts`

**Checkpoint**: canonical storage shape is stable and projection invariants are enforced.

---

## Phase 4: User Story 2 - Canonical vs Canvas Ownership Boundary (Priority: P1)

**Goal**: Enforce ownership split so canonical meaning stays in canonical records and canvas stores only placement/composition state.

**Independent Test**: Persist canonical object + canvas node/binding, verify native node canonical reference requirement, prevent canonical payload leakage to canvas props, and confirm tombstone placeholder behavior.

### Tests for User Story 2

- [X] T017 [P] [US2] Add boundary regression tests for canonical-payload leakage prevention in `libs/shared/src/lib/canonical-persistence/boundary.spec.ts`
- [X] T018 [P] [US2] Add tombstoned object placeholder tests for node/binding paths in `libs/shared/src/lib/canonical-persistence/pglite-db.spec.ts`

### Implementation for User Story 2

- [X] T019 [P] [US2] Extend record types for canvas nodes, bindings, and revisions in `libs/shared/src/lib/canonical-persistence/records.ts`
- [X] T020 [P] [US2] Add canvas node/binding/revision tables in `libs/shared/src/lib/canonical-persistence/schema.ts`
- [X] T021 [US2] Implement native-node canonical-reference and canvas-local prop validators in `libs/shared/src/lib/canonical-persistence/validators.ts`
- [X] T022 [US2] Implement repository tombstone-read and binding-placeholder diagnostics in `libs/shared/src/lib/canonical-persistence/repository.ts`

**Checkpoint**: canonical/canvas ownership boundary and tombstone behavior are enforced.

---

## Phase 5: User Story 3 - Editable Note Body Preservation (Priority: P1)

**Goal**: Preserve ordered extensible note bodies via `contentBlocks`/`content_blocks`, support core + namespaced custom blocks, and enforce clone-on-create semantics for editable note-like objects.

**Independent Test**: Round-trip legacy multi-block note fixtures + custom block fixtures, verify block order/payload retention, projection outcomes, empty seed behavior, and create/duplicate/import clone semantics.

### Tests for User Story 3

- [X] T023 [P] [US3] Add validator tests for ordered block invariants, core/custom block validation, body conflict rejection, and empty seed behavior in `libs/shared/src/lib/canonical-persistence/validators.spec.ts`
- [X] T024 [P] [US3] Add repository tests for create/duplicate/import clone-on-create note behavior in `libs/shared/src/lib/canonical-persistence/repository.spec.ts`

### Implementation for User Story 3

- [X] T025 [US3] Extend shared contracts and records with note-body block types in `libs/shared/src/lib/canonical-object-contract.ts` and `libs/shared/src/lib/canonical-persistence/records.ts`
- [X] T026 [P] [US3] Implement `content_blocks` schema and mapper support in `libs/shared/src/lib/canonical-persistence/schema.ts` and `libs/shared/src/lib/canonical-persistence/mappers.ts`
- [X] T027 [US3] Implement `contentBlocks` validation, core/custom block rules, and canonicalText flattening in `libs/shared/src/lib/canonical-persistence/validators.ts`
- [X] T028 [US3] Implement note create/duplicate/import clone enforcement and empty-body seeding in `libs/shared/src/lib/canonical-persistence/repository.ts`
- [X] T029 [US3] Add explicit guard that shared editable-note template/library behavior remains out of scope (reject shared-note reuse path with structured error) in `libs/shared/src/lib/canonical-persistence/repository.ts`

**Checkpoint**: note-body model and clone semantics are fully preserved with backlog-only shared-template posture.

---

## Phase 6: User Story 4 - Persistence Contract Readiness for Next Slice (Priority: P2)

**Goal**: Deliver clean migration assets and stable persistence contracts for mutation/query core handoff.

**Independent Test**: Run clean-database migrations, execute repository smoke paths, verify relation endpoint integrity enforcement, and confirm export surfaces are ready.

### Tests for User Story 4

- [X] T030 [P] [US4] Add clean-database migration smoke coverage in `libs/shared/src/lib/canonical-persistence/migration.spec.ts`
- [X] T031 [P] [US4] Add relation endpoint rejection and public contract smoke tests in `libs/shared/src/lib/canonical-persistence/repository.spec.ts`

### Implementation for User Story 4

- [X] T032 [US4] Generate initial canonical migration artifacts in `libs/shared/src/lib/canonical-persistence/drizzle/`
- [X] T033 [US4] Implement strict relation integrity and structured failure surface finalization in `libs/shared/src/lib/canonical-persistence/repository.ts`
- [X] T034 [US4] Finalize canonical persistence public exports in `libs/shared/src/lib/canonical-persistence/index.ts` and `libs/shared/src/index.ts`

**Checkpoint**: migration baseline and repository contracts are implementation-ready for next slice.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Align feature docs and verification flow with final implementation surface.

- [X] T035 [P] Update verification steps and canonical migration commands in `specs/001-canonical-object-persistence/quickstart.md`
- [X] T036 [P] Update execution notes and acceptance mapping in `specs/001-canonical-object-persistence/plan.md`
- [X] T037 Run `bun test libs/shared/src/lib/canonical-persistence`, `bun run db:generate:canonical`, and `bun run db:migrate:canonical`; record outcomes in `specs/001-canonical-object-persistence/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies
- **Foundational (Phase 2)**: depends on Setup and blocks all stories
- **US1 (Phase 3)**: depends on Foundational
- **US2 (Phase 4)**: depends on US1
- **US3 (Phase 5)**: depends on US1 and US2
- **US4 (Phase 6)**: depends on US1, US2, US3
- **Polish (Phase 7)**: depends on selected story completion

### User Story Dependencies

- **US1**: first MVP increment after foundations
- **US2**: extends US1 schema/repository with ownership boundary constraints
- **US3**: extends US1/US2 with note-body model and clone semantics
- **US4**: freezes migration and handoff contracts after model is complete

### Within Each User Story

- Tests first (must fail before implementation)
- Schema/records/contracts before repository behavior
- Validators/mappers before final repository wiring
- Story verification before next dependent story

### Parallel Opportunities

- **Phase 2**: T006, T007, T008 parallel after T004/T005
- **US1**: T009 + T010 parallel; T013 + T014 parallel
- **US2**: T017 + T018 parallel; T019 + T020 parallel
- **US3**: T023 + T024 parallel; T026 parallel with part of T025 once block contracts are fixed
- **US4**: T030 + T031 parallel
- **Polish**: T035 + T036 parallel

---

## Parallel Example: User Story 3

```bash
# Tests in parallel
Task: "Add validator tests for ordered blocks/core-custom rules in libs/shared/src/lib/canonical-persistence/validators.spec.ts"
Task: "Add clone-on-create repository tests for create/duplicate/import in libs/shared/src/lib/canonical-persistence/repository.spec.ts"

# Implementation in parallel after contracts lock
Task: "Implement content_blocks schema + mapper support in libs/shared/src/lib/canonical-persistence/schema.ts and mappers.ts"
Task: "Implement note clone enforcement and empty-body seeding in libs/shared/src/lib/canonical-persistence/repository.ts"
```

---

## Implementation Strategy

### MVP First

1. Complete Setup and Foundational phases
2. Deliver US1 canonical shape + projection invariants
3. Validate US1 independently before boundary/note extensions

### Incremental Delivery

1. US1: canonical record stability
2. US2: ownership boundary and tombstone behavior
3. US3: note-body extensibility + clone semantics (shared-template still out of scope)
4. US4: migration and contract handoff readiness

### Parallel Team Strategy

1. One owner on schema/contracts (records + schema + validators baseline)
2. One owner on repository behavior and failure contracts
3. One owner on test harness and migration smoke coverage
4. Merge at story checkpoints only after independent test criteria pass
