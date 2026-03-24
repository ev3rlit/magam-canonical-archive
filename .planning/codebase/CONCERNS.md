# Codebase Concerns

**Analysis Date:** 2026-03-19

## Confidence Guide

- `Confirmed`: Directly supported by current code, tests, or committed reports.
- `Suspected`: Strong inference from current structure, but needs targeted reproduction or a deployment-context check.

## Tech Debt

### Confirmed

**File-first editing path and canonical DB path are both active:**
- Files: `app/ws/filePatcher.ts`, `app/ws/methods.ts`, `app/hooks/useFileSync.ts`, `app/features/render/parseRenderGraph.ts`, `libs/shared/src/lib/canonical-persistence/repository.ts`, `libs/shared/src/lib/canonical-persistence/pglite-db.ts`, `libs/cli/README.md`, `docs/reports/magam-completion-architecture-roadmap/README.md`
- Issue: The UI still edits TSX source files through the WS + AST patch path, while the repository also carries a growing canonical persistence stack with its own mutation/query model.
- Why: The repository is in an explicit transition phase; `libs/cli/README.md` says legacy render/dev and database-first headless surfaces coexist, and the roadmap says legacy TSX should become a compatibility path.
- Impact: New features can land in only one authority path, forcing duplicate validation, mutation semantics, and recovery logic. Future planning agents must decide per task whether the source of truth is TSX, canonical DB, or both.
- Fix approach: Pick one authoritative write path per feature area, document it in the feature slice, and keep the other path adapter-only. Do not add new domain behavior to both TSX patching and canonical persistence unless convergence is part of the task.

**Schema bootstrapping hides migration asset drift:**
- Files: `libs/cli/src/chat/repository/db.ts`, `libs/shared/src/lib/canonical-persistence/pglite-db.ts`
- Issue: Chat storage catches migration failures and creates tables inline, while canonical persistence patches missing plugin tables at runtime even after `migrate()`.
- Why: The code is tolerating environments where migration assets are missing or migration metadata lags the SQL files.
- Impact: Startup can appear healthy while schema/index state differs across environments. That makes failures late, data-shape specific, and hard to reproduce.
- Fix approach: Make migration assets a hard packaging contract, fail closed when they are missing, and reserve repair/bootstrap logic for explicit maintenance commands.

### Suspected

**Generated artifacts in the workspace can mislead source-oriented work:**
- Files: `libs/cli/dist/index.js`, `libs/cli/dist/bin.js`, `libs/shared/dist/index.js`, `app/.next/types/app/api/render/route.ts`
- Issue: Built outputs and generated type artifacts sit next to source code inside the repo tree.
- Why: The repository currently keeps distributable and generated files available during active development.
- Impact: Search-driven work can accidentally read or patch generated files, and stale artifacts can obscure whether a behavior belongs to source or build output.
- Fix approach: Keep planning/execution agents focused on source roots, or move generated artifacts behind clearer ignore or publish-only boundaries.

## Known Bugs

### Confirmed

**Plugin instance state is not durable across reload/restart:**
- Files: `app/ws/methods.ts`, `app/features/render/parseRenderGraph.ts`, `app/components/nodes/PluginNode.tsx`, `libs/shared/src/lib/canonical-persistence/repository.ts`, `docs/features/database-first-canvas-platform/plugin-runtime-v1/README.md`
- Symptoms: Plugin instance props/binding updates can disappear after a page reload or server restart, and cross-client consistency is undefined.
- Trigger: Use `plugin-instance.create`, `plugin-instance.update-props`, or `plugin-instance.update-binding`, then reload the workspace or restart the WS server.
- Workaround: Keep plugin metadata authored in TSX/canonical rows instead of relying on the in-memory WS runtime map.
- Root cause: `app/ws/methods.ts` stores plugin instances in `pluginInstancesByFile`, an in-memory `Map`, while `app/features/render/parseRenderGraph.ts` hydrates plugin nodes from render-source props and the canonical repository in `libs/shared/src/lib/canonical-persistence/repository.ts` is not wired into that WS flow.
- Blocked by: Choosing a single persistence authority for plugin instances.

