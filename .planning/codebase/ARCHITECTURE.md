# Architecture

**Analysis Date:** 2026-03-19

## Pattern Overview

**Overall:** Monorepo canvas application with a Next.js browser shell, local Bun sidecar services, a custom React-to-graph renderer, and a parallel canonical persistence/headless surface.

**Key Characteristics:**
- `app/` owns the interactive browser shell and adapts rendered graph payloads into React Flow UI.
- `libs/core/` is the lowest stable render contract: TSX diagram components plus a custom reconciler that produces graph containers.
- `app/ws/` still treats workspace `.tsx` files as the live editable source of truth, while `libs/shared/` and `libs/cli/` introduce a separate canonical PGlite-backed query and mutation surface.
- Runtime UI entrypoints are composed through contribution registries in `app/features/canvas-ui-entrypoints/*` and `app/processes/canvas-runtime/*`, not hardcoded directly into `app/components/GraphCanvas.tsx`.

## Layers

**Package Responsibility Split:**
- `app/` is browser-only orchestration, React UI, file-sync, and local mutation wiring.
- `libs/core/` defines the authoring DSL and renderer contract consumed by both browser and headless flows.
- `libs/shared/` owns cross-package domain contracts, canonical persistence, query, mutation, chat types, and plugin contracts.
- `libs/cli/` exposes executable entrypoints and local services.
- `libs/runtime/` contains lower-level transpile and execute helpers that support headless evaluation.

**Browser Route And Shell Layer:**
- Purpose: Boot the Next.js app, mount the workspace client, and expose browser-safe proxy routes.
- Location: `app/app/page.tsx`, `app/app/layout.tsx`, `app/app/api/*/route.ts`
- Contains: App Router entrypoints, global styling, API proxy routes for render, files, file tree, chat, and assets.
- Depends on: `app/components/editor/WorkspaceClient.tsx`, the local HTTP sidecar in `libs/cli/src/server/http.ts`
- Used by: Browser navigation and every client fetch issued from `app/components/editor/WorkspaceClient.tsx`

**Client Orchestration Layer:**
- Purpose: Coordinate file loading, render refresh, selection, tab state, edit history, and sync subscriptions.
- Location: `app/components/editor/WorkspaceClient.tsx`, `app/store/graph.ts`, `app/hooks/useFileSync.ts`
- Contains: Zustand graph state, tab/search/chat shell logic, file-sync lifecycle, render reload effects, and edit completion bookkeeping.
- Depends on: `app/features/render/parseRenderGraph.ts`, `app/processes/canvas-runtime/*`, `app/ws/rpc.ts`
- Used by: `app/app/page.tsx`, `app/components/GraphCanvas.tsx`, chat/sidebar/header UI components in `app/components/ui/*`

**Canvas Runtime And Entrypoint Layer:**
- Purpose: Turn fixed canvas slots into concrete toolbar, context-menu, floating-menu, keyboard, and overlay behavior.
- Location: `app/processes/canvas-runtime/*`, `app/features/canvas-ui-entrypoints/*`, `app/features/overlay-host/*`
- Contains: Runtime slot definitions, contribution sets, overlay host primitives, keyboard dispatch helpers, and GraphCanvas bindings.
- Depends on: `app/features/editing/actionRoutingBridge/*`, `app/store/graph.ts`, `app/components/GraphCanvas.tsx`
- Used by: `app/components/GraphCanvas.tsx`, `app/components/editor/WorkspaceClient.tsx`

**Render Adaptation Layer:**
- Purpose: Translate renderer output and legacy JSX props into React Flow nodes, edges, edit metadata, and canonical object payloads.
- Location: `app/features/render/parseRenderGraph.ts`, `app/features/render/canonicalObject.ts`, `app/features/render/aliasNormalization.ts`, `app/utils/*`
- Contains: Render graph parsing, alias normalization, size and layout helpers, source metadata shaping, and editability derivation.
- Depends on: `@magam/core` exports from `libs/core/src/index.ts`, local utilities in `app/utils/*`
- Used by: `app/components/editor/WorkspaceClient.tsx`, node renderers in `app/components/nodes/*`, editing logic in `app/features/editing/*`

