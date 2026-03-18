# Data Model: UI Runtime State

## 1) EntrypointRuntimeState

- Purpose: Entry-point foundation owned runtime-only state for cross-surface UI coordination.

| Field | Type | Required | Description |
|------|------|----------|-------------|
| `activeTool` | `ActiveToolState` | Yes | Current interaction/create mode for canvas entrypoint surfaces |
| `openSurface` | `OpenSurfaceDescriptor \| null` | Yes | Currently open primary surface and dismiss contract metadata |
| `anchorsById` | `Record<string, AnchorSnapshot>` | Yes | Anchor snapshot registry used for overlay positioning |
| `hover` | `HoverRegistry` | Yes | Shared hover state consumed by entrypoint surfaces |
| `pendingByRequestId` | `Record<string, PendingUiAction>` | Yes | Optimistic runtime pending state keyed by request/command IDs |

### Validation

- State is session runtime only and must not be persisted into canonical object/document schema.
- `openSurface` must reference an existing anchor when `anchorId` is present.
- Unknown pending statuses are invalid.

## 2) ActiveToolState

- Purpose: Current canvas interaction mode used by toolbar and canvas shell.

| Field | Type | Required | Description |
|------|------|----------|-------------|
| `interactionMode` | `'pointer' \| 'hand'` | Yes | Active interaction mode |
| `createMode` | `GraphCanvasCreateMode` | Yes | Active create mode selection |

### Validation

- Must reset to runtime defaults on page reload.
- Must remain compatible with existing `GraphCanvas` create-mode consumers.

## 3) OpenSurfaceDescriptor

- Purpose: Normalized descriptor for the currently open primary UI surface.

| Field | Type | Required | Description |
|------|------|----------|-------------|
| `kind` | `EntrypointSurfaceKind` | Yes | Surface identity (`toolbar-*`, `pane-context-menu`, `node-context-menu`, `selection-floating-menu`) |
| `anchorId` | `string` | Yes | Registry key for positioning context |
| `ownerId` | `string` | No | Optional owner identity (node/surface owner) |
| `dismissOnSelectionChange` | `boolean` | Yes | Whether selection change closes this surface |
| `dismissOnViewportChange` | `boolean` | Yes | Whether viewport move/zoom closes this surface |

### Validation

- At most one descriptor may exist at a time.
- Opening a new primary surface replaces/clears previous descriptor.

## 4) AnchorSnapshot

- Purpose: Serializable anchor description for overlay positioning and cleanup.

| Field | Type | Required | Description |
|------|------|----------|-------------|
| `anchorId` | `string` | Yes | Unique anchor registry ID |
| `kind` | `EntrypointAnchorKind` | Yes | Anchor category (`pointer`, `node`, `selection-bounds`, `toolbar-trigger`) |
| `ownerId` | `string` | No | Optional owner identity |
| `nodeIds` | `string[]` | No | Node linkage for selection/node anchors |
| `screen` | `{ x: number; y: number; width?: number; height?: number }` | No | Screen-space coordinates |
| `flow` | `{ x: number; y: number }` | No | Flow-space coordinates |
| `viewport` | `{ x: number; y: number; zoom: number }` | No | Viewport snapshot used for recalculation |

### Validation

- Must be serializable; DOM references are prohibited.
- Anchors linked to removed nodes or invalid selection ownership must be cleaned up.

## 5) HoverRegistry

- Purpose: Foundation-level hover state consumed by multiple entrypoint surfaces.

| Field | Type | Required | Description |
|------|------|----------|-------------|
| `nodeIdsByGroupId` | `Record<string, string[]>` | Yes | Group-level hover tracking |
| `targetNodeId` | `string \| null` | Yes | Current hover target |

### Validation

- Registry updates must preserve current hover consumers until migration completes.

## 6) PendingUiAction

- Purpose: Runtime optimistic action entry for UI pending lifecycle.

| Field | Type | Required | Description |
|------|------|----------|-------------|
| `requestId` | `string` | Yes | Stable pending key (request or command ID) |
| `actionType` | `string` | Yes | Logical action category |
| `targetIds` | `string[]` | Yes | Affected object/node IDs |
| `status` | `'pending' \| 'rollback' \| 'committed' \| 'failed'` | Yes | Lifecycle state |
| `startedAt` | `number` | Yes | Runtime start timestamp |
| `errorMessage` | `string` | No | Failure diagnostic message |

### Validation

- `requestId` must be unique while action is active.
- Completed/failed actions must be explicitly cleared by lifecycle handlers.

## Relationships

- `EntrypointRuntimeState.activeTool` -> `ActiveToolState` (1:1)
- `EntrypointRuntimeState.openSurface` -> `OpenSurfaceDescriptor` (0..1)
- `EntrypointRuntimeState.anchorsById[*]` -> `AnchorSnapshot` (0..*)
- `EntrypointRuntimeState.hover` -> `HoverRegistry` (1:1)
- `EntrypointRuntimeState.pendingByRequestId[*]` -> `PendingUiAction` (0..*)
- `OpenSurfaceDescriptor.anchorId` references `AnchorSnapshot.anchorId`

## State Transitions

1. `Idle` -> `SurfaceOpen`
   - Trigger: open surface action from toolbar/context-menu interaction.
   - Guard: previous primary surface is closed or replaced.

2. `SurfaceOpen` -> `SurfaceOpen` (replacement)
   - Trigger: new primary surface opened while one is already open.
   - Guard: one-primary-surface exclusivity.

3. `SurfaceOpen` -> `Idle`
   - Trigger: dismiss event (outside click, selection change, viewport change, explicit close).
   - Guard: dismiss policy flags for the active surface.

4. `AnchorRegistered` -> `AnchorCleaned`
   - Trigger: node deletion, selection invalidation, or stale viewport anchor invalidation.
   - Guard: owner/selection/viewport linkage no longer valid.

5. `PendingNone` -> `PendingActive`
   - Trigger: begin pending action with request/command ID.
   - Guard: request ID not already active.

6. `PendingActive` -> `PendingResolved`
   - Trigger: commit/fail/rollback lifecycle update.
   - Guard: matching request ID exists.

7. `PendingResolved` -> `PendingNone`
   - Trigger: clear pending action.
   - Guard: lifecycle completion acknowledged.
