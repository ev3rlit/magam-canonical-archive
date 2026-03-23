# Tasks: Hardcoded Text Audit Remediation

**Input**: Audit notes from `docs/features/hardcoded-text-audit/README.md`
**Prerequisites**: `docs/features/hardcoded-text-audit/README.md`

**Generation Note**: This slice does not currently have a feature-local `spec.md` / `plan.md` in `.specify/`, and `.specify/scripts/bash/check-prerequisites.sh --json` is not usable on the current branch naming scheme. This task list follows the `speckit-tasks` structure but derives user stories, dependencies, and file ownership from the existing audit README and the current repository boundaries.

**Tests**: Automated tests were not explicitly requested for this documentation-driven remediation slice. The task list emphasizes boundary-safe refactors plus manual verification artifacts instead of inventing broad new test suites.

**Organization**: Tasks are grouped by user story so centralized i18n foundations land first, then user-visible UI migration, then default-content and internal message cleanup.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel when the listed files do not overlap with incomplete tasks
- **[Story]**: Which user story the task belongs to (`US1`, `US2`, `US3`)
- Every task includes the exact file path(s) expected for implementation

## Phase 1: Setup (Audit Scaffolding)

**Purpose**: Turn the raw audit into execution-ready remediation inputs before code changes begin.

- [x] T001 Create file-by-file ownership matrix in `docs/features/hardcoded-text-audit/STRING_CLASSIFICATION.md`
- [x] T002 Create remediation policy and naming rules for `app/features/i18n/locales/*`, feature adapters, `defaultContent.ts`, and `messages.ts` in `docs/features/hardcoded-text-audit/MIGRATION_PLAN.md`
- [x] T003 [P] Create manual verification checklist for UI, authoring, and backend message flows in `docs/features/hardcoded-text-audit/MANUAL_QA.md`

---

## Phase 2: Foundational (Blocking Boundaries)

**Purpose**: Establish the centralized i18n ownership model and supporting boundaries so later extraction work does not spread ad hoc constants across unrelated files.

**CRITICAL**: No user story work should begin until this phase is complete.

- [x] T004 Create centralized i18n runtime surface in `app/features/i18n/index.ts` and `app/features/i18n/types.ts`
- [x] T005 [P] Create locale dictionaries in `app/features/i18n/locales/ko.ts` and `app/features/i18n/locales/en.ts`
- [x] T006 [P] Create UI adapter modules that read from centralized i18n in `app/components/ui/copy.ts`, `app/features/workspace/copy.ts`, and `app/features/canvas-ui-entrypoints/copy.ts`
- [x] T007 [P] Create shared default-content source module in `app/features/editing/defaultContent.ts`
- [x] T008 [P] Create API and backend message helper modules in `app/app/api/_shared/messages.ts` and `libs/cli/src/messages.ts`

**Checkpoint**: Centralized locale dictionaries and adapter boundaries exist; phased migration can now proceed without reopening ownership decisions.

---

## Phase 3: User Story 1 - User-Facing App Surfaces Use Centralized Locale Data (Priority: P1) 🎯 MVP

**Goal**: Dashboard, dialogs, search, and app-shell surfaces no longer embed user-facing strings inline; they resolve text from `app/features/i18n/locales/*` through feature adapters.

**Independent Test**: Open the dashboard, workspace detail page, quick open, search overlay, export dialog, and theme/font/background controls; confirm the rendered text is unchanged while the touched component files no longer contain direct UI copy literals and all surfaced strings resolve through the centralized locale dictionaries.

### Implementation for User Story 1

- [x] T009 [US1] Add app-shell, dialog, and search namespaces to `app/features/i18n/locales/ko.ts` and `app/features/i18n/locales/en.ts`
- [x] T010 [P] [US1] Move app-shell copy from `app/components/ui/Header.tsx`, `app/components/ui/QuickOpenDialog.tsx`, `app/components/ui/SearchOverlay.tsx`, and `app/components/ExportDialog.tsx` to read through `app/components/ui/copy.ts` backed by `app/features/i18n/index.ts`
- [x] T011 [P] [US1] Move selector/toggle/inspector copy from `app/components/BackgroundSelector.tsx`, `app/components/FontSelector.tsx`, `app/components/ui/ThemeModeToggle.tsx`, and `app/components/ui/StickerInspector.tsx` to read through `app/components/ui/copy.ts` backed by `app/features/i18n/index.ts`
- [x] T012 [US1] Add workspace/dashboard namespaces to `app/features/i18n/locales/ko.ts` and `app/features/i18n/locales/en.ts`, then migrate `app/features/workspace/components/DashboardHeader.tsx`, `app/features/workspace/components/DashboardSidebar.tsx`, `app/features/workspace/components/WorkspaceCard.tsx`, `app/features/workspace/components/WorkspaceListItem.tsx`, `app/features/workspace/components/CanvasCard.tsx`, `app/features/workspace/components/CanvasListItem.tsx`, `app/features/workspace/pages/WorkspaceDashboardPage.tsx`, and `app/features/workspace/pages/WorkspaceDetailPage.tsx` through `app/features/workspace/copy.ts`

