# Quickstart: UI Runtime State

## Purpose

Minimal execution and verification guide for implementing `009-ui-runtime-state`.

## Feature Docs

- Spec: `specs/009-ui-runtime-state/spec.md`
- Plan: `specs/009-ui-runtime-state/plan.md`
- Research: `specs/009-ui-runtime-state/research.md`
- Data model: `specs/009-ui-runtime-state/data-model.md`
- Contracts:
  - `specs/009-ui-runtime-state/contracts/runtime-state-ownership-contract.md`
  - `specs/009-ui-runtime-state/contracts/surface-dismiss-contract.md`
  - `specs/009-ui-runtime-state/contracts/anchor-snapshot-contract.md`
  - `specs/009-ui-runtime-state/contracts/pending-lifecycle-contract.md`

## 1) Setup

```bash
cd /Users/danghamo/Documents/gituhb/magam-feature-dbfcp-ui-runtime-state
bun install
```

## 2) Implementation Order

1. Add runtime-state feature module contracts (`types`, `selectors`, `actions`, reducer helpers).
2. Wire `entrypointRuntime` sub-slice into `app/store/graph.ts`.
3. Normalize open-surface ownership and dismiss rules in context-menu/toolbar consumers.
4. Register and clean anchor snapshots from graph canvas selection/viewport lifecycle.
5. Connect pending lifecycle to editing command completion events.
6. Migrate `canvas-toolbar`, `pane-context-menu`, and `node-context-menu` consumers to shared selectors/actions.

## 3) Checkpoints

- Checkpoint A: Runtime state exists as a single graph-store sub-slice (no second global store).
- Checkpoint B: Primary-surface exclusivity and dismiss behavior is centralized.
- Checkpoint C: Anchor registry stores serializable snapshots only and stale anchors are cleaned.
- Checkpoint D: Pending lifecycle supports begin/commit/fail/clear transitions keyed by request ID.
- Checkpoint E: Selection metadata ownership remains external and is consumed only as input.
- Checkpoint F: Persisted schema and mutation schema definitions remain unchanged.

## 4) Suggested Tests

```bash
# Existing baseline tests
bun test app/store/graph.test.ts app/components/GraphCanvas.test.tsx app/components/FloatingToolbar.test.tsx app/components/ContextMenu.test.tsx

# Add and run runtime-state focused tests once implemented
bun test app/store/graph.test.ts
bun test app/components/GraphCanvas.test.tsx
bun test app/components/FloatingToolbar.test.tsx
bun test app/components/ContextMenu.test.tsx
```

## 5) Manual Verification Scenarios

1. Open toolbar create menu, then open pane context menu; verify only one primary surface remains open and both surfaces reflect the same runtime owner.
2. Open node context menu, change selection; verify menu dismisses and `ContextMenu` no longer renders from stale anchor input.
3. Switch pointer/hand/create modes, reload page; verify mode is runtime-only and `FloatingToolbar` reflects the restored default state.
4. Trigger optimistic command failure; verify loading clears and pending entry is removed from both toolbar-level and canvas-level affordances.
5. Delete node with registered anchor; verify related anchor snapshot is cleaned.

## 6) Boundary Checklist

- Runtime-only UI state only.
- No persisted schema change.
- No mutation schema definition.
- No duplicated selection metadata ownership.
- No immediate BubbleContext full migration or ownership transfer.
