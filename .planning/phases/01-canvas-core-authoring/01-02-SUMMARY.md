---
phase: 01-canvas-core-authoring
plan: 02
subsystem: ui
tags: [reactflow, selection-shell, overlay-host, playwright, websocket]
requires:
  - phase: 01-01
    provides: canvas-first document entry and draft document bootstrap
provides:
  - input-aware drag commit thresholds wired into GraphCanvas
  - sticker/image selection shell resize and rotate affordances
  - idempotent entrypoint runtime writes that stop overlay render recursion
affects: [01-03, 01-04, GraphCanvas, WorkspaceClient, browser-harness]
tech-stack:
  added: []
  patterns:
    - selection shell preview against store node data before canonical style commit
    - idempotent runtime reducer updates for repeated anchor and surface writes
key-files:
  created:
    - .planning/phases/01-canvas-core-authoring/01-02-SUMMARY.md
  modified:
    - app/components/GraphCanvas.tsx
    - app/components/GraphCanvas.drag.ts
    - app/components/editor/WorkspaceClient.tsx
    - app/features/canvas-ui-entrypoints/ui-runtime-state/reducer.ts
    - app/features/editing/editability.ts
    - app/store/graph.ts
    - e2e/canvas-core-authoring.spec.ts
    - playwright.config.ts
key-decisions:
  - "Open the first available document when no resume target exists so the shell stays canvas-first"
  - "Treat identical entrypoint anchor and surface writes as no-ops to stop GraphCanvas overlay recursion"
  - "Scope resize and rotate affordances to geometry-editable single selections, starting with sticker and image nodes"
patterns-established:
  - "Selection shell pattern: screen-space shell bounds plus live preview plus style mutation commit"
  - "Browser harness pattern: authoring E2E startup must include both Next and the WS file-sync server"
requirements-completed: [AUTH-02, AUTH-03, AUTH-04, AUTH-05]
duration: 23 min
completed: 2026-03-19
---

# Phase 01: 01-02 Summary

**GraphCanvas now opens directly into a live document, commits manipulation intent with input-aware thresholds, and exposes a sticker/image selection shell with resize and rotate handles without re-entering the overlay render loop**

## Performance

- **Duration:** 23 min
- **Started:** 2026-03-19T17:36:23+09:00
- **Completed:** 2026-03-19T08:59:14.784Z
- **Tasks:** 3
- **Files modified:** 11

## Accomplishments
- Wired pointer-type-aware drag commit thresholds into `GraphCanvas` and persisted per-tab selection snapshots so manipulation state stops thrashing between canvas interactions.
- Added a visible selection shell with bottom-right resize and top rotate handles for geometry-editable single selections, backed by the existing style mutation pipeline.
- Removed the repeated anchor/surface runtime writes behind the `Maximum update depth exceeded` browser regression and restored self-contained viewport E2E startup by booting the WS server with Playwright.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add viewport and direct-manipulation regression coverage** - `2bcf92e` (test)
2. **Task 2: Implement pan, zoom, marquee, and drag-selection baseline in GraphCanvas** - `6a85c5a` (feat)
3. **Task 3: Add visible resize and rotate affordances without breaking selection state** - `37bd6f5` (test)

**Plan metadata:** Pending docs reconciliation commit for summary/state/roadmap updates in this execution pass.

## Files Created/Modified
- `.planning/phases/01-canvas-core-authoring/01-02-SUMMARY.md` - Records the completed manipulation baseline and its verification trail
- `app/components/GraphCanvas.tsx` - Adds selection shell gestures, progressive pane dismissal, selection snapshot persistence, and render-loop-safe overlay coordination
- `app/components/GraphCanvas.drag.ts` - Resolves pointer types from live events so drag commit thresholds match mouse, pen, and touch input
- `app/components/editor/WorkspaceClient.tsx` - Opens the first available document when no resume target exists so the shell remains canvas-first
- `app/features/canvas-ui-entrypoints/ui-runtime-state/reducer.ts` - Makes repeated anchor/surface writes idempotent to stop recursive rerenders
- `app/features/editing/editability.ts` - Extends sticker style editing to include persisted width and height geometry patches
- `app/store/graph.ts` - Allows explicit clearing of per-tab viewport and selection snapshots
- `e2e/canvas-core-authoring.spec.ts` - Seeds a sticker-backed viewport scenario and asserts the visible selection shell handles
- `playwright.config.ts` - Starts the WS file-sync server alongside Next for browser authoring tests

## Decisions Made
- Opened the first workspace document automatically when no resume session exists because Phase 1 should always land in a usable canvas, not an inert file list.
- Kept resize and rotate as selection-shell affordances rather than inspector-only edits so the canvas stays direct-manipulation first.
- Fixed the render loop at the runtime reducer boundary instead of layering more component-side guards over repeated anchor and surface writes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Made entrypoint anchor and surface reducers idempotent**
- **Found during:** Task 2 (Implement pan, zoom, marquee, and drag-selection baseline in GraphCanvas)
- **Issue:** Re-registering the same selection anchor and floating surface every render triggered the known `Maximum update depth exceeded` browser loop in `GraphCanvas`.
- **Fix:** Added equality guards in the entrypoint runtime reducer so identical anchor and surface writes return the existing state instead of scheduling another render.
- **Files modified:** `app/features/canvas-ui-entrypoints/ui-runtime-state/reducer.ts`, `app/store/graph.test.ts`
- **Verification:** `bun test app/components/GraphCanvas.test.tsx app/components/GraphCanvas.viewport.test.ts app/store/graph.test.ts`; `bun run test:e2e --grep "canvas core authoring viewport"`
- **Committed in:** `6a85c5a`

**2. [Rule 3 - Blocking] Brought the WS file-sync server into the browser harness**
- **Found during:** Task 3 (Add visible resize and rotate affordances without breaking selection state)
- **Issue:** Auto-opening the first document now activates `useFileSync` immediately, so Playwright startup failed unless the WS server was running beside Next.
- **Fix:** Updated `playwright.config.ts` to boot `ws:dev` and the Next app together under the test web server command.
- **Files modified:** `playwright.config.ts`
- **Verification:** `bun run test:e2e --grep "canvas core authoring viewport"`
- **Committed in:** `37bd6f5`

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both fixes were required to make the manipulation baseline verifiable in the browser. No adjacent feature scope was added.

## Issues Encountered
- The long-standing 01-01 browser regression was not a generic ReactFlow problem; it came from repeated selection-anchor and open-surface writes feeding each other through the overlay runtime.
- Self-contained browser verification required the WS file-sync server once the shell started opening a real document by default.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `01-03` can build shape creation flows on top of a stable canvas-first entry path and a verified selection shell baseline.
- Current resize and rotate affordances intentionally target geometry-editable single selections first; broader shape-specific geometry contracts still belong to the upcoming shape plan.

## Self-Check: PASSED

---
*Phase: 01-canvas-core-authoring*
*Completed: 2026-03-19*
