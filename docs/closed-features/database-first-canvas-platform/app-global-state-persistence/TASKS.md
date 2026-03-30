# Tasks: App Global State Persistence

**Input**: Design notes from `docs/features/database-first-canvas-platform/app-global-state-persistence/IMPLEMENTATION_PLAN.md`
**Prerequisites**: `docs/features/database-first-canvas-platform/implementation-plan.md`, `docs/features/database-first-canvas-platform/workspace-document-shell/README.md`, `docs/adr/ADR-0011-unified-renderer-rpc-boundary-for-web-and-desktop.md`

**Generation Note**: This slice does not currently have a feature-local `spec.md` / `plan.md` in `.specify/`. This task list follows the `speckit-tasks` structure but derives user stories and dependencies from `IMPLEMENTATION_PLAN.md` and the existing host-boundary direction in the repository.

**Tests**: Persistence and migration behavior are high risk. This task list includes targeted repository, route/adapter, and renderer integration tests for each story instead of treating tests as optional follow-up work.

**Organization**: Tasks are grouped by implementation phase and user story so the app-global DB foundation can land first, followed by workspace-registry migration, then preference convergence.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel when the listed files do not overlap with incomplete tasks
- **[Story]**: Which user story the task belongs to (`US1`, `US2`, `US3`)
- Every task includes the exact file path(s) expected for implementation

## Phase 1: Setup (Shared Scaffolding)

**Purpose**: Complete the app-state slice scaffolding so later work builds on stable contract and module boundaries.

- [x] T001 Finalize app-state contract surface in `libs/shared/src/lib/app-state-persistence/contracts/types.ts`, `libs/shared/src/lib/app-state-persistence/contracts/schema.ts`, and `libs/shared/src/lib/app-state-persistence/contracts/index.ts`
- [x] T002 Create app-state persistence module skeleton in `libs/shared/src/lib/app-state-persistence/pglite-db.ts`, `libs/shared/src/lib/app-state-persistence/repository.ts`, and `libs/shared/src/lib/app-state-persistence/index.ts`
- [x] T003 [P] Create app-state migration directory and initial migration artifact in `libs/shared/src/lib/app-state-persistence/drizzle/0000_app_global_state.sql`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Lock the app-global DB bootstrap, repository, and host transport foundations before any renderer migration starts.

**CRITICAL**: No user story work should begin until this phase is complete.

- [x] T004 Implement app-global DB location resolution and `PGlite + Drizzle ORM` bootstrap in `libs/shared/src/lib/app-state-persistence/pglite-db.ts`
- [x] T005 [P] Implement typed repository methods for workspaces, active session, recent documents, and preferences in `libs/shared/src/lib/app-state-persistence/repository.ts`
- [x] T006 [P] Add repository/bootstrap coverage in `libs/shared/src/lib/app-state-persistence/pglite-db.spec.ts` and `libs/shared/src/lib/app-state-persistence/repository.spec.ts`
- [x] T007 Implement web transport endpoints for app-global state in `app/app/api/app-state/workspaces/route.ts`, `app/app/api/app-state/session/route.ts`, `app/app/api/app-state/recent-documents/route.ts`, and `app/app/api/app-state/preferences/route.ts`
- [x] T008 [P] Implement desktop direct backend endpoints for app-global state in `libs/cli/src/server/http.ts`
- [x] T009 [P] Extend host logical method inventory and typed app-state RPC contracts in `app/features/host/contracts/rpcMethods.ts` and `app/features/host/renderer/rpcClient.ts`
- [x] T010 Implement web and desktop app-state RPC adapters in `app/features/host/rpc/webAdapter.ts` and `app/features/host/rpc/desktopAdapter.ts`
- [x] T011 [P] Add adapter parity and backend endpoint regression coverage in `app/features/host/rpc/adapters.spec.ts`, `app/app/api/app-state/workspaces/route.spec.ts`, and `libs/cli/src/server/http.spec.ts`

