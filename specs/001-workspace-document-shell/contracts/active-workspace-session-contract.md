# Contract: Active Workspace Session

## Purpose

Defines runtime scope rules for selecting and switching the active workspace.

## Inputs

- select workspace from switcher
- open document within active workspace
- initialize session on app startup

## Required Guarantees

- Exactly one active workspace exists at runtime.
- Switching active workspace resets document/search/selection scope to the selected workspace boundary.
- Session restore uses registry metadata and does not cross workspace boundaries.
- Active session never points to a workspace that is not present in registry.

## Session State

- `activeWorkspaceId`
- `activeRootPath`
- `activeDocumentId` (nullable)
- `sessionScopeVersion`

## Failure Handling

- If selected workspace is unavailable, session does not switch silently.
- Unavailable selections surface explicit status and reconnect/remove options.

## Exclusions

- This contract does not define document rendering internals.
- This contract does not define multi-active or multi-window behavior.
