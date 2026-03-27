# Projection Contracts

## Hierarchy Projection

**Responsibility**

- tree-first structural understanding
- node hierarchy
- parent-child topology
- surface membership
- mindmap membership/topology
- canonical object linkage

**Current hotspots to migrate from**

- `app/features/render/parseRenderGraph.ts`
- `libs/shared/src/lib/canonical-query/workspace-canvas.ts`

**Verification**

- CLI can understand structure without render payloads
- hierarchy response does not contain renderer-specific fields

## Render Projection

**Responsibility**

- framework-neutral render metadata
- surface identity
- z-order
- bounds/layout data
- rendered node/edge/mindmap group set before renderer adaptation

**Current hotspots to migrate from**

- `app/features/render/parseRenderGraph.ts`
- portions of `libs/shared/src/lib/canonical-query/render-canvas.ts`

**Verification**

- `parseRenderGraph.ts` becomes a renderer adapter
- ReactFlow payload is derived from render projection, not treated as the projection

## Editing Projection

**Responsibility**

- editability
- capability metadata
- source identity
- edit target identity
- body entry capability
- ordered body block metadata
- selection / anchor / index targeting metadata

**Current hotspots to migrate from**

- `app/features/editing/editability.ts`
- `app/components/editor/workspaceEditUtils.ts`
- `app/features/editing/actionRoutingBridge/*`

**Verification**

- UI and CLI can resolve the same editable target set
- body block targeting metadata is stable enough for history normalization

## Cross-Projection Rule

- hierarchy, render, and editing are complementary, not interchangeable
- no projection exposes raw DB row shape
- no projection exposes ReactFlow or other renderer payloads