**Checkpoint**: App-global DB bootstrap, repository, and host RPC transport are fixed; renderer migration can now proceed.

---

## Phase 3: User Story 1 - Durable Workspace Registry And Session Restore (Priority: P1) 🎯 MVP

**Goal**: The app remembers registered workspaces, the active workspace, and each workspace’s last active document in an app-global DB instead of renderer `localStorage`.

**Independent Test**: Register two workspaces, switch the active workspace, open a document in each, restart the app bootstrap path, and confirm the registry, active workspace, and last active document restore from the app-global DB without reading the old `localStorage` keys as canonical state.

### Implementation for User Story 1

- [x] T012 [US1] Add app-state repository read/write helpers for workspace registry hydration and one-time legacy import in `app/components/editor/workspaceRegistry.ts`
- [x] T013 [US1] Replace graph-store workspace registry persistence with app-state RPC-backed flows in `app/store/graph.ts`
- [x] T014 [US1] Update editor bootstrap and workspace shell flows to hydrate and persist through app-state-backed registry logic in `app/features/editor/pages/CanvasEditorPage.tsx`, `app/features/workspace/pages/WorkspaceDashboardPage.tsx`, and `app/features/workspace/pages/WorkspaceDetailPage.tsx`
- [x] T015 [P] [US1] Add migration and restore coverage for registry/session state in `app/store/graph.test.ts` and a new `app/components/editor/workspaceRegistry.test.ts`
- [x] T016 [P] [US1] Add route/repository migration coverage for legacy `localStorage -> app DB` import semantics in `libs/shared/src/lib/app-state-persistence/repository.spec.ts`

**Checkpoint**: Workspace registry and last-active-document state are durable, app-global, and restart-safe.

---

## Phase 4: User Story 2 - Host-Neutral App-State Boundary For Web And Desktop (Priority: P1)

**Goal**: Both web and desktop consume the same logical app-state boundary so renderer code never knows whether app-global state came from `/api/*` or a desktop direct backend.

**Independent Test**: Execute the same renderer-facing workspace/session restore flow in both web and desktop adapters and confirm identical logical method coverage, request/response shapes, and restore behavior.

### Implementation for User Story 2

- [x] T017 [US2] Add app-state-specific logical methods and request/response types to `app/features/host/renderer/rpcClient.ts` and `app/features/host/contracts/rpcMethods.ts`
- [x] T018 [P] [US2] Implement app-state RPC mapping in `app/features/host/rpc/webAdapter.ts` and `app/features/host/rpc/desktopAdapter.ts`
- [x] T019 [P] [US2] Wire desktop runtime ownership for app-global DB path resolution in `app/features/desktop-host/main.ts`, `app/features/desktop-host/orchestrator.ts`, and `app/features/desktop-host/preload.ts`
- [x] T020 [US2] Add transport parity and cross-host regression coverage in `app/features/host/rpc/adapters.spec.ts` and `app/features/host/renderer/createHostRuntime.ts`

**Checkpoint**: App-global state uses one logical host boundary across web and desktop.

---

## Phase 5: User Story 3 - Preference Convergence On App-Global State (Priority: P2)

**Goal**: Theme/font and future app-global preferences can move to the same app-global persistence boundary without reintroducing browser-storage ownership drift.

**Independent Test**: Change theme and global font, restart the app, and confirm the values restore from app-global state while any remaining `localStorage` usage is only bootstrap cache or migration fallback.

### Implementation for User Story 3

- [x] T021 [US3] Implement preference repository methods and app-state RPC endpoints for generic key/value preference storage in `libs/shared/src/lib/app-state-persistence/repository.ts` and `app/app/api/app-state/preferences/route.ts`
- [x] T022 [P] [US3] Migrate theme persistence to app-global state in `app/features/theme/provider.tsx`, `app/features/theme/document.ts`, and `app/features/theme/runtime.ts`
- [x] T023 [P] [US3] Migrate global font persistence to app-global state in `app/utils/fontHierarchy.ts` and `app/store/graph.ts`
- [x] T024 [US3] Add preference restore/migration coverage in `app/features/theme/runtime.test.tsx` and `app/store/graph.test.ts`

