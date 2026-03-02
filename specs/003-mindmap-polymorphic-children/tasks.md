# Tasks: MindMap Polymorphic Children

**Input**: Design documents from `/Users/danghamo/Documents/gituhb/magam-feature-mindmap-polymorphic-children/specs/003-mindmap-polymorphic-children/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/, quickstart.md

**Tests**: Includes explicit regression tests because the spec requires deterministic topology errors, bounded auto-relayout behavior, and no regression on existing canvas flows.

**Organization**: Tasks are grouped by user story to keep implementation and validation independently executable per story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: User story label (`[US1]`, `[US2]`, `[US3]`)
- Every task includes at least one concrete file path

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare shared fixtures and test scaffolding used by all story phases.

- [X] T001 Add polymorphic MindMap fixture builders for parser tests in `/Users/danghamo/Documents/gituhb/magam-feature-mindmap-polymorphic-children/app/app/page.test.tsx`
- [X] T002 [P] Create layout-signature unit test scaffold in `/Users/danghamo/Documents/gituhb/magam-feature-mindmap-polymorphic-children/app/utils/layoutUtils.test.ts`
- [X] T003 [P] Create relayout behavior test scaffold in `/Users/danghamo/Documents/gituhb/magam-feature-mindmap-polymorphic-children/app/components/GraphCanvas.test.tsx`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared parser/layout primitives required before user stories can be implemented safely.

**⚠️ CRITICAL**: No user story work starts before this phase is complete.

- [X] T004 Add shared `FromProp` parsing and endpoint normalization helpers in `/Users/danghamo/Documents/gituhb/magam-feature-mindmap-polymorphic-children/app/app/page.tsx`
- [X] T005 Add unified edge-construction helper (`from` + legacy edge props compatibility) in `/Users/danghamo/Documents/gituhb/magam-feature-mindmap-polymorphic-children/app/app/page.tsx`
- [X] T006 [P] Add measured-node and MindMap size-signature helpers in `/Users/danghamo/Documents/gituhb/magam-feature-mindmap-polymorphic-children/app/utils/layoutUtils.ts`
- [X] T007 [P] Add `calculateLayout` re-entry guard and `fitViewOnComplete` option in `/Users/danghamo/Documents/gituhb/magam-feature-mindmap-polymorphic-children/app/hooks/useLayout.ts`
- [X] T008 Define parser topology error types/messages for missing-`from` and nested-MindMap in `/Users/danghamo/Documents/gituhb/magam-feature-mindmap-polymorphic-children/app/app/page.tsx`

**Checkpoint**: Shared parser/layout primitives are ready for story implementation.

---

## Phase 3: User Story 1 - Any Component Can Join MindMap Hierarchy (Priority: P1) 🎯 MVP

**Goal**: MindMap 내부에서 visual 타입과 무관하게 `id` + `from` 자식이 동일 계층과 edge 파이프라인에 참여한다.

**Independent Test**: Mixed component MindMap fixture에서 `Node/Sticky/Shape/Sequence`가 모두 같은 그룹 레이아웃과 edge 연결을 갖고 sibling MindMap 그룹이 분리 배치된다.

### Tests for User Story 1

- [X] T009 [P] [US1] Add mixed-component MindMap membership regression test in `/Users/danghamo/Documents/gituhb/magam-feature-mindmap-polymorphic-children/app/app/page.test.tsx`
- [X] T010 [P] [US1] Add `from={{ node, edge }}` edge-style/port mapping regression test in `/Users/danghamo/Documents/gituhb/magam-feature-mindmap-polymorphic-children/app/app/page.test.tsx`
- [X] T011 [P] [US1] Add sibling multi-MindMap group isolation regression test in `/Users/danghamo/Documents/gituhb/magam-feature-mindmap-polymorphic-children/app/app/page.test.tsx`

### Implementation for User Story 1

- [X] T012 [US1] Refactor MindMap child participation logic from `graph-node` type check to `from`-driven processing in `/Users/danghamo/Documents/gituhb/magam-feature-mindmap-polymorphic-children/app/app/page.tsx`
- [X] T013 [US1] Apply `groupId` and scoped node-id resolution consistently across MindMap-capable node branches in `/Users/danghamo/Documents/gituhb/magam-feature-mindmap-polymorphic-children/app/app/page.tsx`
- [X] T014 [US1] Replace `graph-node`-only auto-edge creation with unified helper calls for all MindMap children in `/Users/danghamo/Documents/gituhb/magam-feature-mindmap-polymorphic-children/app/app/page.tsx`
- [X] T015 [US1] Extend core `from` typing to support string/object forms in `/Users/danghamo/Documents/gituhb/magam-feature-mindmap-polymorphic-children/libs/core/src/components/Node.tsx` and `/Users/danghamo/Documents/gituhb/magam-feature-mindmap-polymorphic-children/libs/core/src/components/Sequence.tsx`
- [X] T016 [P] [US1] Extend core `from` typing and position-validation bypass (`from` present) in `/Users/danghamo/Documents/gituhb/magam-feature-mindmap-polymorphic-children/libs/core/src/components/Sticky.tsx` and `/Users/danghamo/Documents/gituhb/magam-feature-mindmap-polymorphic-children/libs/core/src/components/Shape.tsx`
- [X] T017 [P] [US1] Extend core `from` typing and position-validation bypass (`from` present) in `/Users/danghamo/Documents/gituhb/magam-feature-mindmap-polymorphic-children/libs/core/src/components/Sticker.tsx` and `/Users/danghamo/Documents/gituhb/magam-feature-mindmap-polymorphic-children/libs/core/src/components/WashiTape.tsx`
- [X] T018 [US1] Preserve polymorphic `from` payload in edit round-trip paths in `/Users/danghamo/Documents/gituhb/magam-feature-mindmap-polymorphic-children/app/ws/filePatcher.ts` and `/Users/danghamo/Documents/gituhb/magam-feature-mindmap-polymorphic-children/app/ws/methods.ts`

**Checkpoint**: User Story 1 is independently functional (MVP).

---

## Phase 4: User Story 2 - Invalid MindMap Topology Fails Fast (Priority: P2)

**Goal**: `from` 누락과 nested MindMap를 deterministic parse 에러로 즉시 표면화한다.

**Independent Test**: malformed fixture 입력 시 명시적 에러가 발생하고, sibling MindMap fixture는 오류 없이 통과한다.

### Tests for User Story 2

- [X] T019 [P] [US2] Add missing-`from` topology error regression test in `/Users/danghamo/Documents/gituhb/magam-feature-mindmap-polymorphic-children/app/app/page.test.tsx`
- [X] T020 [P] [US2] Add nested-MindMap topology error regression test in `/Users/danghamo/Documents/gituhb/magam-feature-mindmap-polymorphic-children/app/app/page.test.tsx`
- [X] T021 [P] [US2] Add sibling-MindMap non-error regression test in `/Users/danghamo/Documents/gituhb/magam-feature-mindmap-polymorphic-children/app/app/page.test.tsx`

### Implementation for User Story 2

- [X] T022 [US2] Enforce missing-`from` fail-fast validation for MindMap-context children in `/Users/danghamo/Documents/gituhb/magam-feature-mindmap-polymorphic-children/app/app/page.tsx`
- [X] T023 [US2] Enforce nested-MindMap fail-fast validation in `graph-mindmap` parser branch in `/Users/danghamo/Documents/gituhb/magam-feature-mindmap-polymorphic-children/app/app/page.tsx`
- [X] T024 [US2] Surface topology parsing errors through `setGraphError` with actionable details in `/Users/danghamo/Documents/gituhb/magam-feature-mindmap-polymorphic-children/app/app/page.tsx`
- [X] T025 [US2] Add ws regression coverage for object-`from` reparent/update compatibility in `/Users/danghamo/Documents/gituhb/magam-feature-mindmap-polymorphic-children/app/ws/filePatcher.test.ts` and `/Users/danghamo/Documents/gituhb/magam-feature-mindmap-polymorphic-children/app/ws/methods.test.ts`

**Checkpoint**: User Stories 1 and 2 both work independently.

---

## Phase 5: User Story 3 - Async Content Re-triggers Layout Safely (Priority: P3)

**Goal**: 초기 레이아웃 이후 크기 변화에 대해 bounded policy로 자동 재레이아웃을 수행한다.

**Independent Test**: async size-change fixture에서 debounce 기반 자동 재레이아웃이 발생하고, jitter/반복 변화에서 max-attempt 및 guard가 루프를 차단한다.

### Tests for User Story 3

- [X] T026 [P] [US3] Add quantized size-signature and change-detection unit tests in `/Users/danghamo/Documents/gituhb/magam-feature-mindmap-polymorphic-children/app/utils/layoutUtils.test.ts`
- [X] T027 [P] [US3] Add relayout scheduling/guard behavior tests in `/Users/danghamo/Documents/gituhb/magam-feature-mindmap-polymorphic-children/app/components/GraphCanvas.test.tsx`
- [X] T028 [P] [US3] Add `calculateLayout` re-entry guard tests in `/Users/danghamo/Documents/gituhb/magam-feature-mindmap-polymorphic-children/app/hooks/useLayout.test.ts`

### Implementation for User Story 3

- [X] T029 [US3] Add relayout policy refs and graph-reset initialization in `/Users/danghamo/Documents/gituhb/magam-feature-mindmap-polymorphic-children/app/components/GraphCanvas.tsx`
- [X] T030 [US3] Implement size-signature change detection with debounce/cooldown/max-attempt guards in `/Users/danghamo/Documents/gituhb/magam-feature-mindmap-polymorphic-children/app/components/GraphCanvas.tsx`
- [X] T031 [US3] Replace duplicated measured checks with shared `layoutUtils` helpers in `/Users/danghamo/Documents/gituhb/magam-feature-mindmap-polymorphic-children/app/components/GraphCanvas.tsx`
- [X] T032 [US3] Apply `useLayout` re-entry guard and fit-view suppression path for auto-relayout in `/Users/danghamo/Documents/gituhb/magam-feature-mindmap-polymorphic-children/app/hooks/useLayout.ts`
- [X] T033 [US3] Record auto-relayout verification commands and expected behavior in `/Users/danghamo/Documents/gituhb/magam-feature-mindmap-polymorphic-children/specs/003-mindmap-polymorphic-children/quickstart.md`

**Checkpoint**: All user stories are independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Finalize docs/contracts and run cross-story regression validation.

- [X] T034 [P] Update finalized topology and relayout notes in `/Users/danghamo/Documents/gituhb/magam-feature-mindmap-polymorphic-children/docs/features/mindmap-polymorphic-children/README.md`
- [X] T035 [P] Update migration/compatibility notes for legacy edge props in `/Users/danghamo/Documents/gituhb/magam-feature-mindmap-polymorphic-children/specs/003-mindmap-polymorphic-children/contracts/mindmap-polymorphic-host-node-contract.md`
- [X] T036 Run quickstart regression command set and capture results in `/Users/danghamo/Documents/gituhb/magam-feature-mindmap-polymorphic-children/specs/003-mindmap-polymorphic-children/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: Starts immediately.
- **Phase 2 (Foundational)**: Depends on Phase 1 and blocks all user-story phases.
- **Phase 3 (US1)**: Starts after Phase 2; defines MVP.
- **Phase 4 (US2)**: Starts after Phase 2; can run in parallel with US1 but merges easiest after US1 parser refactor.
- **Phase 5 (US3)**: Starts after Phase 2; can run in parallel with US1/US2 with coordination on `GraphCanvas.tsx` and `useLayout.ts`.
- **Phase 6 (Polish)**: Starts after desired user stories complete.