**Concurrent same-file mutations can interleave when the server mutex is not enabled:**
- Files: `app/ws/methods.ts`, `app/ws/methods.mutex.test.ts`, `app/hooks/useFileSync.shared.ts`
- Symptoms: Two same-file edits can both start, producing avoidable version conflicts or last-write-wins behavior under load.
- Trigger: Run overlapping mutations against the same file while `MAGAM_WS_ENABLE_FILE_MUTEX` is unset or `0`.
- Workaround: Set `MAGAM_WS_ENABLE_FILE_MUTEX=1` anywhere automation or concurrent clients can touch the same file.
- Root cause: `runWithOptionalFileMutex()` is opt-in, and `app/ws/methods.mutex.test.ts` explicitly verifies that same-file work starts in parallel when the mutex is off.

## Security Considerations

### Confirmed

**WS edit methods can escape the workspace root:**
- Files: `app/ws/server.ts`, `app/ws/methods.ts`, `app/ws/filePatcher.ts`
- Risk: Any reachable WS client can request mutations against arbitrary filesystem paths by sending an absolute path or a relative path containing `..`.
- Current mitigation: JSON-RPC shape validation, `baseVersion` checks, and per-method validation of node payloads.
- Recommendations: Reject absolute paths, normalize and verify every resolved file path stays under `MAGAM_TARGET_DIR`, and bind/authenticate the WS server before allowing non-local clients.

**HTTP render/chat/files server is unauthenticated, open on a raw port, and trusts out-of-root file paths:**
- Files: `libs/cli/src/server/http.ts`, `libs/cli/src/bin.ts`, `app/app/api/render/route.ts`, `app/app/api/file-tree/route.ts`, `app/app/api/files/route.ts`
- Risk: The HTTP server listens without a host restriction, allows `Access-Control-Allow-Origin: *`, exposes chat/file endpoints, and `resolveWorkspaceFilePath()` can return paths outside `targetDir` if they exist.
- Current mitigation: The main app proxies to `localhost`, and the tooling appears intended for local use.
- Recommendations: Bind `127.0.0.1` by default, require an auth token if remote access is ever allowed, validate `filePath` stays inside `targetDir`, and stop returning raw stack traces in JSON error bodies.

### Suspected

**Uploaded SVG files may create a same-origin script surface:**
- Files: `app/app/api/assets/upload/route.ts`, `app/app/api/assets/file/route.ts`
- Risk: Untrusted SVG uploads are accepted and later served back as `image/svg+xml` from the app origin.
- Current mitigation: Extension, MIME, size, and signature checks; the asset read route does enforce workspace-relative paths and has path traversal tests.
- Recommendations: If uploads are untrusted, disallow SVG entirely or sanitize it and serve it from an isolated asset origin or with stronger response headers such as `Content-Disposition` and `X-Content-Type-Options`.

## Performance Bottlenecks

### Confirmed

**`/api/file-tree` is still expensive through the Next proxy path:**
- Files: `docs/closed-features/compile-explorer-performance/IMPROVEMENT_REPORT_2026-03-03.md`, `libs/cli/src/server/http.ts`, `app/app/api/file-tree/route.ts`
- Problem: File-tree requests stay slow in the browser-facing path even though the direct CLI server path is fast.
- Measurement: The committed report records `GET /api/file-tree` first-load at `5.978590s`, warm-up at `5739.3ms`, and Next-proxy warm p95 at `2423.395ms`, while direct `/file-tree` warm p95 is only `3.149ms`.
- Cause: `handleFileTree()` rebuilds the tree with a fresh `glob(['**/*.tsx', '**/'])` scan on every request, and the Next route forces a no-store proxy path.
- Improvement path: Keep a watcher-backed in-memory tree on the long-lived server process, invalidate incrementally on file events, and avoid re-proxying uncached tree reads through a cold Next route when possible.

**Cold route startup remains a major latency source:**
- Files: `docs/closed-features/compile-explorer-performance/IMPROVEMENT_REPORT_2026-03-03.md`, `app/components/editor/WorkspaceClient.tsx`, `app/components/GraphCanvas.tsx`
- Problem: The main app shell still pays large cold-start costs.
- Measurement: The committed report records `GET /` first-load at `17.454931s`, warm-up at `4959.5ms`, and warm repeat at `0.668643s`.
- Cause: The report calls out route compile cost as still large. The main editing shell is concentrated in `app/components/editor/WorkspaceClient.tsx` (1635 lines) and `app/components/GraphCanvas.tsx` (1321 lines), so route compilation and hydration pressure are both high-risk suspects.
- Improvement path: Split the shell by responsibility, keep cold-path imports minimal, and add route-level instrumentation that separates compile, proxy, render, and client hydration costs.

## Fragile Areas