**Editing And Intent Routing Layer:**
- Purpose: Normalize UI gestures into stable command envelopes and ordered dispatch plans before any mutation happens.
- Location: `app/features/editing/commands.ts`, `app/features/editing/editability.ts`, `app/features/editing/actionRoutingBridge/registry.ts`, `app/features/editing/actionRoutingBridge/routeIntent.ts`
- Contains: Edit target contracts, create and update command builders, payload normalization, optimistic action metadata, and surface gating.
- Depends on: `app/store/graph.ts`, `app/features/canvas-ui-entrypoints/ui-runtime-state/*`, renderer-derived `sourceMeta`
- Used by: `app/components/editor/WorkspaceClient.tsx`, `app/processes/canvas-runtime/bindings/actionDispatch.ts`, GraphCanvas toolbar and menu flows

**Legacy File Mutation And Sync Layer:**
- Purpose: Keep workspace `.tsx` files editable in place and synchronize browser state through JSON-RPC plus file watching.
- Location: `app/ws/server.ts`, `app/ws/methods.ts`, `app/ws/filePatcher.ts`
- Contains: Bun WebSocket server, request validation, `baseVersion` conflict checks, AST patch operations, plugin-instance runtime bucket, and watcher broadcasts.
- Depends on: `app/features/editing/*`, `app/ws/rpc.ts`, Babel AST tooling, filesystem access
- Used by: `app/hooks/useFileSync.ts`, browser mutation flows, watched workspace files under `examples/*.tsx` or `MAGAM_TARGET_DIR`

**Core Render Contract Layer:**
- Purpose: Define the Magam authoring DSL and render TSX diagrams into graph containers.
- Location: `libs/core/src/components/*`, `libs/core/src/renderer.ts`, `libs/core/src/reconciler/hostConfig.ts`, `libs/core/src/layout/elk.ts`
- Contains: `Canvas`, `Node`, `MindMap`, `Shape`, `Sticky`, `Image`, `Sequence`, and related components; custom host config; layout post-processing.
- Depends on: React, `react-reconciler`, ELK layout helpers, internal context and size modules in `libs/core/src/*`
- Used by: Workspace source files in `examples/*.tsx`, execution helpers in `libs/cli/src/core/executor.ts`, browser adapters in `app/features/render/parseRenderGraph.ts`

**Headless Service And Execution Layer:**
- Purpose: Transpile and execute workspace TSX, expose HTTP and CLI entrypoints, and back the browser proxy routes.
- Location: `libs/cli/src/bin.ts`, `libs/cli/src/server/http.ts`, `libs/cli/src/headless/bootstrap.ts`, `libs/runtime/src/lib/executor.ts`
- Contains: CLI command dispatch, HTTP render/files/chat server, headless bootstrap against canonical storage, and worker-based execution.
- Depends on: `@magam/core`, `@magam/shared`, `libs/cli/src/core/transpiler.ts`, `libs/cli/src/core/executor.ts`, filesystem access
- Used by: Root scripts in `package.json`, `scripts/dev/app-dev.ts`, Next proxy routes in `app/app/api/*/route.ts`, external CLI consumers

**Canonical Shared Domain Layer:**
- Purpose: Provide the stable cross-package schema and persistence/query/mutation surface for database-first and headless workflows.
- Location: `libs/shared/src/lib/canonical-object-contract.ts`, `libs/shared/src/lib/canonical-persistence/*`, `libs/shared/src/lib/canonical-query/*`, `libs/shared/src/lib/canonical-mutation/*`, `libs/shared/src/lib/plugin-runtime-contract.ts`
- Contains: Canonical object contracts, Drizzle repository and schema, PGlite bootstrap, workspace and document queries, mutation batches, plugin manifests, and chat/provider types.
- Depends on: Drizzle ORM, PGlite, local validators in `libs/shared/src/lib/canonical-persistence/validators.ts`
- Used by: `libs/cli/**/*`, `libs/runtime/src/lib/worker.ts`, future DB-first flows described under `docs/features/database-first-canvas-platform/*`