### User Story Dependencies

- **US1 (P1)**: No dependency on other stories.
- **US2 (P2)**: Depends only on foundational parser helpers; independently testable.
- **US3 (P3)**: Depends on foundational layout helpers; independently testable.

### Within Each User Story

- Regression tests first (or in parallel test-prep batch), then implementation.
- Parser/layout contract updates before ws compatibility hardening.
- Story acceptance checkpoints must pass before moving to lower-priority delivery.

### Parallel Opportunities

- Setup: `T002`, `T003` parallel.
- Foundational: `T006`, `T007` parallel after `T004`/`T005`.
- US1: `T009`, `T010`, `T011` parallel; `T016` and `T017` parallel.
- US2: `T019`, `T020`, `T021` parallel.
- US3: `T026`, `T027`, `T028` parallel.
- Polish: `T034`, `T035` parallel, then `T036`.

---

## Parallel Example: User Story 1

```bash
Task: "Add mixed-component MindMap membership regression test in app/app/page.test.tsx"
Task: "Add from-object edge-style/port mapping regression test in app/app/page.test.tsx"
Task: "Add sibling multi-MindMap group isolation regression test in app/app/page.test.tsx"
```

## Parallel Example: User Story 2

```bash
Task: "Add missing-from topology error regression test in app/app/page.test.tsx"
Task: "Add nested-MindMap topology error regression test in app/app/page.test.tsx"
Task: "Add sibling-MindMap non-error regression test in app/app/page.test.tsx"
```