### Confirmed

**AST patching and render parsing form one tightly coupled edit pipeline:**
- Files: `app/ws/filePatcher.ts`, `app/ws/methods.ts`, `app/hooks/useFileSync.ts`, `app/hooks/useFileSync.shared.ts`, `app/features/render/parseRenderGraph.ts`
- Why fragile: Edits rely on whole-file Babel parse/generate, explicit RPC error codes, source-version tracking, and render-graph normalization all staying aligned.
- Common failures: Spread props or unsupported patch surfaces become `EDIT_NOT_ALLOWED`, ID collisions fail writes, same-file races surface as version conflicts, and source metadata can desync from the actual file update path.
- Safe modification: Treat the pipeline as one contract: patch -> version update -> `file.changed` -> reload -> `parseRenderGraph()`. Change error codes or payloads only with matching store/UI/test updates.
- Test coverage: Good unit coverage exists in `app/ws/filePatcher.test.ts`, `app/ws/methods.test.ts`, `app/hooks/useFileSync.test.ts`, and `app/features/render/parseRenderGraph.test.ts`, but there is no equivalent boundary/security coverage for out-of-root paths.

**The main workspace shell is concentrated in a few very large orchestrator files:**
- Files: `app/components/editor/WorkspaceClient.tsx`, `app/components/GraphCanvas.tsx`, `app/store/graph.ts`
- Why fragile: `WorkspaceClient.tsx` owns file loading, tabs, edit routing, chat/panel state, and refresh triggers; `GraphCanvas.tsx` owns ReactFlow wiring, overlays, layout, keyboard host, export, and plugin runtime composition.
- Common failures: Selection state, tab dirty state, pending text edits, version-conflict refreshes, overlay placement, and layout triggers can regress together because the ownership boundary is broad.
- Safe modification: Change one subsystem at a time and verify it through the narrowest affected surface before touching shared state in `app/store/graph.ts`.
- Test coverage: `app/components/editor/WorkspaceClient.test.tsx`, `app/components/GraphCanvas.test.tsx`, `app/components/GraphCanvas.viewport.test.ts`, `e2e/chat-session-management.spec.ts`, and `e2e/tabs.spec.ts` help, but they do not cover the full editing lifecycle across assets, plugins, and multi-file mutations.

**Plugin runtime wiring is broad and under-tested:**
- Files: `app/features/plugin-runtime/iframeHost.ts`, `app/features/plugin-runtime/capabilityGate.ts`, `app/features/plugin-runtime/instanceHydration.ts`, `app/components/nodes/PluginNode.tsx`
- Why fragile: Runtime behavior spans iframe sandboxing, postMessage bridge validation, capability checks, registry lookup, hydration, and ReactFlow node state updates.
- Common failures: Missing or stale plugin metadata produces fallback states, bridge requests can drift from declared capabilities, and reload/state recovery bugs are easy to miss.
- Safe modification: Start from the smoke harness in `app/features/plugin-runtime/smoke.ts`, add direct unit tests for bridge/capability paths, and only then change UI integration in `app/components/nodes/PluginNode.tsx`.
- Test coverage: No direct `*.test.*` files were detected under `app/features/plugin-runtime/`.

## Scaling Limits

### Confirmed

**Workspace scanning scales linearly with the number of TSX files and directories:**
- Files: `libs/cli/src/server/http.ts`, `app/app/api/file-tree/route.ts`, `docs/closed-features/compile-explorer-performance/IMPROVEMENT_REPORT_2026-03-03.md`
- Current capacity: With the current repository size, direct `/file-tree` is fast, but the browser-facing proxy path already shows `2423.395ms` warm p95 and `5.978590s` first-load latency.
- Limit: Every file-tree request re-scans the target workspace, so larger workspaces or slower disks will push sidebar/file browser latency up quickly.
- Symptoms at limit: Slow first paint, blocked file browser interactions, and warm-up time that grows with workspace size.
- Scaling path: Replace request-time globbing with a persistent index updated from file-watch events.

**The file-based mutation model is effectively single-writer and whole-file:**
- Files: `app/ws/methods.ts`, `app/ws/filePatcher.ts`, `app/hooks/useFileSync.shared.ts`
- Current capacity: Same-file edits work best when one client or one automation flow owns the file at a time.
- Limit: Concurrency increases version conflicts and overwrite risk because the system reparses and rewrites the entire file for each mutation.
- Symptoms at limit: Conflict spikes, user-visible reloads, and lost work under concurrent edits or agent automation.
- Scaling path: Make per-file serialization mandatory on the server or move the write path to canonical mutations with finer-grained conflict semantics.

