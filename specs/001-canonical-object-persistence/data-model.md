# Data Model: Canonical Object Persistence

## 1) CanonicalObjectRecord

- Purpose: native object의 canonical persistence 단위.

| Field | Type | Required | Description |
|------|------|----------|-------------|
| `id` | string | Yes | workspace 범위 유일 canonical object identifier |
| `workspaceId` | string | Yes | object ownership boundary |
| `semanticRole` | string | Yes | canonical semantic role |
| `primaryContentKind` | string | No | content query/index projection |
| `publicAlias` | string | No | authoring provenance hint |
| `contentBlocks` | array | No | ordered extensible note-like body blocks |
| `sourceMeta` | object | Yes | source provenance and edit routing metadata |
| `capabilities` | object | Yes | canonical capability bag |
| `capabilitySources` | object | No | explicit / legacy-inferred / alias-default provenance |
| `canonicalText` | string | Yes | normalized search/index text |
| `extensions` | object | No | namespaced extension payload |
| `deletedAt` | timestamp | No | logical tombstone marker for deleted canonical objects |

### Validation

- `(workspaceId, id)` 조합은 유일해야 한다.
- `semanticRole`은 approved canonical role set에 속해야 한다.
- `primaryContentKind`, if present, must match direct `capabilities.content.kind` or the derived projection of `contentBlocks` (`markdown` when any built-in markdown block exists, `text` when only built-in text blocks exist, `NULL` allowed when only custom blocks exist).
- `contentBlocks`, if present, must preserve order, have unique block ids, and use either supported core block types or namespaced custom block types.
- `contentBlocks` and direct `capabilities.content` cannot both act as the same note body truth.
- new editable note-like records without `contentBlocks` input are seeded with one empty text block.
- unknown capability keys are rejected.
- tombstoned record는 placeholder resolution을 위해 핵심 provenance와 capability snapshot을 유지해야 한다.

### Note Body Blocks

```ts
type ContentBlockRecord =
  | { id: string; blockType: 'text'; text: string }
  | { id: string; blockType: 'markdown'; source: string }
  | {
      id: string;
      blockType: string;
      payload: Record<string, unknown>;
      textualProjection?: string;
      metadata?: Record<string, unknown>;
    };
```

### Validation

- block order in the array is canonical display/edit order.
- core block types `text` and `markdown` receive first-class validation in this slice.
- custom blocks must use namespaced `blockType` values such as `core.callout` or `plugin.table`.
- empty note-like body requests are normalized to a single empty `text` block instead of a missing array.
- `canonicalText` is recomputed from ordered block text/source or custom `textualProjection` when `contentBlocks` are present.

## 2) ObjectRelationRecord

- Purpose: canonical object graph edge persistence.

| Field | Type | Required | Description |
|------|------|----------|-------------|
| `id` | string | Yes | relation identifier |
| `workspaceId` | string | Yes | workspace ownership |
| `fromObjectId` | string | Yes | source canonical object |
| `toObjectId` | string | Yes | target canonical object |
| `relationType` | string | Yes | relation meaning |
| `sortKey` | number | No | ordering for relation collections |
| `metadata` | object | No | relation metadata |

### Validation

- both endpoints must resolve to existing canonical objects in the same workspace.
- dangling relation writes are rejected.
- creating new relations against tombstoned objects is disallowed.

## 3) CanvasNodeRecord

- Purpose: document surface placement/composition persistence.

| Field | Type | Required | Description |
|------|------|----------|-------------|
| `id` | string | Yes | node identifier |
| `documentId` | string | Yes | document ownership |
| `surfaceId` | string | Yes | surface ownership |
| `nodeKind` | string | Yes | `native`, `plugin`, `binding-proxy` |
| `canonicalObjectId` | string | Conditional | required when `nodeKind = native` |
| `pluginInstanceId` | string | Conditional | required when `nodeKind = plugin` |
| `parentNodeId` | string | No | composition/container parent |
| `layout` | object | Yes | placement geometry |
| `style` | object | No | visual style projection |
| `props` | object | No | canvas-local display props only |
| `persistedState` | object | No | local node UI state |
| `zIndex` | number | Yes | render ordering |

