# Debug Session: Phase 01 Floating Menu Offset from Selected Object

## Symptom

When a single object is selected, the floating controls appear far from the object instead of staying attached to its selection bounds.

## Root Cause

`GraphCanvas` registers the selection-floating-menu anchor with flow-space coordinates in the `screen` payload. The overlay host later treats `selection-bounds` anchors as already being in screen space. That coordinate-system mismatch makes the hosted floating menu drift away from the selected node after viewport translation or zoom.

## Evidence

- `app/components/GraphCanvas.tsx`
  - `buildSelectionBoundsAnchor()` writes `bounds.minX` and `bounds.minY` directly into `screen.x` and `screen.y`.
  - `resolveSelectionShellState()` already computes the correct viewport-transformed bounds (`left/top/width/height`) for the selection shell.
- `app/features/overlay-host/positioning.ts`
  - `selection-bounds` placement logic uses `anchor.x`, `anchor.y`, `anchor.width`, and `anchor.height` as screen-space values.

## Suggested Fix Direction

- Reuse the same viewport-transformed math used by the selection shell when registering the selection-floating-menu anchor.
- Add a regression test that selects an object after pan/zoom and asserts the floating menu remains adjacent to the selection.
