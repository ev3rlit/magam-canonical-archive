---
phase: 01-canvas-core-authoring
plan: 03
subsystem: ui
tags: [graph-shape, create-flows, reactflow, file-patcher, playwright]
requires:
  - phase: 01-02
    provides: stable canvas-first entry, selection shell baseline, and browser harness
provides:
  - primary create inventory for rectangle, ellipse, diamond, line, text, markdown, and sticky
  - drag-create geometry routing for minimal phase-1 shapes
  - immediate text-edit handoff for created text, markdown, and sticky nodes
affects: [01-04, 01-05, GraphCanvas, filePatcher, canvas-toolbar]
tech-stack:
  added: []
  patterns:
    - explicit create-mode catalog for primary authoring shapes while preserving legacy generic shape compatibility
    - pane drag-create sessions normalize geometry into one-shot node.create payloads
key-files:
  created:
    - .planning/phases/01-canvas-core-authoring/01-03-SUMMARY.md
  modified:
    - app/components/GraphCanvas.tsx
    - app/components/editor/WorkspaceClient.tsx
    - app/components/nodes/ShapeNode.tsx
    - app/components/nodes/StickyNode.tsx
    - app/features/editing/createDefaults.ts
    - app/features/editing/actionRoutingBridge/registry.ts
    - app/features/render/parseRenderGraph.ts
    - app/ws/filePatcher.ts
    - e2e/canvas-core-authoring.spec.ts
key-decisions:
  - "Expose rectangle, ellipse, diamond, line, text, markdown, and sticky as the primary create catalog while leaving legacy generic shape paths intact for mindmap and compatibility flows"
  - "Represent the minimal Phase 1 line tool as a graph-shape variant with normalized size and lineDirection instead of introducing richer connector semantics early"
  - "Trigger immediate editing for created text, markdown, and sticky nodes through WorkspaceClient's pending-selection handoff instead of hard-coding creation branches inside each node renderer"
patterns-established:
  - "Create-flow pattern: UI surfaces provide explicit nodeType + optional initialProps, and action routing merges those over shared defaults before node.create dispatch"
  - "Browser harness pattern: stateful mocked render payloads can cover create-mode inventory and drag-only tool rules when the live render proxy is not stable in Playwright"
requirements-completed: [SHAP-01]
duration: 29 min
completed: 2026-03-19
---

# Phase 01: 01-03 Summary

**Primary canvas creation now exposes the minimal Phase 1 shape set with one-shot rectangle/ellipse/diamond/text/markdown/sticky modes, a drag-defined line tool, and immediate edit entry for content-first nodes**

## Performance

- **Duration:** 29 min
- **Started:** 2026-03-19T18:00:12+09:00
- **Completed:** 2026-03-19T09:29:28Z
- **Tasks:** 2
- **Files modified:** 27

## Accomplishments
- Extended the canonical shape contract so ellipse, diamond, and line variants survive parse, action-routing, and compatibility patch generation without falling back to the old generic `shape` assumptions.
- Replaced the primary create inventory with explicit rectangle, ellipse, diamond, line, text, markdown, and sticky modes across the toolbar, pane menu, and toolbar presenter.
- Added pane drag-create handling in `GraphCanvas` and immediate edit handoff in `WorkspaceClient` so content-first nodes enter text editing right after creation while geometry-first nodes stay selected.

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend contracts and tests for the minimal Phase 1 shape set** - `13cef6a` (feat)
2. **Task 2: Implement toolbar, pane, and compatibility-path creation flows for the minimal shape set** - `819e0e3` (feat)

**Plan metadata:** Pending docs reconciliation commit for summary/state/roadmap updates in this execution pass.

## Files Created/Modified
- `.planning/phases/01-canvas-core-authoring/01-03-SUMMARY.md` - Records the completed minimal shape-set plan and verification trail
- `app/components/GraphCanvas.tsx` - Adds one-shot drag-create handling, line click suppression, and preview overlays for the new primary create modes
- `app/components/editor/WorkspaceClient.tsx` - Hands created text, markdown, and sticky nodes directly into the shared text-edit session after render refresh
- `app/components/nodes/ShapeNode.tsx` - Renders ellipse, diamond, and line variants on the existing `shape` node path
- `app/components/nodes/StickyNode.tsx` - Adds inline editing support so sticky creation can enter editing immediately
- `app/features/editing/createDefaults.ts` - Defines the explicit create catalog defaults and create-mode helper rules
- `app/features/editing/actionRoutingBridge/registry.ts` - Merges UI-provided create geometry into canonical `node.create` payloads
- `app/features/render/parseRenderGraph.ts` - Preserves line direction and minimal shape variants during parse
- `app/ws/filePatcher.ts` - Writes new shape variants back through `<Shape />` while preserving explicit type props
- `e2e/canvas-core-authoring.spec.ts` - Covers the minimal shape-set inventory and drag-only line tool behavior in the browser harness

## Decisions Made
- Promoted explicit primary create modes instead of overloading a single generic `shape` entry so toolbar, pane menu, and drag-create logic can stay deterministic.
- Kept the Phase 1 connector surface intentionally narrow by shipping `line` first and deferring richer arrow/attachment semantics to later plans.
- Reused the existing selection + text-edit store path for create-time editing so node renderers stay consumers of shared editing state instead of owning bespoke creation logic.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Kept browser create coverage on a stateful mocked render payload**
- **Found during:** Task 2 (Implement toolbar, pane, and compatibility-path creation flows for the minimal shape set)
- **Issue:** The live render proxy was unavailable or version-divergent during Playwright runs, which produced `RENDER_ERROR` and optimistic conflict noise before create-mode assertions could run reliably.
- **Fix:** Converted the browser coverage to a stateful mocked `/api/render` response that still exercises the minimal create inventory and drag-only line rule while leaving the actual mutation pipeline covered by unit tests.
- **Files modified:** `e2e/canvas-core-authoring.spec.ts`
- **Verification:** `bun run test:e2e --grep "canvas core authoring create: minimal shape set"`
- **Committed in:** `819e0e3`

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** The browser slice still verifies the intended create inventory and line-tool rule without depending on an unstable render proxy. No product scope was added.

## Issues Encountered
- The browser harness could not rely on the live render proxy for this plan, so end-to-end create assertions had to avoid the proxy dependency while keeping the creation surface covered.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `01-04` can now build contextual actions, pane/node menus, and keyboard shortcuts on top of a stable primary create catalog instead of the old generic shape entry.
- The minimal line tool intentionally stops at size + direction; richer connector semantics and attachment behavior remain deferred.

## Self-Check: PASSED

---
*Phase: 01-canvas-core-authoring*
*Completed: 2026-03-19*
