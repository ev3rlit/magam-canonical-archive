# Codebase Structure

**Analysis Date:** 2026-03-19

## Directory Layout

```text
[project-root]/
├── app/                # Next.js browser app, client runtime orchestration, and Bun WS patch server
├── libs/               # Reusable packages: core renderer, shared contracts, runtime executor, CLI services
├── examples/           # Default watched Magam workspace with TSX diagram sources
├── scripts/            # Dev bootstrap, safelist generation, publishing, and perf tooling
├── e2e/                # Playwright end-to-end specs for browser flows
├── docs/               # Feature docs, reports, milestones, and design history
├── specs/              # Spec-driven delivery artifacts per feature/change
├── .planning/          # Generated planning state and codebase mapping docs
├── assets/             # Static repository assets such as README images
├── package.json        # Root workspace scripts and dependency graph
├── tsconfig.base.json  # Shared TypeScript options and workspace path aliases
└── AGENTS.md           # Repository working rules for agents
```

## Directory Purposes

**app/**
- Purpose: Interactive web application plus browser-facing runtime adapters.
- Contains: Next App Router files, React components, domain features, orchestration processes, Zustand stores, utilities, and the Bun WebSocket patch server.
- Key files: `app/app/page.tsx`, `app/components/editor/WorkspaceClient.tsx`, `app/store/graph.ts`, `app/ws/server.ts`
- Subdirectories: `app/app/`, `app/components/`, `app/features/`, `app/processes/`, `app/store/`, `app/utils/`, `app/ws/`

**app/app/**
- Purpose: Next.js App Router boundary.
- Contains: `page.tsx`, `layout.tsx`, `globals.css`, and API routes under `app/app/api/*/route.ts`.
- Key files: `app/app/page.tsx`, `app/app/layout.tsx`, `app/app/api/render/route.ts`, `app/app/api/chat/send/route.ts`
- Subdirectories: `app/app/api/render/`, `app/app/api/files/`, `app/app/api/file-tree/`, `app/app/api/chat/`, `app/app/api/assets/`

**app/components/**
- Purpose: Browser UI and React Flow rendering components.
- Contains: Canvas shell, node renderers, edge renderers, editor panels, chat widgets, and shared UI primitives.
- Key files: `app/components/GraphCanvas.tsx`, `app/components/editor/WorkspaceClient.tsx`, `app/components/nodes/ShapeNode.tsx`, `app/components/ui/Sidebar.tsx`
- Subdirectories: `app/components/nodes/`, `app/components/edges/`, `app/components/editor/`, `app/components/chat/`, `app/components/ui/`

**app/features/**
- Purpose: Feature-scoped domain modules that should stay below the top-level UI shell.
- Contains: Render parsing, editing contracts, UI entrypoint contributions, overlay hosting, plugin runtime, and workspace styling.
- Key files: `app/features/render/parseRenderGraph.ts`, `app/features/editing/commands.ts`, `app/features/editing/actionRoutingBridge/registry.ts`, `app/features/overlay-host/context.tsx`, `app/features/plugin-runtime/index.ts`
- Subdirectories: `app/features/render/`, `app/features/editing/`, `app/features/canvas-ui-entrypoints/`, `app/features/overlay-host/`, `app/features/plugin-runtime/`, `app/features/workspace-styling/`

**app/processes/**
- Purpose: Orchestration and binding layer that wires feature modules into the running canvas host.
- Contains: Canvas runtime assembly, slot bindings, keyboard dispatch, and host adapters.
- Key files: `app/processes/canvas-runtime/createCanvasRuntime.ts`, `app/processes/canvas-runtime/bindings/actionDispatch.ts`, `app/processes/canvas-runtime/bindings/graphCanvasHost.ts`
- Subdirectories: `app/processes/canvas-runtime/bindings/`, `app/processes/canvas-runtime/builtin-slots/`, `app/processes/canvas-runtime/keyboard/`

**app/store/**
- Purpose: Shared client state for the browser app.
- Contains: Zustand stores, fixtures, and store-level tests.
- Key files: `app/store/graph.ts`, `app/store/chat.ts`, `app/store/chatUi.ts`
- Subdirectories: `app/store/__fixtures__/`

**app/utils/**
- Purpose: Browser-only helpers that do not need package-level reuse.
- Contains: Layout helpers, font and size utilities, search helpers, clipboard helpers, attachment mapping, and strategy registries.
- Key files: `app/utils/layoutUtils.ts`, `app/utils/fontHierarchy.ts`, `app/utils/search.ts`, `app/utils/relativeAttachmentMapping.ts`, `app/utils/strategies/registry.ts`
- Subdirectories: `app/utils/strategies/`, `app/utils/strategies/fixtures/`

**app/ws/**
- Purpose: Legacy file-based mutation and watch service.
- Contains: JSON-RPC handler registry, AST patcher, watcher server, fixtures, and tests.
- Key files: `app/ws/server.ts`, `app/ws/methods.ts`, `app/ws/filePatcher.ts`, `app/ws/rpc.ts`
- Subdirectories: `app/ws/__fixtures__/`

**libs/core/**
- Purpose: Reusable authoring DSL and render graph engine.
- Contains: Public component contracts, reconciler host config, layout helpers, materials, contexts, hooks, and tests.
- Key files: `libs/core/src/index.ts`, `libs/core/src/renderer.ts`, `libs/core/src/reconciler/hostConfig.ts`, `libs/core/src/layout/elk.ts`
- Subdirectories: `libs/core/src/components/`, `libs/core/src/reconciler/`, `libs/core/src/layout/`, `libs/core/src/context/`, `libs/core/src/hooks/`, `libs/core/src/__tests__/`

**libs/shared/**
- Purpose: Cross-package contracts plus canonical persistence, query, and mutation services.
- Contains: Canonical object types, Drizzle repository/schema, PGlite bootstrap, canonical queries and mutations, plugin runtime contracts, chat types, and module-resolution helpers.
- Key files: `libs/shared/src/index.ts`, `libs/shared/src/lib/canonical-object-contract.ts`, `libs/shared/src/lib/canonical-persistence/repository.ts`, `libs/shared/src/lib/canonical-query/workspace-document.ts`, `libs/shared/src/lib/canonical-mutation/executor.ts`
- Subdirectories: `libs/shared/src/lib/canonical-persistence/`, `libs/shared/src/lib/canonical-query/`, `libs/shared/src/lib/canonical-mutation/`, `libs/shared/src/lib/canonical-cli/`

**libs/cli/**
- Purpose: Executable surface for render services, headless commands, MCP, chat, and workspace tooling.
- Contains: CLI entrypoint, command modules, HTTP and WebSocket servers, chat adapters, headless bootstrap, and tests.
- Key files: `libs/cli/src/bin.ts`, `libs/cli/src/server/http.ts`, `libs/cli/src/headless/bootstrap.ts`, `libs/cli/src/commands/render.ts`, `libs/cli/src/commands/mutation.ts`
- Subdirectories: `libs/cli/src/commands/`, `libs/cli/src/server/`, `libs/cli/src/chat/`, `libs/cli/src/headless/`, `libs/cli/src/mcp/`, `libs/cli/src/core/`

**libs/runtime/**
- Purpose: Lower-level execution helper package used for runtime evaluation boundaries.
- Contains: Executor, transpiler, worker loader, and light package exports.
- Key files: `libs/runtime/src/index.ts`, `libs/runtime/src/lib/executor.ts`, `libs/runtime/src/lib/worker.ts`, `libs/runtime/src/lib/transpiler.ts`
- Subdirectories: `libs/runtime/src/lib/`

**examples/**
- Purpose: Default watched Magam workspace and sample diagrams.
- Contains: `.tsx` source files, background variants, local runtime artifacts in `examples/.magam/`, and example-level guidance in `examples/CLAUDE.md`.
- Key files: `examples/overview.tsx`, `examples/mindmap.tsx`, `examples/styling.tsx`, `examples/background/preset_dots.tsx`
- Subdirectories: `examples/background/`, `examples/.magam/`

**scripts/**
- Purpose: Repository orchestration and performance automation.
- Contains: Dev bootstrap, safelist generation, smoke/perf scripts, publish helper, and script-level tests.
- Key files: `scripts/dev/app-dev.ts`, `scripts/dev/app-dev.test.ts`, `scripts/generate-tailwind-workspace-safelist.mjs`, `scripts/chat-smoke.ts`
- Subdirectories: `scripts/dev/`, `scripts/perf/`

**docs/**
- Purpose: Design docs, milestone tracking, historical reports, and feature notes.
- Contains: Markdown documents grouped by features, milestones, concepts, reports, backlog, and closed features.
- Key files: `docs/features/database-first-canvas-platform/README.md`, `docs/features/object-capability-composition/README.md`, `docs/milestones/README.md`
- Subdirectories: `docs/features/`, `docs/milestones/`, `docs/reports/`, `docs/history/`, `docs/closed-features/`, `docs/backlog/`

**specs/**
- Purpose: Spec-driven implementation packages for individual changes.
- Contains: `spec.md`, `plan.md`, `tasks.md`, `research.md`, `quickstart.md`, and related design artifacts.
- Key files: `specs/007-object-capability-composition/spec.md`, `specs/008-action-routing-bridge/spec.md`, `specs/009-ui-runtime-state/spec.md`
- Subdirectories: `specs/001-*`, `specs/007-object-capability-composition/`, `specs/009-overlay-host/`, `specs/009-ui-runtime-state/`

**.planning/**
- Purpose: Generated planning state used by the GSD workflow.
- Contains: Codebase maps and other planning artifacts.
- Key files: `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/STRUCTURE.md`
- Subdirectories: `.planning/codebase/`

## Key File Locations

**Entry Points:**
- `app/app/page.tsx`: Browser route entry that mounts `WorkspaceClient`.
- `app/ws/server.ts`: Bun JSON-RPC WebSocket server for file sync and patching.
- `libs/cli/src/bin.ts`: `magam` CLI entrypoint.
- `libs/cli/src/server/http.ts`: Local HTTP render, files, and chat service.
- `scripts/dev/app-dev.ts`: Root dev orchestrator invoked by `bun run dev`.

**Configuration:**
- `package.json`: Root workspace scripts, workspaces, and shared dependencies.
- `tsconfig.base.json`: Workspace TypeScript settings and `@magam/*` path aliases.
- `tsconfig.json`: Root project references for workspace packages.
- `app/tsconfig.json`: Browser-side TS config and `@/*` alias for `app/`.
- `app/next.config.mjs`: Next.js runtime configuration.
- `app/tailwind.config.js`: Tailwind scan paths and theme extension for the app.
- `app/postcss.config.js`: PostCSS pipeline for the app.
- `AGENTS.md`: Repository working rules and architectural constraints for agents.

**Core Logic:**
- `app/components/editor/WorkspaceClient.tsx`: Browser orchestrator for file loading, rendering, and edit flows.
- `app/components/GraphCanvas.tsx`: React Flow canvas host and UI surface bridge.
- `app/features/render/parseRenderGraph.ts`: Render graph to React Flow adaptation boundary.
- `app/processes/canvas-runtime/createCanvasRuntime.ts`: Slot-based runtime assembly.
- `app/ws/filePatcher.ts`: AST mutation engine for legacy file editing.
- `libs/core/src/renderer.ts`: Custom React reconciler entry.
- `libs/shared/src/lib/canonical-persistence/repository.ts`: Canonical repository boundary.
- `libs/shared/src/lib/canonical-mutation/executor.ts`: Canonical mutation executor.

**Testing:**
- `app/**/*.test.ts`, `app/**/*.test.tsx`, `app/**/*.spec.ts`: Colocated app unit and integration tests.
- `libs/core/src/__tests__/`: Renderer and public API tests for `@magam/core`.
- `libs/cli/src/**/*.spec.ts`: CLI, chat, server, and command tests.
- `e2e/chat-session-management.spec.ts`: Browser E2E test for chat flows.
- `e2e/tabs.spec.ts`: Browser E2E test for tab behavior.

**Documentation:**
- `README.md`: Top-level product description.
- `AGENTS.md`: Repo-specific execution rules.
- `docs/features/database-first-canvas-platform/README.md`: Current platform direction reference.
- `docs/features/object-capability-composition/README.md`: Object-capability design notes.
- `specs/007-object-capability-composition/spec.md`: Feature-level implementation spec.

## Naming Conventions

**Files:**
- `route.ts`: Next API handlers such as `app/app/api/render/route.ts`.
- `PascalCase.tsx`: React components such as `app/components/GraphCanvas.tsx`, `app/components/nodes/StickyNode.tsx`, and `libs/core/src/components/Canvas.tsx`.
- `camelCase.ts`: Non-component modules such as `app/features/render/parseRenderGraph.ts` and `libs/shared/src/lib/canonical-mutation/executor.ts`.
- `contribution.ts`, `types.ts`, `index.ts`: Runtime slot clusters such as `app/features/canvas-ui-entrypoints/canvas-toolbar/contribution.ts`.
- `*.test.ts`, `*.test.tsx`, `*.spec.ts`: Colocated tests such as `app/features/editing/actionGating.test.ts` and `libs/cli/src/server/http.spec.ts`.

**Directories:**
- `kebab-case`: Feature and process folders such as `app/features/plugin-runtime` and `app/features/canvas-ui-entrypoints`.
- Plural collection names: `app/components/nodes`, `libs/cli/src/commands`, `docs/features`.
- Numeric-prefixed spec packages: `specs/007-object-capability-composition`, `specs/009-ui-runtime-state`.

**Special Patterns:**
- `app/app/api/<domain>/route.ts`: Browser proxy or HTTP adapter boundary.
- `libs/*/src/index.ts`: Public package surface; export there only when a symbol should cross package boundaries.
- `app/features/<feature>/index.ts`: Local barrel export pattern used when a feature already exposes a stable surface, for example `app/features/plugin-runtime/index.ts` and `app/features/overlay-host/index.ts`.

## Where to Add New Code

**New Browser Feature:**
- Primary code: `app/features/<feature-name>/`
- UI wiring: `app/components/editor/WorkspaceClient.tsx` or `app/components/GraphCanvas.tsx`
- Tests: Colocate `*.test.ts` or `*.test.tsx` beside the feature; add `e2e/*.spec.ts` only for browser-shell flows
- Config if needed: `app/next.config.mjs`, `app/tailwind.config.js`, or root `package.json` depending scope

**New Canvas Entrypoint Or Surface Behavior:**
- Contribution and models: `app/features/canvas-ui-entrypoints/<surface>/`
- Runtime binding: `app/processes/canvas-runtime/bindings/`
- Store or reducer state: `app/features/canvas-ui-entrypoints/ui-runtime-state/` or `app/store/graph.ts`

**New Renderable Component Or Module:**
- Authoring contract: `libs/core/src/components/`
- Renderer or layout support: `libs/core/src/reconciler/` or `libs/core/src/layout/`
- Browser node renderer: `app/components/nodes/`
- Render graph adapter: `app/features/render/parseRenderGraph.ts`

**New Route Or Command:**
- Browser proxy route: `app/app/api/<domain>/route.ts`
- Local HTTP implementation: `libs/cli/src/server/http.ts`
- CLI command: `libs/cli/src/commands/<name>.ts`
- Shared cross-package contract: `libs/shared/src/lib/`

**Utilities:**
- Browser-only helpers: `app/utils/`
- Cross-package contracts and reusable helpers: `libs/shared/src/lib/`
- Package export updates: `libs/core/src/index.ts`, `libs/shared/src/index.ts`, `libs/runtime/src/index.ts`, or `libs/cli/src/index.ts` only when the symbol is intentionally public

## Special Directories

**app/.next/**
- Purpose: Generated Next.js build output for the browser app
- Source: Next.js development or build runs
- Committed: No

**libs/*/dist/**
- Purpose: Generated package build output for `@magam/core`, `@magam/shared`, `@magam/runtime`, and `@magam/cli`
- Source: `tsup` build scripts from each package
- Committed: No

**examples/.magam/**
- Purpose: Local workspace runtime data for the example workspace, including the tracked chat database files listed under `examples/.magam/`
- Source: App and chat runtime activity against `examples/`
- Committed: Yes

**.magam/**
- Purpose: Repository-local runtime data such as `.magam/canonical-pgdata/`
- Source: Local canonical persistence bootstrap and development activity
- Committed: No

**.planning/codebase/**
- Purpose: Generated codebase mapping documents consumed by planning and execution workflows
- Source: GSD mapping agents
- Committed: No

**specs/**
- Purpose: Long-lived implementation packages for shipped and in-flight work
- Source: Manual spec-driven delivery workflow
- Committed: Yes

**.codex/get-shit-done/**
- Purpose: Workflow templates, prompts, and command resources that drive the local GSD process
- Source: Checked-in automation assets
- Committed: Yes

---

*Structure analysis: 2026-03-19*
*Update when directory structure changes*
