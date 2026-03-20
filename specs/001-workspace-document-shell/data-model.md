# Data Model: Workspace Registry + Document Sidebar

## Entity: RegisteredWorkspace

- **Purpose**: Represents a workspace known by the app shell.
- **Fields**:
  - `workspaceId`: stable identifier
  - `displayName`: user-facing workspace name
  - `rootPath`: absolute local path selected by user
  - `status`: availability marker (`available`, `unavailable`)
  - `lastOpenedAt`: timestamp of most recent activation
  - `lastActiveDocumentId`: optional pointer for resume
- **Validation Rules**:
  - `workspaceId` must be unique in registry.
  - `rootPath` must be normalized before dedupe checks.
  - `status` can only be one of defined enum values.

## Entity: ActiveWorkspaceSession

- **Purpose**: Runtime selection context used by sidebar, document open, and canvas entry.
- **Fields**:
  - `activeWorkspaceId`
  - `activeRootPath`
  - `activeDocumentId` (nullable)
  - `sessionScopeVersion` (increment on workspace switch)
- **Validation Rules**:
  - Exactly one session may be active at a time.
  - `activeWorkspaceId` must reference a registered workspace.
  - Workspace switch must reset stale selection/search scopes.

## Entity: DocumentSummary

- **Purpose**: Lightweight document list item shown in sidebar.
- **Fields**:
  - `documentId`
  - `workspaceId`
  - `title`
  - `updatedAt`
  - `entrySurface` (main canvas reference)
- **Validation Rules**:
  - `documentId` unique per workspace.
  - `title` required (fallback naming policy applies if empty input).
  - `workspaceId` must match currently queried workspace scope.

## Entity: WorkspacePathHealth

- **Purpose**: Captures path accessibility and remediation options.
- **Fields**:
  - `workspaceId`
  - `status` (`available`, `unavailable`)
  - `lastCheckedAt`
  - `lastKnownPath`
  - `failureReason` (nullable)
- **Validation Rules**:
  - `lastKnownPath` must always be retained when status becomes unavailable.
  - Reconnect attempts must not overwrite path metadata on failure.

## Entity: WorkspaceUtilityAction

- **Purpose**: User-triggered action on workspace path ownership surface.
- **Fields**:
  - `actionType` (`show-in-finder`, `copy-path`, `reconnect`, `remove`)
  - `workspaceId`
  - `requestedAt`
  - `result` (`success`, `failed`, `cancelled`)
- **Validation Rules**:
  - Action must target an existing registry entry.
  - Failed actions must produce explicit outcome metadata.

## Relationships

- `RegisteredWorkspace` 1 - N `DocumentSummary`
- `RegisteredWorkspace` 1 - 1 current `WorkspacePathHealth`
- `ActiveWorkspaceSession.activeWorkspaceId` -> `RegisteredWorkspace.workspaceId`
- `WorkspaceUtilityAction.workspaceId` -> `RegisteredWorkspace.workspaceId`

## State Transitions

### Workspace availability

1. `available` -> `unavailable` when root path access check fails.
2. `unavailable` -> `available` when reconnect succeeds.
3. `unavailable` -> removed state when user chooses remove.

### Active session lifecycle

1. No active workspace -> set active workspace on first create/add/select.
2. Active workspace A -> active workspace B on switch action.
3. Active workspace -> same workspace with new `activeDocumentId` on document open.

### Document bootstrap

1. `New Document` request -> persisted document created in active workspace scope.
2. Document summary inserted into active workspace list.
3. Session enters document main canvas entry surface.
