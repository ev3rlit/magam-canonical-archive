# Quickstart: Workspace Registry + Document Sidebar

## Purpose

Validate the workspace/document shell transition from file-first sidebar behavior to workspace-first document navigation.

## Preconditions

- App runs with the feature branch artifacts in place.
- Local machine can create/select folders.
- At least one disposable folder path is available for workspace creation tests.

## Scenario 1: First-run workspace bootstrap

1. Launch app with no registered workspaces.
2. Confirm first-run empty state shows `New Workspace` and `Add Existing Workspace`.
3. Create a new workspace by selecting a local folder.
4. Verify the created workspace becomes active immediately.

Expected:

- No file-tree-first view is shown as primary navigation.
- Active workspace identity and local path are visible in sidebar workspace section.

## Scenario 2: Multi-workspace registry with single active session

1. Add a second workspace via `Add Existing Workspace`.
2. Switch between workspace A and workspace B from switcher.
3. Observe document list and active document context on each switch.

Expected:

- Only one workspace is active at a time.
- Document list reflects only active workspace scope.
- Prior workspace selection/search context does not leak into the next workspace.

## Scenario 3: Document-first sidebar and document bootstrap

1. In an active workspace with no documents, click `New Document`.
2. Confirm new document appears in sidebar list.
3. Confirm app enters new document main canvas immediately.

Expected:

- Document is persisted as a real authoring unit (not draft-only fake path).
- Sidebar primary surface remains document list.

## Scenario 4: Local ownership utilities

1. Open workspace utilities for active workspace.
2. Trigger `Show in Finder`.
3. Trigger `Copy Path`.

Expected:

- System opens workspace location in file browser.
- Copied path matches active workspace root path shown in UI.

## Scenario 5: Missing path recovery

1. Make one registered workspace path inaccessible (or simulate with invalid path mapping).
2. Relaunch app or refresh workspace health checks.
3. Confirm workspace entry shows unavailable status and remediation actions.
4. Run reconnect with valid replacement path.

Expected:

- No silent fallback workspace activation.
- Unavailable entry presents `Reconnect` and `Remove`.
- Successful reconnect restores entry to available state.

## Scenario 6: Legacy compatibility boundary

1. Inspect sidebar primary sections after feature applied.
2. Check legacy TSX access path location (if exposed).

Expected:

- Legacy TSX path is not primary navigation.
- Compatibility/import access remains available without replacing document-first flow.

## Completion Criteria

- All scenarios pass without cross-workspace state leakage.
- Active workspace scope is explicit and stable through switching.
- Document bootstrap is persisted and immediate.
- Path failure handling is explicit, actionable, and non-silent.
