# Data Model: Canvas Runtime Contract

## Bounded Context Overview

`Canvas Runtime`는 canvas를 읽고 편집하는 공용 언어를 소유하는 bounded context다. 이 context 안의 primary aggregate는 `Canvas Aggregate`와 `Canonical Object Aggregate`이며, projections, mutation result, conflict, and history semantics는 이 context가 외부 consumer에 publish하는 read/write language다.

## Aggregate: Canvas Aggregate

**Purpose**

- canvas revision, node structure, parent-child topology, surface membership, z-order, and mindmap topology를 소유한다.

**Identity**

- `canvasId`
- `workspaceId`

**State**

- `revision`
- `nodes: CanvasNode[]`

**Owned invariants**

- node hierarchy는 acyclic parent-child topology여야 한다.
- node placement는 surface membership와 함께 해석된다.
- z-order는 canvas-owned ordering semantics다.
- mindmap membership and topology는 canvas-owned structure semantics다.
- `CanvasNode`는 object content를 직접 embed하지 않고 `canonicalObjectId` reference만 가진다.

**Commands routed here**

- `canvas.node.create`
- `canvas.node.move`
- `canvas.node.reparent`
- `canvas.node.resize`
- `canvas.node.rotate`
- `canvas.node.presentation-style.update`
- `canvas.node.render-profile.update`
- `canvas.node.rename`
- `canvas.node.delete`
- `canvas.node.z-order.update`

**Events emitted**

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

## Entity: CanvasNode

**Purpose**

- canvas 안의 structural/placement/render-entry 단위다.

**Fields**

- `identity`
  - `nodeId`
  - `kind`
  - `nodeType`
  - `surfaceId`
- `hierarchy`
  - `parentNodeId`
  - `zIndex`
- `transform`
  - `x`
  - `y`
  - `width`
  - `height`
  - `rotation`
  - `scaleX`
  - `scaleY`
- `presentationStyle`
- `renderProfile`
- `mindmapMembership`
  - `mindmapId`
  - `role`
- `objectLink`
  - `canonicalObjectId`
  - `pluginInstanceId`
- `interactionCapabilities`

**Validation rules**

- `rotation` is normalized absolute clockwise degrees.
- resize public input is `handle + nextSize + constraint`, not drag delta.
- `canonicalObjectId` is a reference, not embedded content.
- node-owned display identity changes do not overwrite canonical object body content.

## Aggregate: Canonical Object Aggregate

**Purpose**

- canonical content, capability payload, ordered body block collection, and body block ordering semantics를 소유한다.

**Identity**

- `objectId`

**State**

- `content`
  - `kind`
  - `data`
- `capabilities[]`
- `bodyBlocks[]`

**Owned invariants**

- content ownership is object-side, not canvas node-side.
- capability patching does not bypass object validation.
- body block order is stable and explicit.
- body block adjacency and placement semantics remain object-owned.

**Commands routed here**

- `object.content.update`
- `object.capability.patch`
- `object.body.block.insert`
- `object.body.block.update`
- `object.body.block.remove`
- `object.body.block.reorder`

**Events emitted**

- `ObjectContentUpdated`
- `ObjectCapabilityPatched`
- `ObjectBodyBlockInserted`
- `ObjectBodyBlockUpdated`
- `ObjectBodyBlockRemoved`
- `ObjectBodyBlockReordered`

## Entity-Like Member: BodyBlock

**Purpose**

- canonical object body 내부의 ordered member다.

**Fields**

- `blockId`
- `kind`
- `props`

**Why not an aggregate**

- lifecycle은 object aggregate 내부에서 관리된다.
- insert/update/remove/reorder가 object aggregate invariant를 직접 바꾼다.
- 별도 persistence/language boundary로 독립시킬 필요가 없다.

**Input vs replay rule**

- public input targeting은 selection/anchor/index를 허용한다.
- successful mutation replay는 `blockId` + `ResolvedBodyBlockPosition`로 정규화한다.

## Projection Models

### Hierarchy Projection

**Purpose**

- tree-first structural understanding for UI, CLI, and future external consumers.

**Request**

- `workspaceId?`
- `canvasId`
- `surfaceId?`
- `rootNodeId?`

**Response**

- `canvasId`
- `workspaceId?`
- `surfaceId?`
- `roots[]`
- `orphanNodeIds[]`

**Per node shape**

- `nodeId`
- `kind`
- `nodeType`
- `parentNodeId`
- `surfaceId`
- `mindmapId`
- `topologyRole`
- `zIndex`
- `canonicalObjectId`
- `pluginInstanceId?`
- `summary?`
- `children[]`

