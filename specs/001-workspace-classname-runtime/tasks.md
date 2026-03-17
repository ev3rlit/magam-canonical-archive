# Tasks: Workspace `className` Runtime

**Input**: Design docs from `/Users/danghamo/Documents/gituhb/magam-feature-workspace-classname-runtime/specs/001-workspace-classname-runtime/`  
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`

**Tests**: Include focused regression tests because success criteria are measurable and behavior-sensitive.

**Organization**: Tasks are grouped by user story for independent implementation and verification.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare workspace styling feature boundaries and shared type scaffolding.

- [X] T001 Create workspace styling module scaffold in `app/features/workspace-styling/index.ts`
- [X] T002 [P] Define shared workspace styling types in `app/features/workspace-styling/types.ts`
- [X] T003 [P] Add v1 class category registry skeleton in `app/features/workspace-styling/classCategories.ts`
- [X] T004 [P] Add eligible object capability resolver skeleton in `app/features/workspace-styling/eligibility.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish interpretation, diagnostics, and session freshness plumbing used by all stories.

**CRITICAL**: No user story tasks begin before this phase completes.

- [X] T005 Implement interpreter facade interface in `app/features/workspace-styling/interpreter.ts`
- [X] T006 [P] Implement style update session tracker in `app/features/workspace-styling/sessionState.ts`
- [X] T007 [P] Implement diagnostics model and normalizers in `app/features/workspace-styling/diagnostics.ts`
- [X] T008 [P] Add workspace style state hooks in `app/store/graph.ts`
- [X] T009 [P] Add foundational unit tests for class categories and eligibility in `app/features/workspace-styling/classCategories.test.ts` and `app/features/workspace-styling/eligibility.test.ts`
- [X] T010 [P] Add foundational unit tests for interpreter/session/diagnostics in `app/features/workspace-styling/interpreter.test.ts`, `app/features/workspace-styling/sessionState.test.ts`, and `app/features/workspace-styling/diagnostics.test.ts`
- [X] T011 Wire style extraction inputs from workspace edit path in `app/components/editor/workspaceEditUtils.ts`

**Checkpoint**: Shared interpretation, eligibility, diagnostics, and session ordering surfaces are stable.

---

## Phase 3: User Story 1 - Instant Workspace Style Feedback (Priority: P1) MVP

**Goal**: Style-only workspace edits update visible style immediately while preserving editor context.

**Independent Test**: Repeated `className` edits on an eligible object show latest style and preserve selection/context.

### Tests for User Story 1

- [X] T012 [P] [US1] Add style-only sync flow tests in `app/hooks/useFileSync.test.ts`
- [X] T013 [P] [US1] Add context-retention tests during style updates in `app/components/GraphCanvas.test.tsx`

### Implementation for User Story 1

- [X] T014 [US1] Wire workspace style update pipeline into editor update path in `app/components/editor/WorkspaceClient.tsx`
- [X] T015 [US1] Apply interpreted style payload and reset semantics in `app/components/nodes/BaseNode.tsx`
- [X] T016 [US1] Enforce last-write-wins handling for rapid updates in `app/features/workspace-styling/sessionState.ts`
- [X] T017 [US1] Implement empty/removed class reset behavior in `app/features/workspace-styling/interpreter.ts`

**Checkpoint**: US1 works independently and satisfies immediate feedback expectations.

---

## Phase 4: User Story 2 - Predictable Styling by Supported Class Category (Priority: P2)

**Goal**: Eligible object + class category 기반으로 결과가 결정적이고 재현 가능하게 동작한다.

**Independent Test**: 동일 capability의 eligible object에 같은 `className`을 적용하면 같은 결과가 나오고 재열기 후에도 유지된다.

### Tests for User Story 2

- [X] T018 [P] [US2] Add category-priority interpretation tests in `app/features/workspace-styling/interpreter.test.ts`
- [X] T019 [P] [US2] Add reopen/rerender consistency tests in `app/components/editor/WorkspaceClient.test.tsx`

### Implementation for User Story 2

- [X] T020 [US2] Define v1 priority class categories (size, basic visual styling, shadow/elevation, outline/emphasis) in `app/features/workspace-styling/classCategories.ts`
- [X] T021 [US2] Define eligible object rules from existing styling/size props surfaces in `app/features/workspace-styling/eligibility.ts`
- [X] T022 [US2] Implement deterministic category normalization and apply ordering in `app/features/workspace-styling/interpreter.ts`
- [X] T023 [US2] Persist and restore latest accepted style state across rerender/reopen in `app/store/graph.ts`
- [X] T024 [US2] Route non-eligible object inputs to out-of-scope outcomes in `app/features/workspace-styling/interpreter.ts`