## Dependencies at Risk

### Confirmed

**Drizzle migration runtime coupling is brittle in packaged environments:**
- Files: `libs/cli/src/chat/repository/db.ts`, `libs/shared/src/lib/canonical-persistence/pglite-db.ts`
- Risk: The runtime currently assumes migration folders may be missing or lagging and compensates with inline schema creation/bootstrap logic.
- Impact: Packaging/build changes can silently change database shape instead of failing fast, which makes deploy/runtime diagnosis harder.
- Migration plan: Make migration assets explicit build artifacts, verify them at startup, and remove fallback DDL paths once packaging is stable.

### Suspected

**The Babel-based TSX patch stack may become a feature drag as source syntax expands:**
- Files: `app/ws/filePatcher.ts`, `package.json`
- Risk: The edit path depends on `@babel/parser`, `@babel/traverse`, and `@babel/generator` handling every author-authored TSX shape the workspace adopts.
- Impact: New syntax forms can fail at edit time even when render/build still works.
- Migration plan: Add parser support-matrix tests for real workspace syntax, or reduce the live edit surface that depends on AST rewriting.

## Missing Critical Features

### Confirmed

**Reload-stable plugin-instance persistence is not complete in the app-facing runtime:**
- Files: `app/ws/methods.ts`, `app/features/render/parseRenderGraph.ts`, `libs/shared/src/lib/canonical-persistence/repository.ts`, `docs/features/database-first-canvas-platform/plugin-runtime-v1/README.md`
- Problem: The repository already defines plugin-instance contracts and canonical persistence, but the live app-side runtime path does not use them as the authoritative store.
- Current workaround: Keep plugin instance state authored directly in source/canonical data instead of relying on the current WS runtime map.
- Blocks: Reliable plugin editing, cross-session recovery, CLI/MCP parity for plugin-instance commands, and future planning that assumes plugin instances behave like durable domain objects.
- Implementation complexity: High; it requires converging render, query, and mutation paths onto one persistence model.

## Test Coverage Gaps

### Confirmed

**Security boundary tests are missing for the raw WS and HTTP file-resolution layers:**
- Files: `app/ws/methods.ts`, `app/ws/methods.test.ts`, `libs/cli/src/server/http.ts`, `libs/cli/src/server/http.spec.ts`
- What's not tested: Rejection of absolute paths and `..` traversal in the WS mutation path and the HTTP render path.
- Risk: Filesystem escape vulnerabilities can persist unnoticed while safer routes such as `app/app/api/assets/file/route.ts` and `libs/cli/src/mcp/utils.ts` create the impression that path validation is consistent everywhere.
- Priority: High
- Difficulty to test: Moderate; both paths already have temp-dir/mocked-server test harnesses.

**Plugin runtime lacks direct automated coverage:**
- Files: `app/features/plugin-runtime/iframeHost.ts`, `app/features/plugin-runtime/capabilityGate.ts`, `app/features/plugin-runtime/instanceHydration.ts`, `app/components/nodes/PluginNode.tsx`
- What's not tested: postMessage bridge handling, capability denial behavior, hydration failure modes, and ReactFlow node integration for plugin state.
- Risk: Capability leaks, persistence regressions, and runtime crash handling bugs can land without immediate signal.
- Priority: High
- Difficulty to test: Moderate; `app/features/plugin-runtime/smoke.ts` provides a starting harness, but iframe and ReactFlow integration still need dedicated tests.

**Cross-surface editing flows are only lightly covered end-to-end:**
- Files: `e2e/chat-session-management.spec.ts`, `e2e/tabs.spec.ts`, `app/components/editor/WorkspaceClient.tsx`, `app/components/GraphCanvas.tsx`, `app/app/api/assets/upload/route.ts`, `app/features/plugin-runtime/iframeHost.ts`
- What's not tested: The full loop from proxy render -> WS mutation -> file changed -> graph reparse for assets, plugins, and multi-file editing.
- Risk: Integration regressions survive unit tests because the seam between server, store, and canvas shell is wider than the current Playwright coverage.
- Priority: Medium
- Difficulty to test: High; these flows need stable fixture workspaces and multi-process dev orchestration.

---

*Concerns audit: 2026-03-19*
*Update as issues are fixed or new ones discovered*
