# Debug Session: Phase 01 Grouping Does Not Preserve Structural Selection

## Symptom

After grouping multiple objects, the UI does not remain in a stable group selection state. The observed result is a single selected object, so group focus cannot be entered.

## Root Cause

The grouping dispatch only writes `groupId` membership onto each selected node. It does not include any runtime action that reselects the full grouped set or otherwise promotes the selection into a group-level state. `GraphCanvas` only allows group-focus entry when the full group is already selected, so a collapsed post-group selection blocks the feature.

## Evidence

- `app/features/editing/actionRoutingBridge/registry.ts`
  - `buildGroupSelectionPlan()` emits `apply-node-data-patch` plus `node.group-membership.update` for each node, but no runtime selection action after grouping.
- `app/components/GraphCanvas.tsx`
  - `resolveGroupFocusEntry()` returns `null` unless every node in the group is already selected.
- `e2e/canvas-core-authoring.spec.ts`
  - The structure test starts from nodes that are already grouped and validates `group select` / `enter group`, but it never covers the transition from fresh grouping to post-group selection.

## Suggested Fix Direction

- After `selection.group` succeeds, explicitly preserve or restore full-group selection before the user attempts `group focus`.
- Add end-to-end coverage for grouping fresh multi-selection and then entering group focus.