**Checkpoint**: US2 independently guarantees deterministic category-based behavior.

---

## Phase 5: User Story 3 - Clear Handling of Unsupported Styling (Priority: P3)

**Goal**: Unsupported category/token/object 입력이 진단 가능하고 mixed input은 부분 적용된다.

**Independent Test**: Mixed/unsupported input에서 valid category는 반영되고 unsupported 입력은 진단으로 남는다.

### Tests for User Story 3

- [X] T025 [P] [US3] Add mixed supported/unsupported category tests in `app/features/workspace-styling/interpreter.test.ts`
- [X] T026 [P] [US3] Add diagnostics rendering/clearing tests in `app/components/editor/WorkspaceClient.test.tsx`

### Implementation for User Story 3

- [X] T027 [US3] Emit structured diagnostics for unsupported category/token/object in `app/features/workspace-styling/diagnostics.ts`
- [X] T028 [US3] Implement partial-apply behavior for mixed category input in `app/features/workspace-styling/interpreter.ts`
- [X] T029 [US3] Add stale-update diagnostic path in `app/features/workspace-styling/sessionState.ts`
- [X] T030 [US3] Expose diagnostics in editor debug/feedback surface in `app/components/editor/WorkspaceClient.tsx`

**Checkpoint**: US3 independently ensures diagnosable unsupported behavior.

---

## Phase 6: Safelist Coexistence and Bootstrap Regression (Release Gate)

**Purpose**: Keep existing safelist bootstrap path valid while runtime styling is introduced.

- [X] T031 Update dev bootstrap wiring to preserve safelist generation coexistence in `scripts/dev/app-dev.ts`
- [X] T032 [P] Maintain safelist generation contract for coexistence in `scripts/generate-tailwind-workspace-safelist.mjs`
- [X] T033 [P] Keep app tailwind safelist loading compatible with runtime styling rollout in `app/tailwind.config.js`
- [X] T034 Add bootstrap coexistence regression test coverage in `scripts/dev/app-dev.test.ts`
- [X] T035 Add focused safelist/bootstrap smoke verification steps and expected logs in `specs/001-workspace-classname-runtime/quickstart.md`

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Finalize docs, contracts, and release-ready verification notes.

- [X] T036 [P] Update feature brief with finalized category matrix and eligible object policy in `docs/features/workspace-classname-runtime/README.md`
- [X] T037 [P] Align contracts with finalized category/eligibility/bootstrap rules in `specs/001-workspace-classname-runtime/contracts/workspace-style-surface-contract.md`, `specs/001-workspace-classname-runtime/contracts/workspace-style-interpretation-contract.md`, `specs/001-workspace-classname-runtime/contracts/workspace-style-diagnostics-contract.md`, and `specs/001-workspace-classname-runtime/contracts/workspace-style-update-flow-contract.md`
- [X] T038 Run focused verification (`bun test` + bootstrap smoke path) and capture results in `specs/001-workspace-classname-runtime/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- Phase 1: starts immediately
- Phase 2: depends on Phase 1
- Phase 3: depends on Phase 2
- Phase 4: depends on Phase 3
- Phase 5: depends on Phase 4
- Phase 6: depends on Phases 3-5
- Phase 7: depends on Phase 6

### User Story Dependencies

- US1 (P1): independent after foundational phase
- US2 (P2): depends on US1 integration surfaces and foundational contracts
- US3 (P3): depends on US1/US2 interpretation and diagnostics pipeline

### Parallel Opportunities

- T002, T003, T004 can run in parallel after T001
- T006, T007, T008, T009, T010 can run in parallel after T005
- T012 and T013 can run in parallel
- T018 and T019 can run in parallel
- T025 and T026 can run in parallel
- T032 and T033 can run in parallel
- T036 and T037 can run in parallel

## Parallel Example: User Story 2

```bash
Task: "T018 [US2] Add category-priority interpretation tests in app/features/workspace-styling/interpreter.test.ts"
Task: "T019 [US2] Add reopen/rerender consistency tests in app/components/editor/WorkspaceClient.test.tsx"
```

## Implementation Strategy

### MVP First (US1)

1. Complete setup and foundational phases.
2. Deliver US1 end-to-end for immediate style feedback.
3. Validate US1 independently against SC-001 and SC-002.

### Incremental Delivery

1. Add US2 category-first deterministic behavior.
2. Add US3 diagnostics and mixed-input handling.
3. Execute safelist coexistence regression gate before release.

## Notes

- Total tasks: 38
- US1 tasks: 6
- US2 tasks: 7
- US3 tasks: 6
- Parallelizable tasks: 17
