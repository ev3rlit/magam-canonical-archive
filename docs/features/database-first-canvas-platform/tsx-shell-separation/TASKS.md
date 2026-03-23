# Tasks: TSX Shell Separation

**Input**: Design notes from `docs/features/database-first-canvas-platform/tsx-shell-separation/README.md` and `docs/features/database-first-canvas-platform/tsx-shell-separation/IMPLEMENT_PLAN.md`  
**Prerequisites**: `docs/adr/ADR-0006-shared-canonical-contract-and-drizzle-split.md`, `docs/features/database-first-canvas-platform/workspace-document-shell/README.md`, `docs/adr/ADR-0011-unified-renderer-rpc-boundary-for-web-and-desktop.md`
**Alignment**: This task sequence mirrors the phase order in `IMPLEMENT_PLAN.md` (canonical shell lock → route/host reuse → editor/runtime key convergence → TSX demotion → chat scope-off), and keeps this README as the slice narrative source.

**Generation Note**: This slice does not currently have a feature-local `spec.md` / `plan.md` in `.specify/`. This task list follows the `speckit-tasks` structure but derives scope, user stories, and dependencies from the improvement README and implementation plan.

**Tests**: This improvement changes runtime-critical document identity, creation, render, and sync paths. Targeted regression tests are included for canonical document creation, route parity, editor restore behavior, TSX compatibility boundaries, and chat scope-off surfaces.

**Organization**: Tasks are grouped by implementation phase and user story so the canonical document shell lands first, followed by editor/runtime key convergence, then TSX compatibility demotion, then chat scope-off cleanup.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel when the listed files do not overlap with incomplete tasks
- **[Story]**: Which user story the task belongs to (`US1`, `US2`, `US3`, `US4`)
- Every task includes the exact file path(s) expected for implementation

## Phase 1: Setup (Shared Scaffolding)

**Purpose**: Define the canonical document shell boundary and identify the legacy TSX shell entry points before runtime changes begin.