## Data Flow

**Interactive Browser Render Refresh:**

1. `app/app/page.tsx` mounts `app/components/editor/WorkspaceClient.tsx`.
2. `app/components/editor/WorkspaceClient.tsx` loads file metadata from `/api/files` and posts the active `filePath` to `/api/render`.
3. Next proxy routes in `app/app/api/files/route.ts` and `app/app/api/render/route.ts` forward those requests to `libs/cli/src/server/http.ts`.
4. `libs/cli/src/server/http.ts` resolves the workspace file, transpiles and executes it through `libs/cli/src/core/transpiler.ts` and `libs/cli/src/core/executor.ts`, which in turn consume `@magam/core`.
5. The browser receives the graph payload, parses it with `app/features/render/parseRenderGraph.ts`, and stores nodes, edges, background, and source versions in `app/store/graph.ts`.
6. `app/components/GraphCanvas.tsx` renders the React Flow view and installs runtime slot bindings from `app/processes/canvas-runtime/*`.

**Interactive Edit Mutation:**

1. User actions originate in `app/components/GraphCanvas.tsx`, selection controls in `app/features/canvas-ui-entrypoints/selection-floating-menu/*`, or editor flows in `app/components/editor/WorkspaceClient.tsx`.
2. `app/processes/canvas-runtime/bindings/actionDispatch.ts` resolves the current surface, selection, and target metadata into a `UIIntentEnvelope`.
3. `app/features/editing/actionRoutingBridge/routeIntent.ts` and `app/features/editing/actionRoutingBridge/registry.ts` validate the surface, normalize payloads, and build an ordered dispatch plan with optional optimistic runtime steps.
4. `app/hooks/useFileSync.ts` sends JSON-RPC mutations with `baseVersion`, `commandId`, and origin metadata to `app/ws/server.ts`.
5. `app/ws/methods.ts` enforces version checks, then calls AST mutation helpers in `app/ws/filePatcher.ts` such as `patchNodePosition`, `patchNodeContent`, `patchNodeStyle`, `patchNodeCreate`, `patchNodeReparent`, and `patchNodeDelete`.
6. `app/ws/server.ts` emits `file.changed`; `app/hooks/useFileSync.ts` decides whether to reload; `app/components/editor/WorkspaceClient.tsx` re-renders the file and commits edit history back into `app/store/graph.ts`.

**Headless Query And Canonical Mutation:**

1. A user or agent invokes `magam` through `libs/cli/src/bin.ts`.
2. Headless commands bootstrap a workspace context in `libs/cli/src/headless/bootstrap.ts`, which opens PGlite through `libs/shared/src/lib/canonical-persistence/pglite-db.ts`.
3. Query commands call helpers such as `libs/shared/src/lib/canonical-query/workspace-document.ts`; mutation commands call `libs/shared/src/lib/canonical-mutation/executor.ts`.
4. `libs/shared/src/lib/canonical-persistence/repository.ts` reads and writes canonical objects, canvas nodes, bindings, plugin records, and document revisions.
5. Results return through CLI JSON output or other service shells such as `libs/cli/src/server/http.ts` and `libs/cli/src/mcp/*`.

**Plugin Runtime Resolution:**

1. `app/features/plugin-runtime/index.ts` installs a browser-side `PluginRuntimeRegistry` and registers example catalog entries from `app/features/plugin-runtime/examples/*`.
2. Plugin node data parsed in `app/features/render/parseRenderGraph.ts` and hydrated by `app/features/plugin-runtime/instanceHydration.ts` resolves package, version, export, props, and capability metadata.
3. `app/features/plugin-runtime/loader.ts` looks up the descriptor; `app/features/plugin-runtime/bridge.ts` validates postMessage envelopes against the contract defined in `libs/shared/src/lib/plugin-runtime-contract.ts` and local types in `app/features/plugin-runtime/types.ts`.
4. Graph nodes render plugin content or diagnostics through `app/components/nodes/PluginNode.tsx` and `app/components/nodes/PluginFallbackNode.tsx`.