**Checkpoint**: User-facing app and workspace surfaces are centrally localized without changing behavior.

---

## Phase 4: User Story 2 - Canvas Authoring Labels And Default Content Adopt Centralized Localization Boundaries (Priority: P1)

**Goal**: Toolbar labels, context-menu labels, selection-menu labels, and default node/plugin sample content stop living inline in authoring/runtime files and move behind centralized localization or dedicated default-content modules.

**Independent Test**: Open the canvas editor, inspect the toolbar, pane/node context menus, selection floating menu, create-node flows, and plugin sample surfaces; confirm labels/default content behave the same while the touched files consume centralized locale dictionaries or dedicated default-content sources.

### Implementation for User Story 2

- [x] T013 [US2] Add canvas authoring namespaces to `app/features/i18n/locales/ko.ts` and `app/features/i18n/locales/en.ts`
- [x] T014 [P] [US2] Move toolbar action and section labels from `app/features/canvas-ui-entrypoints/canvas-toolbar/toolbarActions.ts` and `app/features/canvas-ui-entrypoints/canvas-toolbar/toolbarSections.ts` to read through `app/features/canvas-ui-entrypoints/copy.ts` backed by `app/features/i18n/index.ts`
- [x] T015 [P] [US2] Move node and pane context-menu labels from `app/features/canvas-ui-entrypoints/node-context-menu/nodeMenuItems.ts` and `app/features/canvas-ui-entrypoints/pane-context-menu/paneMenuItems.ts` to read through `app/features/canvas-ui-entrypoints/copy.ts` backed by `app/features/i18n/index.ts`
- [x] T016 [P] [US2] Move selection-menu labels from `app/features/canvas-ui-entrypoints/selection-floating-menu/controlInventory.ts`, `app/features/canvas-ui-entrypoints/selection-floating-menu/SelectionFloatingMenu.tsx`, and `app/processes/canvas-runtime/bindings/toolbarPresenter.ts` to read through `app/features/canvas-ui-entrypoints/copy.ts` backed by `app/features/i18n/index.ts`
- [x] T017 [US2] Move node default labels and initial content from `app/features/editing/createDefaults.ts` into `app/features/editing/defaultContent.ts` and align user-visible defaults with keys or localized values sourced from `app/features/i18n/locales/ko.ts` and `app/features/i18n/locales/en.ts`
- [x] T018 [P] [US2] Move plugin example sample titles and labels from `app/features/plugin-runtime/examples/index.ts` and `app/features/plugin-runtime/examples/chart/index.tsx` to localized/default-content exports while keeping runtime behavior unchanged

**Checkpoint**: Canvas authoring and default-content surfaces stop treating inline strings as canonical data.

---

## Phase 5: User Story 3 - Internal API/CLI Messages Separate Copy From Machine Codes (Priority: P2)

**Goal**: API routes, WebSocket/RPC layers, CLI commands, and MCP/backend transports keep machine-readable codes stable while moving user-facing message text behind dedicated message helpers.

**Independent Test**: Trigger representative route errors, WebSocket/RPC failures, CLI help/errors, and MCP/backend transport errors; confirm codes and behavior remain stable while message text is sourced through dedicated helpers instead of inline literals.

### Implementation for User Story 3

- [x] T019 [US3] Move route-level error/fallback message text from `app/app/api/app-state/preferences/route.ts`, `app/app/api/app-state/session/route.ts`, `app/app/api/app-state/recent-canvases/route.ts`, `app/app/api/app-state/workspaces/route.ts`, `app/app/api/workspaces/route.ts`, `app/app/api/canvases/route.ts`, `app/app/api/render/route.ts`, `app/app/api/file-tree/route.ts`, `app/app/api/assets/file/route.ts`, and `app/app/api/assets/upload/route.ts` into `app/app/api/_shared/messages.ts`
- [x] T020 [P] [US3] Separate RPC/patch/server message ownership in `app/ws/rpc.ts`, `app/ws/filePatcher.ts`, and `app/ws/server.ts` so codes stay inline but user-facing text is centralized
- [x] T021 [P] [US3] Move CLI command help/status/error copy from `libs/cli/src/bin.ts`, `libs/cli/src/commands/dev.ts`, `libs/cli/src/commands/init.ts`, `libs/cli/src/commands/new.ts`, `libs/cli/src/commands/render.ts`, `libs/cli/src/commands/validate.ts`, `libs/cli/src/commands/image.ts`, `libs/cli/src/commands/workspace.ts`, `libs/cli/src/commands/canvas.ts`, `libs/cli/src/commands/canvas-node.ts`, `libs/cli/src/commands/object.ts`, `libs/cli/src/commands/mutation.ts`, `libs/cli/src/commands/search.ts`, and `libs/cli/src/commands/surface.ts` into `libs/cli/src/messages.ts`
- [x] T022 [P] [US3] Move MCP and backend transport copy from `libs/cli/src/mcp/tools.ts`, `libs/cli/src/mcp/resources.ts`, `libs/cli/src/mcp/utils.ts`, `libs/cli/src/server/http.ts`, and `libs/cli/src/server/websocket.ts` into `libs/cli/src/messages.ts`