## Parallel Example: User Story 3

```bash
Task: "Add quantized size-signature and change-detection unit tests in app/utils/layoutUtils.test.ts"
Task: "Add relayout scheduling/guard behavior tests in app/components/GraphCanvas.test.tsx"
Task: "Add calculateLayout re-entry guard tests in app/hooks/useLayout.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 (Setup)
2. Complete Phase 2 (Foundational)
3. Complete Phase 3 (US1)
4. Validate US1 independently with mixed-component MindMap fixture
5. Demo/deploy MVP increment

### Incremental Delivery

1. Setup + Foundational establishes parser/layout contracts.
2. Deliver US1 for polymorphic participation and unified `from` edges.
3. Deliver US2 for deterministic topology errors.
4. Deliver US3 for bounded async auto-relayout.
5. Finish polish and regression execution.

### Parallel Team Strategy

1. Team aligns on Phase 1-2 together.
2. Then parallelize by story:
   - Engineer A: US1 parser/core typing
   - Engineer B: US2 topology fail-fast + error surfacing
   - Engineer C: US3 relayout trigger + guard policy
3. Merge with shared-file sequencing (`app/app/page.tsx`, `app/components/GraphCanvas.tsx`, `app/hooks/useLayout.ts`).

---

## Notes

- `[P]` tasks are parallel-safe only after upstream dependencies finish.
- Each story phase retains independent validation criteria from `spec.md`.
- Keep diffs surgical on listed files to minimize regressions.