**State Management:**
- Ephemeral browser state lives in Zustand stores in `app/store/graph.ts`, `app/store/chat.ts`, and `app/store/chatUi.ts`.
- Overlay and entrypoint runtime state is reducer-driven in `app/features/overlay-host/state.ts` and `app/features/canvas-ui-entrypoints/ui-runtime-state/*`.
- Legacy authoring truth lives in workspace `.tsx` files under `examples/*.tsx` or the directory supplied through `MAGAM_TARGET_DIR`; synchronization is versioned with `sourceVersion` and `sourceVersions` across `app/components/editor/WorkspaceClient.tsx`, `app/hooks/useFileSync.ts`, and `app/ws/methods.ts`.
- Canonical query and mutation state lives separately in PGlite plus Drizzle under `libs/shared/src/lib/canonical-persistence/*`; it is a different ownership path from the file patcher in `app/ws/filePatcher.ts`.

## Key Abstractions

**Render Graph Container:**
- Purpose: The intermediate graph representation produced from TSX and consumed by the browser app.
- Examples: `libs/core/src/renderer.ts`, `libs/core/src/reconciler/hostConfig.ts`, `app/features/render/parseRenderGraph.ts`
- Pattern: Custom React reconciler plus browser-side adapter

**Action Routing Intent:**
- Purpose: A UI-level gesture that can expand into runtime-only actions, optimistic updates, and mutation RPC calls.
- Examples: `app/features/editing/actionRoutingBridge/registry.ts`, `app/features/editing/actionRoutingBridge/routeIntent.ts`, `app/processes/canvas-runtime/bindings/actionDispatch.ts`
- Pattern: Registry-driven planner with per-surface gating and normalization

**Canvas Runtime Contribution:**
- Purpose: A slot-scoped extension seam for toolbar sections, selection controls, pane menu items, node menu items, and shortcuts.
- Examples: `app/processes/canvas-runtime/createCanvasRuntime.ts`, `app/processes/canvas-runtime/types.ts`, `app/features/canvas-ui-entrypoints/canvas-toolbar/contribution.ts`, `app/features/canvas-ui-entrypoints/node-context-menu/contribution.ts`
- Pattern: Fixed-slot contribution registry

**Canonical Object And Repository:**
- Purpose: The shared persistence and query contract used by headless and database-first workflows.
- Examples: `libs/shared/src/lib/canonical-object-contract.ts`, `libs/shared/src/lib/canonical-persistence/repository.ts`, `libs/shared/src/lib/canonical-query/workspace-document.ts`
- Pattern: Stable contract plus repository boundary

**Plugin Runtime Registration:**
- Purpose: Resolve plugin exports and enforce a capability-scoped browser bridge.
- Examples: `app/features/plugin-runtime/registry.ts`, `app/features/plugin-runtime/loader.ts`, `app/features/plugin-runtime/bridge.ts`, `libs/shared/src/lib/plugin-runtime-contract.ts`
- Pattern: Registry plus contract-validated bridge

**AST File Patcher:**
- Purpose: Apply user edits directly to TSX source while preserving author-controlled files.
- Examples: `app/ws/filePatcher.ts`, `app/ws/methods.ts`, `app/hooks/useFileSync.ts`
- Pattern: JSON-RPC boundary plus Babel AST rewrite

## Entry Points

**Web App Entry:**
- Location: `app/app/page.tsx`, `app/app/layout.tsx`
- Triggers: Browser requests to `/`
- Responsibilities: Mount `WorkspaceClient`, load global styles, and provide the root document shell

