# Event Contracts

## Aggregate Events

### Canvas Aggregate

- `CanvasNodeCreated`
- `CanvasNodeMoved`
- `CanvasNodeReparented`
- `CanvasNodeResized`
- `CanvasNodeRotated`
- `CanvasNodePresentationStyleUpdated`
- `CanvasNodeRenderProfileUpdated`
- `CanvasNodeRenamed`
- `CanvasNodeDeleted`
- `CanvasNodeZOrderUpdated`
- `CanvasMindmapMembershipChanged`

### Canonical Object Aggregate

- `ObjectContentUpdated`
- `ObjectCapabilityPatched`
- `ObjectBodyBlockInserted`
- `ObjectBodyBlockUpdated`
- `ObjectBodyBlockRemoved`
- `ObjectBodyBlockReordered`

## Application / Control Events

- `CanvasMutationDryRunValidated`
- `CanvasMutationRejected`
- `CanvasVersionConflictDetected`
- `CanvasChanged`

## Boundary Rule

- aggregate events describe committed domain facts
- application/control events describe execution outcomes and invalidation
- WebSocket notifications are transport adapters for these outcomes, not the event contract itself

## Migration Checkpoints

- `app/ws/methods.ts` stops inventing transport-owned semantics for dry-run/conflict/history
- invalidate behavior is driven from runtime application events and result envelopes
