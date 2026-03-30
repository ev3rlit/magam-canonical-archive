# Tasks: AI CLI Headless Surface

**Input**: Design notes from `docs/features/database-first-canvas-platform/ai-cli-headless-surface/README.md`
**Prerequisites**: `docs/features/database-first-canvas-platform/canonical-object-persistence/README.md`, `docs/features/database-first-canvas-platform/canonical-mutation-query-core/README.md`, `docs/features/database-first-canvas-platform/ai-cli-tooling.md`

**Generation Note**: `.specify/scripts/bash/check-prerequisites.sh --json` currently fails on branch `codex/dbfcp-ai-cli-headless-surface`, and this slice does not yet have a feature-local `spec.md` / `plan.md`. This task list follows the `speckit-tasks` template shape but derives user stories from `docs/features/database-first-canvas-platform/ai-cli-headless-surface/README.md`.

**Tests**: The current README does not explicitly require TDD, so this task list focuses on implementation and smoke verification instead of dedicated test-writing tasks.

**Organization**: Tasks are grouped by implementation phase and user story so the headless query surface can land first, followed by representative mutation support and handoff alignment.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel when the listed files do not overlap with incomplete tasks
- **[Story]**: Which user story the task belongs to (`US1`, `US2`)
- Every task includes the exact file path(s) expected for implementation

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the CLI and shared-library scaffolding needed for the headless surface work

- [X] T001 Create headless CLI scaffolding in `libs/cli/src/headless/bootstrap.ts`, `libs/cli/src/headless/options.ts`, and `libs/cli/src/headless/json-output.ts`
- [X] T002 [P] Create shared service barrel files in `libs/shared/src/lib/canonical-query/index.ts` and `libs/shared/src/lib/canonical-mutation/index.ts`
- [X] T003 [P] Create resource command entrypoints in `libs/cli/src/commands/workspace.ts`, `libs/cli/src/commands/document.ts`, `libs/cli/src/commands/surface.ts`, `libs/cli/src/commands/object.ts`, `libs/cli/src/commands/search.ts`, `libs/cli/src/commands/canvas-node.ts`, and `libs/cli/src/commands/mutation.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Lock the bootstrap path, JSON envelope, and command routing before story work begins

**CRITICAL**: No user story work should start before this phase is complete

- [X] T004 Implement workspace/document ref resolution and local PGlite bootstrap in `libs/cli/src/headless/bootstrap.ts` using `libs/shared/src/lib/canonical-persistence/pglite-db.ts`
- [X] T005 [P] Implement structured CLI error taxonomy and JSON envelope helpers in `libs/shared/src/lib/canonical-cli/errors.ts`, `libs/shared/src/lib/canonical-cli/envelope.ts`, and `libs/cli/src/headless/json-output.ts`
- [X] T006 [P] Export the new headless helpers and shared service barrels from `libs/shared/src/index.ts` and wire shared option parsing in `libs/cli/src/headless/options.ts`
- [X] T007 Implement top-level resource/subcommand routing and shared failure handling in `libs/cli/src/bin.ts`

**Checkpoint**: Bootstrap, envelope, and routing are fixed; user stories can now proceed

---

## Phase 3: User Story 1 - Headless Query Surface (Priority: P1)

**Goal**: AI agents can query workspace, document, surface, object, and search resources from the CLI while the app is not running

**Independent Test**: Run `magam workspace list --json`, `magam document get --json`, `magam surface query-nodes --json`, `magam object query --json`, and `magam search objects --json` against a local workspace and confirm stable `ok/data/meta` envelopes with explicit refs and partial-read flags

### Implementation for User Story 1

- [X] T008 [P] [US1] Implement workspace/document query helpers in `libs/shared/src/lib/canonical-query/workspace-document.ts`
- [X] T009 [P] [US1] Implement object/surface/search query helpers in `libs/shared/src/lib/canonical-query/object-surface-search.ts`
- [X] T010 [US1] Implement query option normalizers for `--semantic-role`, `--content-kind`, `--has-capability`, `--include`, `--limit`, `--cursor`, and `--bounds` in `libs/cli/src/headless/options.ts`
- [X] T011 [US1] Implement `workspace` and `document` query handlers in `libs/cli/src/commands/workspace.ts` and `libs/cli/src/commands/document.ts`
- [X] T012 [US1] Implement `surface`, `object`, and `search` query handlers in `libs/cli/src/commands/surface.ts`, `libs/cli/src/commands/object.ts`, and `libs/cli/src/commands/search.ts`
- [X] T013 [US1] Register query command groups and shared JSON-first output in `libs/cli/src/bin.ts`, `libs/shared/src/lib/canonical-query/index.ts`, and `libs/shared/src/index.ts`

**Checkpoint**: Headless representative read commands are available and independently usable

---

## Phase 4: User Story 2 - Representative Mutations And Batch Apply (Priority: P2)

**Goal**: AI agents can execute representative object/canvas mutations and use `mutation apply --dry-run` through the same canonical executor path

**Independent Test**: Run `magam object update-content --json`, `magam object patch-capability --json`, `magam canvas-node move --json`, `magam canvas-node reparent --json`, and `magam mutation apply --dry-run --json` against the same workspace/document and confirm shared success/failure envelopes plus structured changed-set data

### Implementation for User Story 2

- [X] T014 [P] [US2] Define mutation batch input/output types and dry-run result shapes in `libs/shared/src/lib/canonical-mutation/types.ts`
- [X] T015 [P] [US2] Implement object mutation adapters for content and capability operations in `libs/shared/src/lib/canonical-mutation/object.ts`
- [X] T016 [P] [US2] Implement canvas-node mutation adapters for move and reparent operations in `libs/shared/src/lib/canonical-mutation/canvas-node.ts`
- [X] T017 [US2] Implement batch apply and dry-run orchestration in `libs/shared/src/lib/canonical-mutation/executor.ts` and `libs/shared/src/lib/canonical-mutation/index.ts`
- [X] T018 [US2] Implement `object update-content` and `object patch-capability` handlers in `libs/cli/src/commands/object.ts`
- [X] T019 [US2] Implement `canvas-node move`, `canvas-node reparent`, and `mutation apply` handlers in `libs/cli/src/commands/canvas-node.ts` and `libs/cli/src/commands/mutation.ts`
- [X] T020 [US2] Reuse common envelope/error mapping across representative mutations and batch apply in `libs/cli/src/bin.ts` and `libs/cli/src/headless/json-output.ts`

**Checkpoint**: Representative mutations and batch apply share the same executor path and CLI envelope semantics

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Align follow-up docs and smoke verification with the implemented headless surface

- [X] T021 [P] Align shared command-surface wording in `docs/features/database-first-canvas-platform/app-attached-session-extension/README.md`
- [X] T022 [P] Document headless command examples and error semantics in `libs/cli/README.md` and `docs/features/database-first-canvas-platform/ai-cli-headless-surface/README.md`
- [X] T023 Validate the README command matrix against implemented CLI help in `libs/cli/src/bin.ts` and reconcile drift in `libs/cli/README.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; start immediately
- **Foundational (Phase 2)**: Depends on Setup completion; blocks all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational completion
- **User Story 2 (Phase 4)**: Depends on Foundational completion; may reuse query story output but should not require US1 to be fully complete
- **Polish (Phase 5)**: Depends on the desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: First MVP increment after Foundational; no dependency on User Story 2
- **User Story 2 (P2)**: Starts after Foundational; depends on the shared bootstrap/envelope contract, not on app-attached work