**Checkpoint**: App-global preferences are no longer canonically owned by renderer `localStorage`.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Finish docs, migration notes, and cleanup for cross-cutting behavior that spans all stories.

- [x] T025 [P] Document app-global DB location policy, migration semantics, and host ownership in `docs/features/database-first-canvas-platform/app-global-state-persistence/IMPLEMENTATION_PLAN.md`
- [x] T026 [P] Add app-global persistence references to `docs/features/database-first-canvas-platform/workspace-document-shell/README.md` and `docs/adr/ADR-0011-unified-renderer-rpc-boundary-for-web-and-desktop.md`
- [x] T027 Remove or demote legacy workspace/session `localStorage` keys from canonical usage paths in `app/components/editor/workspaceRegistry.ts`, `app/store/graph.ts`, and `app/features/theme/provider.tsx`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies
- **Foundational (Phase 2)**: Depends on Setup and blocks all user stories
- **US1 (Phase 3)**: Depends on Foundational
- **US2 (Phase 4)**: Depends on Foundational and can progress in parallel with late US1 integration once app-state RPC contracts are stable
- **US3 (Phase 5)**: Depends on Foundational and reuses the app-state repository + RPC surface from US1/US2
- **Polish (Phase 6)**: Depends on the stories you intend to ship

### User Story Dependencies

- **US1**: First MVP increment after foundations; it delivers the main product value
- **US2**: Locks web/desktop parity for the same app-state capability and should finish before calling the boundary stable
- **US3**: Builds on the same persistence foundation but can ship after the workspace registry move

### Within Each User Story

- Repository and route/adapter work land before renderer migration
- One-time migration semantics land before old `localStorage` writes are removed
- Preference convergence happens only after the shared app-state boundary is stable

### Parallel Opportunities

- `T003` can run in parallel once the contract file names are fixed
- `T005`, `T006`, `T007`, `T008`, and `T009` can partially run in parallel after `T004`
- `T015` and `T016` can run in parallel inside User Story 1
- `T018` and `T019` can run in parallel inside User Story 2
- `T022` and `T023` can run in parallel inside User Story 3
- `T025` and `T026` can run in parallel during Polish

---

## Parallel Example: User Story 1

```bash
Task T015: Add migration and restore coverage in app/store/graph.test.ts and app/components/editor/workspaceRegistry.test.ts
Task T016: Add route/repository migration coverage in libs/shared/src/lib/app-state-persistence/repository.spec.ts
```

## Parallel Example: User Story 3

```bash
Task T022: Migrate theme persistence in app/features/theme/provider.tsx, app/features/theme/document.ts, and app/features/theme/runtime.ts
Task T023: Migrate global font persistence in app/utils/fontHierarchy.ts and app/store/graph.ts
```

---

## Implementation Strategy

### MVP First

1. Complete Phase 1 and Phase 2
2. Deliver Phase 3 (US1) durable workspace registry + session restore
3. Validate restart-safe restore before converging additional preferences

### Incremental Delivery

1. Foundation: app-global DB + repository + host transport
2. US1: workspace registry, active workspace, last active document
3. US2: host-neutral web/desktop boundary parity
4. US3: preference convergence
5. Polish: docs and legacy storage cleanup

### Suggested MVP Scope

- Phase 1
- Phase 2
- Phase 3
- Phase 4

---

## Notes

- All tasks follow the required checklist format with checkbox, task ID, optional `[P]`, optional `[US#]`, and explicit file path(s)
- The contract files already created for this slice are treated as the canonical starting scaffold, so tasks focus on completing and integrating them rather than re-introducing duplicate models elsewhere
- `localStorage` is treated as migration input or bootstrap cache only; no story should reintroduce it as canonical state
