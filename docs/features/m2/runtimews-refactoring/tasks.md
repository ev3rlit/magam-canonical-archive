# Tasks: RuntimeWS Refactoring

**Input**: Design notes from `docs/features/m2/runtimews-refactoring/README.md` and `docs/features/m2/runtimews-refactoring/implementation-plan.md`
**Prerequisites**: `README.md`, `implementation-plan.md`, `docs/features/m2/canvas-runtime-contract/README.md`, `docs/bottleneck/runtime-read-write-boundary.md`

**Generation Note**: This task list follows the `speckit-tasks` checklist format but is derived from the feature-local README and implementation plan because this slice does not yet have a `.specify` feature scaffold.

**Tests**: Automated regression coverage is recommended for routing, compatibility ownership, and runtime mutation/query boundaries because this refactor changes file ownership, route registration, and layer dependencies without changing product behavior.

**Organization**: Tasks are grouped by implementation phase and user story so the team can land the new `routes.ts`/`handlers` skeleton first, then demote compatibility ownership, then consolidate duplicated transforms, and finally narrow WS toward subscription-first behavior.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel when the listed files do not overlap with incomplete tasks
- **[Story]**: Which user story the task belongs to (`[US1]`, `[US2]`, `[US3]`, `[US4]`)
- Every task includes the exact file path(s) expected for implementation

## Phase 1: Setup (Shared Scaffolding)

**Purpose**: Lock the feature-local target structure, naming, and verification criteria before code motion begins.