### Within Each User Story

- Shared service helpers land before CLI command handlers
- CLI option normalization lands before command registration
- Batch mutation orchestration lands before direct mutation command sugar
- Documentation alignment happens only after command names and envelopes stop moving

### Parallel Opportunities

- `T002` and `T003` can run in parallel once the folder layout is agreed
- `T005` and `T006` can run in parallel because they touch different files
- `T008` and `T009` can run in parallel inside User Story 1
- `T014`, `T015`, and `T016` can run in parallel inside User Story 2
- `T021` and `T022` can run in parallel during Polish

---

## Parallel Example: User Story 1

```bash
Task T008: Implement workspace/document query helpers in libs/shared/src/lib/canonical-query/workspace-document.ts
Task T009: Implement object/surface/search query helpers in libs/shared/src/lib/canonical-query/object-surface-search.ts
```

## Parallel Example: User Story 2

```bash
Task T014: Define mutation batch input/output types in libs/shared/src/lib/canonical-mutation/types.ts
Task T015: Implement object mutation adapters in libs/shared/src/lib/canonical-mutation/object.ts
Task T016: Implement canvas-node mutation adapters in libs/shared/src/lib/canonical-mutation/canvas-node.ts
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1
4. Validate headless representative query commands against the README contract

### Incremental Delivery

1. Finish Setup + Foundational to lock bootstrap, routing, and envelopes
2. Ship User Story 1 so app-off read operations work first
3. Add User Story 2 to unlock representative mutations and `mutation apply --dry-run`
4. Finish Polish by aligning `app-attached-session-extension` wording and CLI docs with the implemented surface

### Suggested MVP Scope

- Phase 1
- Phase 2
- Phase 3

---

## Notes

- All tasks follow the required checklist format: checkbox, task ID, optional `[P]`, optional `[US#]`, and explicit file path(s)
- The highest-priority work remains the two items already called out in the README follow-up: actual CLI bootstrap/error-code implementation and app-attached README alignment
- This task list intentionally treats body-block, relation, binding, and plugin-instance noun commands as later expansions unless they are routed through `mutation apply`