- [x] T001 Create canonical document shell module scaffold in `libs/shared/src/lib/canonical-document-shell/index.ts`, `libs/shared/src/lib/canonical-document-shell/types.ts`, and `libs/shared/src/lib/canonical-document-shell/service.ts`
- [x] T002 [P] Add shared test scaffold for canonical document shell in `libs/shared/src/lib/canonical-document-shell/service.spec.ts`
- [x] T003 [P] Add feature-local task and implementation references in `docs/features/database-first-canvas-platform/tsx-shell-separation/README.md`, `docs/features/database-first-canvas-platform/tsx-shell-separation/IMPLEMENT_PLAN.md`, and `docs/features/database-first-canvas-platform/tsx-shell-separation/TASKS.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Lock the shared canonical document shell and route/backend reuse boundary before editor/runtime migration starts.

**CRITICAL**: No user story work should begin until this phase is complete.

- [x] T004 Implement canonical document list/create/open service on top of workspace-local persistence in `libs/shared/src/lib/canonical-document-shell/service.ts`, `libs/shared/src/lib/canonical-query/workspace-document.ts`, and `libs/shared/src/lib/canonical-persistence/repository.ts`
- [x] T005 [P] Add canonical document shell coverage in `libs/shared/src/lib/canonical-document-shell/service.spec.ts`, `libs/shared/src/lib/canonical-query/headless-query.spec.ts`, and `libs/shared/src/lib/canonical-mutation/executor.spec.ts`
- [x] T006 Implement web document route reuse of canonical document shell in `app/app/api/documents/route.ts` and `app/app/api/documents/route.spec.ts`
- [x] T007 [P] Implement desktop direct backend reuse of canonical document shell in `libs/cli/src/server/http.ts` and `libs/cli/src/server/http.spec.ts`
- [x] T008 [P] Extend renderer RPC contracts to carry canonical document identity metadata in `app/features/host/renderer/rpcClient.ts`, `app/features/host/contracts/rpcMethods.ts`, `app/features/host/rpc/webAdapter.ts`, and `app/features/host/rpc/desktopAdapter.ts`
- [x] T009 [P] Add cross-host document-shell parity coverage in `app/features/host/rpc/adapters.spec.ts` and `app/features/host/renderer/createHostRuntime.spec.ts`

**Checkpoint**: Canonical document list/create behavior is fixed behind shared web/desktop shell adapters.

---

## Phase 3: User Story 1 - Canonical Document Shell For Workspace Flows (Priority: P1) 🎯 MVP

**Goal**: Workspace detail and dashboard flows create and list documents from workspace-local canonical DB instead of `.tsx` file scans.

**Independent Test**: Register a workspace, create two documents, reload the workspace detail flow, and confirm the list comes from canonical document query results without requiring new `.tsx` files to exist as canonical source.

### Implementation for User Story 1

- [x] T010 [US1] Replace workspace document list hydration with canonical document query results in `app/features/editor/pages/CanvasEditorPage.tsx`, `app/features/workspace/pages/WorkspaceDetailPage.tsx`, and `app/components/editor/workspaceRegistry.ts`
- [x] T011 [US1] Replace new document creation/open flow with canonical document shell outputs in `app/features/workspace/pages/WorkspaceDetailPage.tsx`, `app/features/editor/pages/CanvasEditorPage.tsx`, and `app/features/host/renderer/navigation.ts`
- [x] T012 [P] [US1] Add renderer-facing workspace/document shell regression tests in `app/components/editor/workspaceRegistry.test.ts`, `app/store/graph.test.ts`, and `app/features/host/renderer/navigation.spec.ts`
- [x] T013 [P] [US1] Add route/backend regressions for canonical document list/create payloads in `app/app/api/documents/route.spec.ts` and `libs/cli/src/server/http.spec.ts`

**Checkpoint**: Workspace document shell no longer treats `.tsx` scan results as the primary document registry.

---

## Phase 4: User Story 2 - Canonical Document Identity In Editor Runtime (Priority: P1)

**Goal**: Editor open/restore/render flows use one canonical document key so the same document is not repeatedly reloaded as a “new graph.”

**Independent Test**: Create and reopen a document from workspace detail and editor restore flows, then confirm the editor resolves one canonical document key and `GraphCanvas` layout reset only occurs on actual document changes.

### Implementation for User Story 2

- [x] T014 [US2] Redefine editor document identity state away from raw file path ownership in `app/store/graph.ts`, `app/features/editor/pages/CanvasEditorPage.tsx`, and `app/components/GraphCanvas.tsx`
- [ ] T015 [US2] Replace file-path based render entry with canonical document materialization/load behavior in `app/features/editor/pages/CanvasEditorPage.tsx`, `app/app/api/render/route.ts`, and `libs/cli/src/server/http.ts`
- [ ] T016 [P] [US2] Add editor restore/layout regression coverage in `app/store/graph.test.ts`, `app/components/GraphCanvas.viewport.test.ts`, and `app/components/GraphCanvas.test.tsx`
- [ ] T017 [P] [US2] Add document identity parity coverage for navigation/open flows in `app/features/host/renderer/navigation.spec.ts` and `app/features/workspace/pages/WorkspaceDetailPage.tsx`

**Checkpoint**: Canonical document identity drives editor restore/render behavior and prevents spurious graph resets.

---

## Phase 5: User Story 3 - Demote TSX Watchers And Compatibility Shell (Priority: P2)

**Goal**: TSX-based file scan and watcher paths no longer represent the canonical runtime shell; they are isolated as compatibility-only layers.

**Independent Test**: Open and edit a canonical document without relying on `.tsx` file subscriptions as the primary sync trigger, while legacy import/materialization paths remain explicitly scoped.

### Implementation for User Story 3

- [ ] T018 [US3] Split `workspace-shell.ts` responsibilities into workspace shell vs compatibility file shell in `libs/shared/src/lib/workspace-shell.ts`, `libs/shared/src/lib/canonical-document-shell/service.ts`, and `app/app/api/workspaces/_shared.ts`
- [ ] T019 [P] [US3] Demote TSX file tree and watcher ownership in `app/ws/server.ts`, `app/hooks/useFileSync.ts`, `app/hooks/useFileSync.shared.ts`, and `libs/cli/src/server/http.ts`
- [ ] T020 [P] [US3] Add compatibility-boundary regression coverage in `app/ws/methods.test.ts`, `app/hooks/useFileSync.test.ts`, and `libs/shared/src/lib/canonical-document-shell/service.spec.ts`
- [ ] T021 [US3] Rename or isolate remaining compatibility-only TSX helpers in `libs/shared/src/lib/workspace-shell.ts`, `libs/cli/src/commands/dev.ts`, and `libs/cli/src/commands/new.ts`

**Checkpoint**: TSX paths remain only as clearly named compatibility/import/materialization paths.

---

## Phase 6: User Story 4 - Chat Scope-Off And Shell Cleanup (Priority: P2)

**Goal**: Chat is no longer treated as a product shell requirement and can be removed from primary renderer/backend/runtime paths.

**Independent Test**: Start the app and execute workspace/document shell flows without loading or depending on chat UI, chat RPC methods, or chat backend endpoints.

### Implementation for User Story 4

- [ ] T022 [US4] Remove chat panel and shell entrypoints from renderer app flows in `app/features/editor/pages/CanvasEditorPage.tsx`, `app/features/host/renderer/RendererAppShell.tsx`, and `app/store/chatUi.ts`
- [ ] T023 [P] [US4] Remove chat RPC surface from host adapters/contracts in `app/features/host/renderer/rpcClient.ts`, `app/features/host/contracts/rpcMethods.ts`, `app/features/host/rpc/webAdapter.ts`, and `app/features/host/rpc/desktopAdapter.ts`
- [ ] T024 [P] [US4] Remove chat backend routes from desktop/web shell servers in `libs/cli/src/server/http.ts`, `app/app/api/chat`, and `app/features/desktop-host/backendLifecycle.ts`
- [ ] T025 [P] [US4] Add chat scope-off regression coverage in `app/features/host/rpc/adapters.spec.ts`, `libs/cli/src/server/http.spec.ts`, and `app/features/host/renderer/createHostRuntime.spec.ts`

**Checkpoint**: Core workspace/document runtime paths are independent of chat.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Finish docs, migration notes, and cleanup for cross-cutting behavior spanning TSX shell separation and chat scope-off.

- [ ] T026 [P] Document canonical document shell ownership, TSX compatibility demotion, and chat scope-off in `docs/features/database-first-canvas-platform/tsx-shell-separation/README.md` and `docs/features/database-first-canvas-platform/tsx-shell-separation/IMPLEMENT_PLAN.md`
- [ ] T027 [P] Add implementation alignment references to `docs/adr/ADR-0006-shared-canonical-contract-and-drizzle-split.md`, `docs/adr/ADR-0011-unified-renderer-rpc-boundary-for-web-and-desktop.md`, and `docs/features/database-first-canvas-platform/workspace-document-shell/README.md`
- [ ] T028 Remove remaining primary-runtime `.tsx` canonical assumptions from `libs/shared/src/lib/workspace-shell.ts`, `app/features/editor/pages/CanvasEditorPage.tsx`, and `libs/cli/src/server/http.ts`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies
- **Foundational (Phase 2)**: Depends on Setup and blocks all user stories
- **US1 (Phase 3)**: Depends on Foundational
- **US2 (Phase 4)**: Depends on Foundational and builds on the canonical document shell from US1
- **US3 (Phase 5)**: Depends on Foundational and should land after canonical document shell behavior is stable
- **US4 (Phase 6)**: Depends on Foundational and can proceed after shell critical paths no longer need chat
- **Polish (Phase 7)**: Depends on the stories you intend to ship

### User Story Dependencies

- **US1**: First MVP increment; moves workspace document shell onto canonical DB
- **US2**: Locks editor/runtime identity around canonical documents
- **US3**: Demotes TSX shell paths after canonical runtime is stable
- **US4**: Removes chat from the primary shell after runtime boundaries are clean

### Within Each User Story

- Shared shell/service work lands before route/backend adoption
- Route/backend parity lands before renderer state migration
- Compatibility-only TSX paths are renamed only after canonical shell adoption is verified
- Chat UI/RPC removal lands before backend endpoint cleanup

### Parallel Opportunities

- `T002` and `T003` can run in parallel in Setup
- `T005`, `T007`, `T008`, and `T009` can run in parallel after `T004`
- `T012` and `T013` can run in parallel inside User Story 1
- `T016` and `T017` can run in parallel inside User Story 2
- `T019` and `T020` can run in parallel inside User Story 3
- `T023`, `T024`, and `T025` can run in parallel inside User Story 4
- `T026` and `T027` can run in parallel during Polish

---

## Parallel Example: User Story 1

```bash
Task T012: Add renderer-facing workspace/document shell regression tests in app/components/editor/workspaceRegistry.test.ts, app/store/graph.test.ts, and app/features/host/renderer/navigation.spec.ts
Task T013: Add route/backend regressions for canonical document list/create payloads in app/app/api/documents/route.spec.ts and libs/cli/src/server/http.spec.ts
```

## Parallel Example: User Story 4

```bash
Task T023: Remove chat RPC surface from host adapters/contracts in app/features/host/renderer/rpcClient.ts, app/features/host/contracts/rpcMethods.ts, app/features/host/rpc/webAdapter.ts, and app/features/host/rpc/desktopAdapter.ts
Task T024: Remove chat backend routes from desktop/web shell servers in libs/cli/src/server/http.ts, app/app/api/chat, and app/features/desktop-host/backendLifecycle.ts
```

---

## Implementation Strategy

### MVP First

1. Complete Phase 1 and Phase 2
2. Deliver Phase 3 (US1) canonical document shell for workspace flows
3. Deliver Phase 4 (US2) canonical document identity in editor runtime
4. Validate that new document creation and editor reopen no longer depend on TSX shell behavior

### Incremental Delivery

1. Foundation: canonical document shell + route/backend reuse
2. US1: canonical workspace document list/create
3. US2: editor/runtime key convergence
4. US3: TSX compatibility demotion
5. US4: chat scope-off
6. Polish: docs and legacy cleanup

### Suggested MVP Scope

- Phase 1
- Phase 2
- Phase 3
- Phase 4

---

## Notes

- All tasks follow the required checklist format with checkbox, task ID, optional `[P]`, optional `[US#]`, and explicit file path(s)
- This task list treats canonical DB runtime as the primary source of truth and TSX paths as compatibility-only unless explicitly noted otherwise
- Chat is intentionally treated as scope-off for the product shell and should not block TSX shell separation decisions