- [X] T001 Align `docs/features/m2/runtimews-refactoring/README.md` and `docs/features/m2/runtimews-refactoring/implementation-plan.md` with the final `routes.ts` + `*Handlers.ts` naming and ownership rules
- [X] T002 [P] Create `docs/features/m2/runtimews-refactoring/tasks.md` and keep the feature-local target file structure synchronized with `docs/features/m2/runtimews-refactoring/implementation-plan.md`
- [X] T003 [P] Add feature-local implementation notes or TODO anchors for `app/ws/routes.ts`, `app/ws/handlers/`, and `app/ws/shared/` in `docs/features/m2/runtimews-refactoring/README.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish the shared route/handler scaffolding and dependency rules that all user stories build on.

**CRITICAL**: No user story work should start before this phase is complete.

- [X] T004 Create `app/ws/routes.ts` as the new top-level RPC route registry and export surface for WS method wiring
- [X] T005 [P] Create shared parsing helpers in `app/ws/shared/params.ts`
- [X] T006 [P] Create shared RPC error mapping helpers in `app/ws/shared/errors.ts`
- [X] T007 [P] Create shared response/notification helpers in `app/ws/shared/responses.ts`
- [X] T008 Create handler folder scaffolding in `app/ws/handlers/canvasHandlers.ts`, `app/ws/handlers/workspaceHandlers.ts`, `app/ws/handlers/appStateHandlers.ts`, `app/ws/handlers/compatibilityHandlers.ts`, and `app/ws/handlers/historyHandlers.ts`
- [X] T009 Add route-registry regression coverage in `app/ws/routes.test.ts`

**Checkpoint**: `app/ws` has an explicit `routes.ts` entrypoint, shared helpers, and domain handler files ready for behavior migration.

---

## Phase 3: User Story 1 - Routes And Domain Handlers (Priority: P1) 🎯 MVP

**Goal**: Replace the single `methods.ts` hub with a `routes.ts` entrypoint that explicitly wires domain handlers while preserving existing RPC behavior.

**Independent Test**: Open the WS server and verify that canvas mutation/query/subscribe, workspace/app-state requests, and history requests still resolve through `routes.ts` while implementation logic lives under `app/ws/handlers/`.

### Implementation for User Story 1

- [X] T010 [US1] Move canvas mutate and canvas projection route handlers from `app/ws/methods.ts` into `app/ws/handlers/canvasHandlers.ts`
- [X] T011 [P] [US1] Move workspace RPC handlers from `app/ws/methods.ts` into `app/ws/handlers/workspaceHandlers.ts`
- [X] T012 [P] [US1] Move app-state RPC handlers from `app/ws/methods.ts` into `app/ws/handlers/appStateHandlers.ts`
- [X] T013 [P] [US1] Move undo/redo and revision-oriented RPC handlers from `app/ws/methods.ts` into `app/ws/handlers/historyHandlers.ts`
- [X] T014 [US1] Update `app/ws/routes.ts` to register all RPC method names against the new domain handlers
- [X] T015 [US1] Update `app/ws/server.ts` to import and dispatch through `app/ws/routes.ts` instead of `app/ws/methods.ts`
- [X] T016 [US1] Convert `app/ws/methods.test.ts` into route/handler coverage in `app/ws/routes.test.ts` and handler-focused tests under `app/ws/handlers/`
- [X] T017 [US1] Remove `app/ws/methods.ts` after all RPC methods are served from `app/ws/routes.ts`

**Checkpoint**: `methods.ts` is no longer the implementation hub, and the WS entry surface is visibly `routes.ts` + domain handlers.

---

## Phase 4: User Story 2 - Compatibility Path Demotion (Priority: P1)

**Goal**: Make compatibility patching a secondary adapter owned by `compatibilityHandlers.ts` instead of a parallel first-class write owner spread across WS paths.

**Independent Test**: Execute canonical runtime mutation flows and verify that compatibility patching only occurs through the dedicated compatibility handler path, while non-compatibility handlers never import `filePatcher.ts`.

### Implementation for User Story 2

- [X] T018 [US2] Move file patch subscribe/unsubscribe and compatibility file change handling from `app/ws/methods.ts` into `app/ws/handlers/compatibilityHandlers.ts`
- [X] T019 [US2] Refactor runtime mutation flows in `app/ws/handlers/canvasHandlers.ts` and `app/ws/handlers/historyHandlers.ts` so compatibility patch application is delegated to `app/ws/handlers/compatibilityHandlers.ts`
- [X] T020 [P] [US2] Extract compatibility-specific mutex/version helpers from `app/ws/methods.ts` into `app/ws/handlers/compatibilityHandlers.ts` or `app/ws/shared/params.ts`
- [X] T021 [P] [US2] Update `app/ws/methods.mutex.test.ts` into compatibility-focused coverage in `app/ws/handlers/compatibilityHandlers.test.ts`
- [X] T022 [US2] Add import-boundary regression coverage to confirm only `app/ws/handlers/compatibilityHandlers.ts` imports `app/ws/filePatcher.ts`
- [X] T023 [US2] Update `docs/features/m2/runtimews-refactoring/README.md` and `docs/features/m2/runtimews-refactoring/implementation-plan.md` with the final compatibility adapter ownership notes

**Checkpoint**: Compatibility patching is visibly adapter-only and no longer competes with runtime as a peer write owner.

---

## Phase 5: User Story 3 - Shared Transform Consolidation (Priority: P2)

**Goal**: Eliminate duplicated shape translation logic across the client, WS handlers, and runtime-adjacent code by introducing a shared codec/helper layer.

**Independent Test**: Run a representative set of canvas create/update/body-block flows and verify the same placement/content/body-block semantics are produced without duplicated transform logic in `useCanvasRuntime.ts`, WS handlers, and parser helpers.

### Implementation for User Story 3

- [X] T024 [US3] Identify and document the canonical duplicated transforms in `app/hooks/useCanvasRuntime.ts`, `app/ws/handlers/canvasHandlers.ts`, and `app/features/render/parseRenderGraph.ts`
- [X] T025 [US3] Create shared transform helpers or codec entrypoints in `app/ws/shared/params.ts` or a new shared helper file under `app/ws/shared/`
- [X] T026 [P] [US3] Replace duplicated runtime create placement and body-block translation logic in `app/hooks/useCanvasRuntime.ts` with shared helper usage
- [X] T027 [P] [US3] Replace duplicated RPC-side mutation payload translation in `app/ws/handlers/canvasHandlers.ts` and `app/ws/handlers/historyHandlers.ts` with shared helper usage
- [X] T028 [US3] Narrow parser-side duplication by aligning `app/features/render/parseRenderGraph.ts` and `app/features/render/aliasNormalization.ts` with the new shared transform boundaries
- [X] T029 [US3] Add regression coverage for shared transform semantics in `app/ws/handlers/canvasHandlers.test.ts` and `app/hooks/useCanvasRuntime.test.ts`

**Checkpoint**: Placement/content/body-block translation rules have one clear home instead of being re-expressed in every layer.

---

## Phase 6: User Story 4 - Subscription-First WS Surface (Priority: P2)

**Goal**: Narrow WS so its raison d'etre is explicit: subscription and push invalidation, not a catch-all full-RPC transport.

**Independent Test**: Confirm `canvas.changed`, `file.changed`, and `files.changed` subscription flows still work end-to-end, while the route/handler structure makes it obvious which WS methods are subscription-oriented and which are temporary mutate/query carryovers.

### Implementation for User Story 4

- [X] T030 [US4] Isolate subscription-specific RPC methods in `app/ws/handlers/canvasHandlers.ts` and `app/ws/handlers/compatibilityHandlers.ts` so subscribe/unsubscribe behavior is explicit
- [X] T031 [P] [US4] Simplify notification emission paths in `app/ws/server.ts` to align with the new domain handler ownership
- [X] T032 [P] [US4] Update `app/hooks/useCanvasRuntime.ts` so subscribe/unsubscribe handling clearly separates subscription behavior from mutation/query request helpers
- [X] T033 [US4] Add subscription regression coverage in `app/ws/routes.test.ts`, `app/ws/handlers/compatibilityHandlers.test.ts`, and `app/hooks/useCanvasRuntime.test.ts`
- [X] T034 [US4] Document the remaining non-subscription WS methods and their planned future posture in `docs/features/m2/runtimews-refactoring/README.md`

**Checkpoint**: WS still exists, but its subscription-first role is explicit in both code structure and docs.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final cleanup, dependency checks, and documentation alignment once the new structure is in place.

- [X] T035 [P] Add architecture guardrails or validation notes for `app/ws/routes.ts`, `app/ws/handlers/`, and `app/ws/shared/` in `docs/features/m2/runtimews-refactoring/implementation-plan.md`
- [X] T036 [P] Update any stale references to `app/ws/methods.ts` in `docs/bottleneck/runtime-read-write-boundary.md` and `docs/bottleneck/file-inventory.md`
- [X] T037 Remove dead `methods.ts`-specific test helpers or obsolete route wiring from `app/ws/testUtils.ts` and related `app/ws/*.test.ts` files
- [X] T038 Run and record the agreed structure/dependency verification commands in `docs/features/m2/runtimews-refactoring/implementation-plan.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies
- **Foundational (Phase 2)**: Depends on Setup and blocks all user stories
- **US1 (Phase 3)**: Depends on Foundational and establishes the new route/handler skeleton
- **US2 (Phase 4)**: Depends on US1 because compatibility ownership must be moved after routes and handlers exist
- **US3 (Phase 5)**: Depends on US1 and partially on US2 because transform boundaries are easier to stabilize after handler ownership is explicit
- **US4 (Phase 6)**: Depends on US1 and benefits from US2 because subscription ownership should be clarified after compatibility and canvas handlers are settled
- **Polish (Phase 7)**: Depends on the stories you intend to ship

### User Story Dependencies

- **US1**: MVP after foundations
- **US2**: Builds directly on the route/handler split from US1
- **US3**: Builds on the handler ownership introduced by US1 and benefits from US2
- **US4**: Builds on the route/handler split from US1 and clarifies the surviving WS surface

### Within Each User Story

- Shared route/helper scaffolding before file moves
- Route registration before server wiring changes
- Handler ownership before dependency cleanup
- Runtime/compatibility ownership cleanup before final verification

### Parallel Opportunities

- **Phase 2**: T005, T006, and T007 can run in parallel after T004
- **US1**: T011, T012, and T013 can run in parallel after T010 establishes the split pattern
- **US2**: T020 and T021 can run in parallel after T018/T019 define compatibility ownership
- **US3**: T026 and T027 can run in parallel after T024/T025 identify and create shared transforms
- **US4**: T031 and T032 can run in parallel after T030 defines subscription ownership

---

## Parallel Example: User Story 1

```bash
Task T011: Move workspace RPC handlers into app/ws/handlers/workspaceHandlers.ts
Task T012: Move app-state RPC handlers into app/ws/handlers/appStateHandlers.ts
Task T013: Move undo/redo and revision handlers into app/ws/handlers/historyHandlers.ts
```

## Parallel Example: User Story 3

```bash
Task T026: Replace duplicated runtime create/body-block translation in app/hooks/useCanvasRuntime.ts
Task T027: Replace duplicated RPC-side mutation translation in app/ws/handlers/canvasHandlers.ts and app/ws/handlers/historyHandlers.ts
```

---

## Implementation Strategy

### MVP First

1. Complete Phase 1 and Phase 2
2. Deliver Phase 3 (routes + domain handlers)
3. Deliver Phase 4 (compatibility path demotion)
4. **STOP and VALIDATE**: Ensure the new `routes.ts` structure and compatibility ownership are correct before deeper transform cleanup

### Incremental Delivery

1. Establish `routes.ts` and shared handler scaffolding
2. Move domain RPC implementations out of `methods.ts`
3. Demote compatibility patching to adapter-only ownership
4. Consolidate duplicated transforms into shared helpers
5. Narrow WS toward subscription-first behavior

### Suggested MVP Scope

- Phase 1
- Phase 2
- Phase 3
- Phase 4

---

## Notes

- All tasks follow the required checklist format: checkbox, task ID, optional `[P]`, optional `[US#]`, and explicit file path(s)
- This feature intentionally keeps `shared runtime` in place; the refactor targets WS/RPC/compatibility structure around it
- `projectionHandlers.ts` or `subscriptionHandlers.ts` are intentionally excluded because the handler split is domain-based, not transport- or technique-based
