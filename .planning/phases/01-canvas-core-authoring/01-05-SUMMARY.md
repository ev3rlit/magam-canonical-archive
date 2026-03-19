---
phase: 01-canvas-core-authoring
plan: 05
subsystem: ui
tags: [grouping, z-order, keyboard-shortcuts, reactflow, playwright]
requires:
  - phase: 01-02
    provides: direct manipulation baseline, selection shell, and semantic move or reparent seams
  - phase: 01-04
    provides: compact contextual surfaces and the shared keyboard command boundary
provides:
  - selection-level group and ungroup structural commands through the action routing bridge
  - explicit group-focus state with desktop double-click entry and progressive escape unwind
  - basic bring-to-front and send-to-back actions for grouped and multi-selected canvas nodes
affects: [01-06, GraphCanvas, WorkspaceClient, filePatcher, node-context-menu]
tech-stack:
  added: []
  patterns:
    - selection structural actions decompose into runtime preview patches plus per-node canonical mutation steps
    - group focus stays store-owned while GraphCanvas owns desktop entry, explicit menu entry, and dismiss-order behavior
key-files:
  created:
    - .planning/phases/01-canvas-core-authoring/01-05-SUMMARY.md
  modified:
    - app/components/GraphCanvas.tsx
    - app/components/editor/WorkspaceClient.tsx
    - app/features/canvas-ui-entrypoints/node-context-menu/buildNodeContextMenuModel.ts
    - app/features/editing/actionRoutingBridge/registry.ts
    - app/features/editing/commands.ts
    - app/store/graph.ts
    - app/processes/canvas-runtime/keyboard/keymap.ts
    - app/features/render/parseRenderGraph.ts
    - app/ws/filePatcher.ts
    - e2e/canvas-core-authoring.spec.ts
key-decisions:
  - "Represent Phase 1 grouping as explicit groupId-backed structural metadata instead of introducing a new persisted group container before the markdown body phase"
  - "Keep inner-group focus in the graph store so Escape, pane click, and explicit enter-group actions all unwind through one shared state machine"
  - "Route group, ungroup, and z-order through the action bridge as per-node structural mutation steps while using runtime preview patches for immediate feedback"
patterns-established:
  - "Structural intent pattern: selection-level actions normalize against the current selection and emit ordered per-node mutation steps rather than bypassing the bridge with array mutation"
  - "Harness pattern: structural browser coverage can rely on pre-grouped mocked render fixtures when persisted WS mutations conflict with the mocked render source of truth"
requirements-completed: [AUTH-03, AUTH-04, AUTH-06, AUTH-07]
duration: 43 min
completed: 2026-03-19
---

# Phase 01: 01-05 Summary

**Group, ungroup, group-focus entry, escape unwind, and basic z-order now run through the existing structural command path instead of living as selection-only shell state**

## Performance

- **Duration:** 43 min
- **Started:** 2026-03-19T09:51:59Z
- **Completed:** 2026-03-19T10:34:39Z
- **Tasks:** 3
- **Files modified:** 39

## Accomplishments
- Added explicit structural command contracts and dispatch descriptors for group membership and z-order updates, then routed them through `WorkspaceClient`, `useFileSync`, `ws/methods`, and `filePatcher` without inventing a parallel mutation subsystem.
- Introduced store-owned group focus and GraphCanvas entry or unwind behavior so grouped selections can be expanded, entered, exited, and reselected predictably from desktop interaction and explicit node-menu actions.
- Extended the node context menu and keyboard boundary with group, ungroup, bring-to-front, send-to-back, and `Cmd/Ctrl+G` or `Shift+Cmd/Ctrl+G`, then covered the structural loop in unit tests and a browser harness.

## Task Commits

Implementation landed in one atomic feature commit plus this docs reconciliation pass:

1. **Structural grouping, z-order, group focus, and keyboard wiring** - `40291cc` (feat)

**Plan metadata:** Summary, state, and roadmap reconciliation are committed with this execution pass.