**Next API Proxy Entry:**
- Location: `app/app/api/render/route.ts`, `app/app/api/files/route.ts`, `app/app/api/file-tree/route.ts`, `app/app/api/chat/*/route.ts`
- Triggers: Client fetch and SSE requests from the browser app
- Responsibilities: Proxy requests to the local HTTP sidecar on `MAGAM_HTTP_PORT` and translate transport failures into browser-safe responses

**WS Patch Server Entry:**
- Location: `app/ws/server.ts`
- Triggers: `bun run ws:dev` or direct execution; WebSocket clients created by `app/hooks/useFileSync.ts`
- Responsibilities: Accept JSON-RPC requests, watch workspace files, and broadcast `file.changed` and `files.changed` notifications

**HTTP Render And Chat Service Entry:**
- Location: `libs/cli/src/server/http.ts`
- Triggers: `magam serve`, `magam dev`, or browser proxy requests from `app/app/api/*/route.ts`
- Responsibilities: Render TSX files, enumerate file trees, stream chat responses, and expose health status

**CLI Entry:**
- Location: `libs/cli/src/bin.ts`
- Triggers: `magam <command>`
- Responsibilities: Install module-resolution interceptors, dispatch legacy and headless commands, and format JSON or human-readable output

**Dev Orchestrator Entry:**
- Location: `scripts/dev/app-dev.ts`
- Triggers: Root `bun run dev`
- Responsibilities: Generate the workspace Tailwind safelist, build `@magam/core`, and start the CLI dev workflow against `examples/` or `MAGAM_TARGET_DIR`

## Error Handling

**Strategy:** Validate early at each boundary and surface failures explicitly instead of hiding them behind default fallbacks.

**Patterns:**
- Next proxy routes in `app/app/api/*/route.ts` catch upstream failures and return explicit `502` JSON or streaming error responses.
- Intent validation happens before mutation in `app/features/editing/actionRoutingBridge/routeIntent.ts`; surface and payload mismatches fail before any file patch is attempted.
- `app/hooks/useFileSync.ts` and `app/ws/methods.ts` enforce `baseVersion` checks so stale browser state becomes a conflict instead of silently overwriting files.
- `app/ws/filePatcher.ts` throws contract-specific RPC-like errors such as `CONTENT_CONTRACT_VIOLATION`, `PATCH_SURFACE_VIOLATION`, and plugin-runtime-only patch violations.
- `libs/core/src/renderer.ts` wraps reconciliation and layout failures in `ResultAsync`; CLI top-level handling in `libs/cli/src/bin.ts` serializes errors into structured output.

## Cross-Cutting Concerns

**Logging:**
- Most runtime boundaries use `console.*` logging in `app/components/editor/WorkspaceClient.tsx`, `app/ws/server.ts`, and `libs/cli/src/server/http.ts`.
- Focused diagnostics live in `app/utils/editDebug.ts`, `app/utils/stickerDebug.ts`, and render performance logging inside `libs/cli/src/server/http.ts`.

**Validation:**
- Intent envelope validation happens in `app/features/editing/actionRoutingBridge/routeIntent.ts`.
- Canonical record validation lives in `libs/shared/src/lib/canonical-persistence/validators.ts`.
- Plugin manifest and bridge validation live in `libs/shared/src/lib/plugin-runtime-contract.ts` and `app/features/plugin-runtime/bridge.ts`.
- Render parsing guards and capability normalization live in `app/features/render/parseRenderGraph.ts`.

**Versioning And Concurrency:**
- Browser state keeps per-file source hashes in `app/store/graph.ts`; `app/hooks/useFileSync.ts` forwards them as `baseVersion`.
- `app/ws/methods.ts` rejects stale writes before AST patching.
- Canonical mutations support document revision preconditions in `libs/shared/src/lib/canonical-mutation/types.ts`.

**Authentication:**
- Not detected.
- Local browser, HTTP, and WebSocket services trust same-machine access; there is no repository-wide auth middleware in `app/app/api/*`, `app/ws/server.ts`, or `libs/cli/src/server/http.ts`.

---

*Architecture analysis: 2026-03-19*
*Update when major patterns change*
