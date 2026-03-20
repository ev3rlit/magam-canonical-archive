---
phase: 01-canvas-core-authoring
plan: 08
subsystem: canvas
tags: [selection, grouping, overlay, e2e, playwright]
requires:
  - phase: 01-04
    provides: contextual selection surfaces, node context menu wiring, and shortcut entrypoints
  - phase: 01-05
    provides: structural grouping mutations and group-focus interaction rules
provides:
  - viewport-transformed selection anchors shared by the selection shell and floating controls
  - post-group runtime selection handoff that keeps a fresh group structurally selected for immediate group focus
  - browser fixtures that keep mocked render output synchronized with the on-disk TSX file and sourceVersion contract
affects: [GraphCanvas, action-routing-bridge, node-context-menu, e2e]
tech-stack:
  added: []
  patterns:
    - selection overlays and the selection shell now reuse one screen-bounds calculation instead of parallel coordinate math
    - fresh grouping completes with an explicit select-node-group runtime handoff so the next interaction starts from full-group selection
    - mutable browser fixtures write the same graph to disk that they expose through mocked render responses to avoid false WS version conflicts
key-files:
  created:
    - .planning/phases/01-canvas-core-authoring/01-08-SUMMARY.md
  modified:
    - app/components/GraphCanvas.tsx
    - app/components/GraphCanvas.test.tsx
    - app/features/editing/actionRoutingBridge/registry.ts
    - app/features/editing/actionRoutingBridge/registry.test.ts
    - e2e/canvas-core-authoring.spec.ts
key-decisions:
  - "Selection-floating-menu anchors now reuse the same viewport-transformed bounds as the selection shell so the overlay host and shell cannot drift apart"
  - "selection.group ends with the existing select-node-group runtime action instead of adding a second selection model for grouped sets"
  - "The browser harness writes fixture graphs to the backing .graph.tsx file and derives the mocked sourceVersion from that exact source so structural mutations test the real file contract"
patterns-established:
  - "Selection anchor contract: any selection-bounds overlay must consume the same screen-space bounds the shell renders from"
  - "Fresh grouping contract: structural group mutations restore full-group selection before group-focus entry is offered"
  - "Mutable E2E fixture contract: mocked render responses must stay in lockstep with the backing file contents and sourceVersion"
requirements-completed: []
duration: 24m
completed: 2026-03-20
---

# Phase 01: 01-08 Summary

**Floating selection controls now stay attached to the selection shell, and fresh grouping keeps the full group selected so group focus is available immediately**

## Performance

- **Duration:** 24m
- **Started:** 2026-03-20T09:10:00+09:00
- **Completed:** 2026-03-20T09:34:43+09:00
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Reused shared screen-bounds math in `GraphCanvas` so the floating selection controls register viewport-transformed coordinates instead of raw flow-space bounds.
- Extended `selection.group` to append a `select-node-group` runtime step after membership mutations so a freshly grouped set stays structurally selected for group-focus entry.
- Hardened the browser structure test harness so the mocked render graph, on-disk `.graph.tsx` fixture, and returned `sourceVersion` all describe the same document before structural mutations run.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add regression coverage for anchor-space correctness and fresh-group selection continuity** - `47d3aac` (test)
2. **Task 2: Correct selection anchor coordinates and preserve structural selection after grouping** - `dd7409c` (fix)

**Plan metadata:** Summary, state, and roadmap reconciliation are committed with this execution pass.

## Files Created/Modified
- `.planning/phases/01-canvas-core-authoring/01-08-SUMMARY.md` - Records the selection-anchor and fresh-group continuity fix, verification, and harness notes.
- `app/components/GraphCanvas.tsx` - Shares screen-bounds math between the selection shell and overlay anchor registration.
- `app/components/GraphCanvas.test.tsx` - Locks the selection anchor into screen-space coordinates and preserves group-focus entry expectations.
- `app/features/editing/actionRoutingBridge/registry.ts` - Appends a `select-node-group` runtime handoff after `selection.group` mutations.
- `app/features/editing/actionRoutingBridge/registry.test.ts` - Covers the new post-group runtime handoff.
- `e2e/canvas-core-authoring.spec.ts` - Exercises fresh grouping through the browser while keeping the mocked render graph aligned with the real fixture file contract.

## Decisions Made
- Kept overlay anchoring and shell geometry on one shared helper instead of patching the overlay host, because the bug was a producer-side coordinate mismatch.
- Reused the existing `select-node-group` runtime action after grouping so the group-selection behavior stays single-sourced in `WorkspaceClient`.
- Fixed the Playwright harness at the file-contract boundary rather than adding waits or retries, because the observed `VERSION_CONFLICT` came from a mismatched fixture, not from runtime instability.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The browser harness returned a fake render graph and fake sourceVersion for a file whose on-disk TSX was still empty**
- **Found during:** Task 2 (Correct selection anchor coordinates and preserve structural selection after grouping)
- **Issue:** Fast structural mutations in Playwright hit `VERSION_CONFLICT` before the actual selection regression could be verified because the mocked `/api/render` payload did not match the backing `.graph.tsx` file or its sha256 version.
- **Fix:** Added a fixture serializer that writes the current test graph to disk and derives the mocked `sourceVersion` from that exact source before the browser reloads.
- **Files modified:** `e2e/canvas-core-authoring.spec.ts`
- **Verification:** `MAGAM_WS_PORT=3012 NEXT_PUBLIC_MAGAM_WS_PORT=3012 bun run test:e2e --grep "canvas core authoring structure: group ungroup z-order"`
- **Committed in:** `dd7409c`

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** The fix keeps the browser gate truthful to the real file-mutation contract. No production scope drift.

## Issues Encountered
- Local port `3001` was already occupied by an existing workspace edit server, so the Playwright verification run used `MAGAM_WS_PORT=3012` and `NEXT_PUBLIC_MAGAM_WS_PORT=3012` to isolate the wave-7 browser check.

## User Setup Required

None.

## Next Phase Readiness
- The two remaining Phase 01 UAT gaps are now addressed in code and regression coverage.
- Phase 01 can move directly into verifier rerun and completion routing.

## Self-Check: PASSED

---
*Phase: 01-canvas-core-authoring*
*Completed: 2026-03-20*