## Files Created/Modified
- `.planning/phases/01-canvas-core-authoring/01-05-SUMMARY.md` - Records the completed structural editing plan and verification trail
- `app/components/GraphCanvas.tsx` - Adds desktop group-focus entry, escape unwind handling, selection-based structural keyboard hooks, and explicit mobile-safe enter-group menu behavior
- `app/components/editor/WorkspaceClient.tsx` - Routes selection-level structural intents through the existing dispatch bridge and keeps runtime group selection synchronized with React Flow selection flags
- `app/features/canvas-ui-entrypoints/node-context-menu/buildNodeContextMenuModel.ts` - Exposes group, ungroup, enter-group, and basic z-order actions only when the structural context supports them
- `app/features/editing/actionRoutingBridge/registry.ts` - Normalizes group, ungroup, and z-order intents into ordered runtime preview plus canonical mutation steps
- `app/features/editing/commands.ts` - Defines explicit group-membership and z-order command payloads for history replay and bridge execution
- `app/store/graph.ts` - Adds active group-focus state and selection retention rules so inner-group focus survives until an explicit unwind step
- `app/processes/canvas-runtime/keyboard/keymap.ts` - Registers grouping shortcuts on the shared keyboard boundary and moves the Washi bulk-select binding off the conflicting chord
- `app/features/render/parseRenderGraph.ts` - Preserves explicit `groupId` and `zIndex` props so structural edits survive render reloads
- `app/ws/filePatcher.ts` - Accepts `groupId` and `zIndex` structural patches on the compatibility write-back path
- `e2e/canvas-core-authoring.spec.ts` - Verifies grouped structure menu visibility, explicit enter-group behavior, and escape unwind on the browser harness

## Decisions Made
- Chose a `groupId`-backed grouping model for Phase 1 so structural edits stay compatible with the current parser and file patch path without introducing a new rendered group container contract mid-phase.
- Kept selection-based structural actions in the node context menu and keyboard boundary rather than promoting them into the compact floating surface, which preserves the high-frequency or structural split established in `01-04`.
- Treated group focus as a temporary state layered on top of selection instead of a second independent selection model, which keeps escape unwind and pane dismiss behavior coherent.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Extended render parsing to preserve explicit groupId and zIndex metadata**
- **Found during:** Task 2 (Implement grouping, group focus entry or exit, and basic z-order across runtime and patch layers)
- **Issue:** The plan listed the patch and runtime files, but persisted group or z-order metadata would still disappear after reload because `parseRenderGraph` ignored explicit `groupId` and `zIndex` props on canvas nodes.
- **Fix:** Added parser support and regression coverage so structural mutations survive reload instead of living only in optimistic runtime state.
- **Files modified:** `app/features/render/parseRenderGraph.ts`, `app/features/render/parseRenderGraph.test.ts`
- **Verification:** `bun test app/features/render/parseRenderGraph.test.ts`
- **Committed in:** `40291cc`

**2. [Rule 3 - Blocking] Narrowed the structural browser harness to pre-grouped fixture coverage**
- **Found during:** Task 3 (Finish keyboard and multi-selection integration for structural editing)
- **Issue:** Group or z-order mutations executed through the live WS path conflict with the mocked `/api/render` source of truth in Playwright, producing version-conflict noise instead of a stable browser assertion surface.
- **Fix:** Reworked the Playwright slice to use pre-grouped mocked render fixtures and runtime-only selection or focus assertions while leaving persisted structural mutation coverage to unit tests.
- **Files modified:** `e2e/canvas-core-authoring.spec.ts`
- **Verification:** `bun run test:e2e --grep "canvas core authoring structure: group ungroup z-order"`
- **Committed in:** `40291cc`

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both fixes were needed to make structural behavior survive reload and to keep the browser harness deterministic. No scope creep.

## Issues Encountered
- The mocked render harness and live WS mutation path do not share one source of truth, so persisted structural browser assertions needed to stay in unit coverage while Playwright focused on runtime-visible structural behavior.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `01-06` can now build editable object content surfaces on top of stable structural selection, group-focus unwind rules, and the shared keyboard boundary.
- Phase 1 structural editing is in place, so the remaining gap is the markdown-first body entry and shell or body editing contract.

## Self-Check: PASSED

---
*Phase: 01-canvas-core-authoring*
*Completed: 2026-03-19*
