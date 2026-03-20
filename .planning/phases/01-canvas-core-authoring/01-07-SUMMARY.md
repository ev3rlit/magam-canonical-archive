---
phase: 01-canvas-core-authoring
plan: 07
subsystem: api
tags: [documents, workspace-entry, websocket, source-version, vitest]
requires:
  - phase: 01-01
    provides: canvas-first workspace entry, tab routing, and untitled document affordances
  - phase: 01-03
    provides: first-create shape mutations through the shared node.create RPC path
provides:
  - server-backed creation of empty `.graph.tsx` documents with a real sha256 sourceVersion
  - immediate untitled document hydration in WorkspaceClient without relying on a client-only draft placeholder
  - mutation contract hardening that rejects `draft:*` base versions before node edits reach the WS pipeline
affects: [WorkspaceClient, useFileSync, http-server, ws-methods, file-tree]
tech-stack:
  added: []
  patterns:
    - new documents are materialized by the HTTP workspace server before the client opens the tab
    - client mutations only proceed when a file has a real sha256 sourceVersion instead of a draft placeholder
key-files:
  created:
    - .planning/phases/01-canvas-core-authoring/01-07-SUMMARY.md
  modified:
    - app/app/api/files/route.ts
    - app/components/editor/WorkspaceClient.test.tsx
    - app/components/editor/WorkspaceClient.tsx
    - app/hooks/useFileSync.ts
    - app/ws/methods.test.ts
    - libs/cli/src/server/http.spec.ts
    - libs/cli/src/server/http.ts
key-decisions:
  - "Create untitled documents through a server-backed POST /files contract so the first edit sees a real file and sha256 sourceVersion instead of a client-only draft placeholder"
  - "Hydrate the new tab immediately with an empty canvas and the returned sourceVersion, then refresh files and file-tree in the background to keep the no-modal canvas-first UX"
  - "Treat draft-prefixed sourceVersions as invalid mutation bases in useFileSync so stale placeholder tabs cannot re-enter the WS edit path"
patterns-established:
  - "Document creation contract: the workspace HTTP server owns file materialization and returns the filePath plus sourceVersion the client should seed before render"
  - "Mutation gate pattern: useFileSync rejects placeholder base versions locally rather than letting node.create fail later with an ENOENT from the WS patch layer"
requirements-completed: []
duration: 10m
completed: 2026-03-20
---

# Phase 01: 01-07 Summary

**Untitled canvas documents now materialize as real `.graph.tsx` files with immediate empty-canvas hydration and a real sha256 sourceVersion before the first shape mutation runs**

## Performance

- **Duration:** 10m
- **Started:** 2026-03-20T09:08:12+09:00
- **Completed:** 2026-03-20T09:18:32+09:00
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Added a server-backed `POST /files` contract in the workspace HTTP server and Next proxy so creating a new untitled document writes a real empty graph file and returns its sha256 sourceVersion.
- Switched `WorkspaceClient` to use that contract, hydrate the newly opened tab as an empty canvas immediately, and refresh file list or tree in the background instead of registering a fake client-only draft path.
- Hardened `useFileSync` so `draft:*` placeholders are no longer accepted as mutation base versions, and covered the fresh-document `node.create` path with client and RPC regression tests.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add regression coverage for fresh untitled document materialization and first create mutation** - `4a4b9ec` (fix)
2. **Task 2: Materialize untitled documents before edit RPCs and align the version contract** - `61c5c18` (fix)

**Plan metadata:** Summary, state, and roadmap reconciliation are committed with this execution pass.

## Files Created/Modified
- `.planning/phases/01-canvas-core-authoring/01-07-SUMMARY.md` - Records the untitled-document materialization fix, verification, and contract decisions.
- `app/app/api/files/route.ts` - Proxies document-creation requests from the app shell to the workspace HTTP server.
- `app/components/editor/WorkspaceClient.test.tsx` - Covers the create-document response contract and rejects draft placeholder versions.
- `app/components/editor/WorkspaceClient.tsx` - Creates real untitled documents through `/api/files`, seeds the returned sourceVersion, and opens an immediate empty canvas.
- `app/hooks/useFileSync.ts` - Rejects client-only draft source versions before mutations can enter the RPC pipeline.
- `app/ws/methods.test.ts` - Verifies `node.create` succeeds against a freshly materialized blank `.graph.tsx` document via the normal relative file contract.
- `libs/cli/src/server/http.spec.ts` - Covers the new `POST /files` server behavior and fixes the fs mocks for Vitest hoisting.
- `libs/cli/src/server/http.ts` - Implements the empty-document creation endpoint and returns the created file's sourceVersion.

## Decisions Made
- Kept document creation as a narrow HTTP server contract instead of teaching `node.create` to create missing files implicitly, because the file should exist before the editing pipeline begins and the sourceVersion needs to be explicit.
- Preserved the Phase 01 no-modal create flow by hydrating a blank canvas immediately from the creation response rather than waiting for a render roundtrip before switching tabs.
- Added a local mutation guard in `useFileSync` for `draft:*` versions so stale placeholder state fails fast at the client boundary instead of surfacing as a lower-level ENOENT from the WS patcher.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Vitest fs mocks had to move to `vi.hoisted` for the new HTTP server spec to execute**
- **Found during:** Task 1 (Add regression coverage for fresh untitled document materialization and first create mutation)
- **Issue:** `libs/cli/src/server/http.spec.ts` used hoisted `vi.mock` factories with plain top-level mock constants, which caused the suite to fail before the new `POST /files` assertions could even run.
- **Fix:** Moved the shared HTTP server mocks into a `vi.hoisted` block so the file-system and chat mocks are initialized before Vitest hoists the module factories.
- **Files modified:** `libs/cli/src/server/http.spec.ts`
- **Verification:** `bun x vitest run libs/cli/src/server/http.spec.ts -t "POST /files"`
- **Committed in:** `4a4b9ec`

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** The fix was required only to run the new server coverage under the current Vitest runtime. No production scope creep.

## Issues Encountered
- The full `bun x vitest run libs/cli/src/server/http.spec.ts` suite still shows unrelated `ECONNRESET` failures later in the chat session tests. The new `POST /files` coverage passes in isolation, and the document-creation path itself is fully verified.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Fresh untitled documents now enter the same real-file mutation path as existing workspace files, so the Phase 01 blocker reported in UAT test 3 is addressed.
- Phase 01 still has the remaining 01-08 selection and grouping gap closure work plus post-execution verification before the phase can be completed.

## Self-Check: PASSED

---
*Phase: 01-canvas-core-authoring*
*Completed: 2026-03-20*
