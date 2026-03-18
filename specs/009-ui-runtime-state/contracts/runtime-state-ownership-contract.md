# Contract: Runtime State Ownership

## Purpose

Define strict ownership boundaries for `ui-runtime-state` so entrypoint surfaces share runtime coordination without crossing persistence or mutation-schema boundaries.

## In Scope

- Active tool runtime state
- Open primary surface descriptor
- Anchor snapshot registry
- Foundation hover registry
- Optimistic pending UI registry

## Out of Scope

- Persisted canvas/document/object schema changes
- Canonical mutation schema/action schema definition
- Selection metadata source-of-truth ownership
- Search/text-edit/export/app-wide modal redesign

## Ownership Rules

1. Runtime UI coordination state is owned by one graph-store sub-slice.
2. Selection is consumed as input; selection ownership is not duplicated.
3. Persisted state boundaries are read-only from this slice perspective.
4. No second independent global store may be introduced for this scope.
5. Surface components/hooks consume selectors/actions and do not re-own cross-surface state.

## Consumer Matrix

| Consumer | Read | Write |
|---|---|---|
| `canvas-toolbar` | `activeTool`, `openSurface` | `setActiveTool`, `openSurface`, `closeSurface` |
| `pane-context-menu` | `openSurface`, `anchorsById` | `openSurface`, `closeSurface`, `registerAnchor`, `clearAnchor` |
| `node-context-menu` | `openSurface`, `anchorsById`, `hover` | `openSurface`, `closeSurface`, `registerAnchor`, `clearAnchor` |
| `selection-floating-menu` (future) | `openSurface`, `anchorsById`, selection-derived context | same selector/action set |
| editing feedback UI | `pendingByRequestId` | `beginPending`, `commitPending`, `failPending`, `clearPending` |

## Guarantees

- Runtime contract remains implementation-ready without redefining persistence/mutation contracts.
- Ownership boundaries are explicit enough for parallel work across entrypoint surfaces.