### Boundary Rule

- native node semantic/content/capability truth never lives in `props`.
- native node initial note body may be supplied as create input, but persisted canonical truth lives in `CanonicalObjectRecord.contentBlocks`, not in `props`.
- if the referenced canonical object is tombstoned, the node resolves through placeholder/tombstone UI behavior without taking ownership of the canonical payload.

## 4) CanvasBindingRecord

- Purpose: binding between document composition and canonical/query data.

| Field | Type | Required | Description |
|------|------|----------|-------------|
| `id` | string | Yes | binding identifier |
| `documentId` | string | Yes | document ownership |
| `nodeId` | string | Yes | bound node |
| `bindingKind` | string | Yes | `object`, `query`, `relation-set`, `field-map` |
| `sourceRef` | object | Yes | canonical object ref or query spec |
| `mapping` | object | Yes | display/data mapping rules |

### Validation

- bindings may reference canonical objects or query specs, but they do not become the canonical source of semantic/content data.
- bindings that resolve to tombstoned objects must preserve diagnosable placeholder behavior.

## 5) DocumentRevisionRecord

- Purpose: append-only revision history for persistence mutations.

| Field | Type | Required | Description |
|------|------|----------|-------------|
| `id` | string | Yes | revision id |
| `documentId` | string | Yes | affected document |
| `revisionNo` | number | Yes | monotonic revision sequence |
| `authorKind` | string | Yes | user / agent / system |
| `authorId` | string | Yes | author identifier |
| `mutationBatch` | object | Yes | persisted mutation envelope |
| `snapshotRef` | string | No | snapshot/export reference |

## Relationships

- `CanonicalObjectRecord` 1..* <- `ObjectRelationRecord` -> 1..* `CanonicalObjectRecord`
- `CanonicalObjectRecord.contentBlocks` -> embedded ordered `ContentBlockRecord[]` value object
- `CanvasNodeRecord(nodeKind=native)` -> exactly one `CanonicalObjectRecord`
- `CanvasBindingRecord` -> one `CanvasNodeRecord` and one canonical/query source reference
- `DocumentRevisionRecord` -> one document mutation history stream
- one `CanonicalObjectRecord` may be referenced by multiple `CanvasNodeRecord`s across multiple documents in the same workspace for non-note objects, while editable note-like records always default to cloned canonical objects on create/duplicate/import in this slice

## State Transitions

1. `AliasInput` -> `CanonicalObjectRecord`
   - Trigger: alias/legacy input is normalized before persistence
2. `EditableNoteCreateInput` -> `SeededContentBlocks`
   - Trigger: note-like create request omits body blocks and persistence seeds one empty text block
3. `CanonicalObjectRecord` -> `ReusedAcrossDocuments`
   - Trigger: additional non-note native nodes reference the same canonical object from other documents/surfaces
4. `CanonicalObjectRecord` -> `Tombstoned`
   - Trigger: canonical delete request is accepted as logical deletion
5. `Tombstoned` + `CanvasNodeRecord` -> `PlaceholderResolved`
   - Trigger: canvas/query layer resolves a deleted canonical object for diagnostics or placeholder rendering
6. `EditableNoteDuplicateInput` -> `ClonedCanonicalObjectRecord`
   - Trigger: create/duplicate/import targets another document or surface
7. `CanonicalObjectRecord` + `CanvasNodeRecord` -> `RevisionRecorded`
   - Trigger: persistence mutation completes and appends document revision

## Invariants

- canonical payload ownership is never duplicated as storage truth in `canvas_nodes.props`.
- every native node references one canonical object.
- editable note-like canonical objects preserve ordered `contentBlocks` as canonical truth.
- canonical object identity is unique within a workspace and non-note objects can be reused across multiple documents, but editable note-like objects default to clone-on-create semantics in this slice.
- relation endpoints must always resolve to existing canonical objects.
- tombstoned canonical objects remain resolvable enough to support placeholder canvas behavior and diagnostics.