**Checkpoint**: Internal protocols keep stable codes and behavior while human-readable text gains explicit ownership.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Close the loop on documentation, progress tracking, and residual backlog after the migrations land.

- [x] T023 [P] Update remediation status, centralized i18n module references, and remaining hotspots in `docs/features/hardcoded-text-audit/README.md`, `docs/features/hardcoded-text-audit/STRING_CLASSIFICATION.md`, and `docs/features/hardcoded-text-audit/MIGRATION_PLAN.md`
- [ ] T024 [P] Execute the manual verification checklist and record residual blockers or deferred follow-ups in `docs/features/hardcoded-text-audit/MANUAL_QA.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies
- **Foundational (Phase 2)**: Depends on Setup and blocks all user stories
- **US1 (Phase 3)**: Depends on Foundational
- **US2 (Phase 4)**: Depends on Foundational and can progress in parallel with late US1 cleanup once the UI copy module boundaries are fixed
- **US3 (Phase 5)**: Depends on Foundational and should start only after the message-helper ownership pattern is proven in the app layer
- **Polish (Phase 6)**: Depends on the stories you intend to ship

### User Story Dependencies

- **US1**: First MVP increment because it removes the highest-volume user-facing inline copy
- **US2**: Builds on the same extraction pattern for editor surfaces and default content
- **US3**: Applies the ownership split to internal message layers after the UI-side pattern is stable

### Within Each User Story

- Create or stabilize the owning module before touching consumer files
- Migrate user-facing text without changing machine-readable IDs, codes, or behavior
- Finish each story’s manual verification path before moving to the next dependent slice

### Parallel Opportunities

- `T003` can run in parallel with `T001` and `T002`
- `T005`, `T006`, `T007`, and `T008` can run in parallel after the remediation policy is fixed
- `T010` and `T011` can run in parallel after `T009`
- `T014`, `T015`, `T016`, and `T018` can run in parallel inside User Story 2 after `T013`
- `T020`, `T021`, and `T022` can run in parallel inside User Story 3
- `T023` and `T024` can run in parallel during Polish

---

## Parallel Example: User Story 2

```bash
Task T014: Move toolbar labels through app/features/canvas-ui-entrypoints/copy.ts backed by app/features/i18n/index.ts
Task T015: Move node and pane context-menu labels through app/features/canvas-ui-entrypoints/copy.ts backed by app/features/i18n/index.ts
Task T018: Move plugin example sample titles and labels in app/features/plugin-runtime/examples/index.ts and app/features/plugin-runtime/examples/chart/index.tsx
```

## Parallel Example: User Story 3

```bash
Task T020: Separate RPC/patch/server message ownership in app/ws/rpc.ts, app/ws/filePatcher.ts, and app/ws/server.ts
Task T021: Move CLI command help/status/error copy into libs/cli/src/messages.ts
Task T022: Move MCP and backend transport copy into libs/cli/src/messages.ts
```

---

## Implementation Strategy

### MVP First

1. Complete Phase 1 and Phase 2
2. Deliver Phase 3 (US1) for the user-facing app surfaces
3. Validate the dashboard/dialog/search flows before widening the migration

### Incremental Delivery

1. Foundation: centralized i18n runtime plus message/default-content boundaries
2. US1: user-facing app and workspace surfaces
3. US2: canvas authoring labels and default content
4. US3: internal API/CLI/backend message cleanup
5. Polish: status tracking and residual backlog capture

### Suggested MVP Scope

- Phase 1
- Phase 2
- Phase 3

---

## Notes

- All tasks follow the required checklist format with checkbox, task ID, optional `[P]`, optional `[US#]`, and explicit file path(s)
- The current repository does not have a general i18n framework, so this task list explicitly introduces `app/features/i18n/` as the centralized locale source instead of relying only on feature-local copy modules
- `examples/` directory files stay out of scope for this slice; only runtime-affecting example modules under `app/features/plugin-runtime/examples/` are included
