# Contract: Anchor Snapshot Registry

## Purpose

Define how overlay anchors are stored and cleaned for runtime-only UI positioning.

## Snapshot Fields

- `anchorId`
- `kind` (`pointer`, `node`, `selection-bounds`, `toolbar-trigger`)
- optional `ownerId`
- optional `nodeIds`
- optional `screen` coordinates
- optional `flow` coordinates
- optional `viewport` snapshot

## Capture Rules

1. Anchors must be serializable snapshots.
2. DOM references (`HTMLElement`, direct `DOMRect` objects) are prohibited in store state.
3. Anchors should include enough owner/selection/viewport metadata for deterministic cleanup.

## Cleanup Rules

1. Remove anchors tied to deleted nodes.
2. Remove or recalculate anchors invalidated by selection change.
3. Remove stale pointer/viewport snapshots after dismiss or invalidation events.
4. Keep registry consistent with active `openSurface.anchorId` references.

## Positioning Guarantees

- Shared anchor vocabulary allows toolbar/context-menu/floating surfaces to reuse positioning logic.
- Viewport and selection transitions cannot leave stale coordinates as active positioning sources.