### Render Projection

**Purpose**

- framework-neutral render metadata before renderer-specific adaptation.

**Response**

- `nodes[]`
- `edges[]`
- `mindmapGroups[]`

**Per render node shape**

- `nodeId`
- `kind`
- `nodeType`
- `surfaceId`
- `canonicalObjectId`
- `transform`
- `presentationStyle`
- `renderProfile`
- `visible`
- `summary?`

**Rule**

- ReactFlow or any renderer payload is derived from this projection, not published as this projection.

### Editing Projection

**Purpose**

- editability, capability, source identity, target identity, and stable block targeting metadata.

**Response**

- `nodes[]`

**Per editing node shape**

- `nodeId`
- `surfaceId`
- `canonicalObjectId`
- `pluginInstanceId?`
- `selectionKey`
- `allowedCommands[]`
- `interactionCapabilities`
- `bodyEntry`
- `anchors[]`
- `bodyBlocks[]`
- `selectedBodyBlockId?`

**Per body block metadata**

- `blockId`
- `kind`
- `index`
- `selectionKey`
- `contentAnchorId`
- `beforeAnchorId`
- `afterAnchorId`
- `previewText?`

**Rule**

- editing projection is the source for selection/anchor/index targeting resolution.

## Mutation Models

### CanvasMutationBatch

**Fields**

- `workspaceId`
- `canvasId?`
- `actor?`
- `reason?`
- `preconditions?`
  - `canvasRevision?`
- `dryRun?`
- `commands[]`

**Rules**

- transport-specific grammar is excluded.
- commands are domain intent only.
- direct UI and CLI batch mutation converge here.

### Command Ownership Split

- `Canvas Aggregate` owns structure, placement, style profile, rename, delete, and z-order.
- `Canonical Object Aggregate` owns canonical content, capability payload, and body block collection.
- `selection.content.update` style UI intents must resolve into object content/body commands or node rename/presentation commands before entering runtime.

## Write Result / Control Models

### MutationResultEnvelope

**Success fields**

- `mutationId`
- `canvasRevisionBefore`
- `canvasRevisionAfter`
- `changed`
- `dryRun`
- `diagnostics`
- `historyEntryId?`
- `undoable?`

**Failure fields**

- `code`
- `message`
- `retryable`
- `details?`
- `diagnostics?`
- `historyEntryId?`

### Conflict Envelope

**Specialized fields**

- `code = VERSION_CONFLICT`
- `expectedCanvasRevision?`
- `actualCanvasRevision?`
- `expectedVersion?`
- `actualVersion?`

### Application / Control Events

- `CanvasMutationDryRunValidated`
- `CanvasMutationRejected`
- `CanvasVersionConflictDetected`
- `CanvasChanged`

**Rule**

- control events are runtime/application outputs, not transport-specific notifications.

## History Models

### CanvasHistoryEntry

**Fields**

- `historyEntryId`
- `canvasId`
- `actor?`
- `sessionId?`
- `mutationId`
- `forwardMutation`
- `inverseMutation?`
- `revisionBefore`
- `revisionAfter`
- `changed`
- `undoable`

### CanvasHistoryReplayBatch

**Fields**

- `workspaceId`
- `canvasId`
- `actor?`
- `reason?`
- `commands[]`
- `normalization`
  - `source`
  - `resolvedAgainstRevision`

**Rules**

- replay commands are canonical replay artifacts.
- replay batch omits original `dryRun` and preconditions.
- body block replay uses `block-id` target and resolved placement, not selection/anchor/index.

## State Transitions

### Mutation Execution

1. Receive `CanvasMutationBatch`.
2. Validate revision precondition and command capability.
3. Resolve aggregate ownership and body block target references.
4. If `dryRun`, compute validation and changed-set preview only.
5. If committed, apply aggregate-owned changes through runtime application + repository boundary.
6. Emit domain events and application/control events.
7. Rebuild affected projections.
8. Return shared mutation result envelope.
9. If successful and undoable, append normalized history entry.

### Undo / Redo

1. Load latest applicable history entry for actor/session scope.
2. Validate current revision.
3. Replay normalized inverse or forward batch.
4. On stale revision, return explicit conflict envelope.

## Explicit Exclusions

- raw DB row fields are not part of any projection or write result model
- ReactFlow nodes/edges are not projection models
- JSON-RPC params are not command contract models
- group membership is not part of v1 published command/event vocabulary in this feature
