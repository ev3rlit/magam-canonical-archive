# Technology Stack

**Analysis Date:** 2026-03-19

## Languages

**Primary:**
- TypeScript 5.9.2 - Main implementation language across `app/`, `libs/core/`, `libs/runtime/`, `libs/shared/`, and `libs/cli/`, with project references in `tsconfig.json` and path aliases in `tsconfig.base.json`.

**Secondary:**
- JavaScript / MJS / CJS - Build and framework config in `app/next.config.mjs`, `app/postcss.config.js`, `app/tailwind.config.js`, `eslint.config.mjs`, and `scripts/generate-tailwind-workspace-safelist.mjs`.
- Shell - Local perf and verification scripts under `scripts/perf/*.sh`.

## Runtime

**Environment:**
- Bun 1.x - Primary execution runtime for workspace scripts and local servers. Evidence: `package.json` uses `bun run`, `cli.ts` uses `spawn` from `bun`, `app/ws/server.ts` uses `Bun.serve`, and `libs/cli/src/chat/repository/db.ts` uses `bun:sqlite`.
- Node.js >=18 - Required by workspace packages via `engines.node` in `libs/core/package.json`, `libs/runtime/package.json`, `libs/shared/package.json`, and `libs/cli/package.json`.
- Browser runtime - The web client runs through Next.js/React in `app/`, with local WebSocket connectivity resolved in `app/hooks/useFileSync.shared.ts`.

**Package Manager:**
- Bun workspaces - Root workspace configuration lives in `package.json` with `workspaces` set to `app` and `libs/*`.
- Lockfile: `bun.lock` present

## Frameworks

**Core:**
- Next.js 15.1.6 - Web application shell and Node runtime API handlers in `app/package.json` and `app/app/api/**`.
- React 18.3.1 - UI layer for the Next app and render graph packages in `app/package.json` and `libs/core/package.json`.
- Tailwind CSS 3.4.3 - Styling pipeline configured in `app/tailwind.config.js` and `app/postcss.config.js`.
- Drizzle ORM 0.44.5 - Persistence layer for SQLite chat state in `libs/cli/src/chat/repository/db.ts` and canonical PGlite storage in `libs/shared/src/lib/canonical-persistence/pglite-db.ts`.

**Testing:**
- Bun test - Default workspace test runner from `package.json`.
- Vitest 4.0.0 - Active package-level test config in `libs/cli/vitest.config.mts`.
- Playwright 1.58.2 - Browser E2E configuration in `playwright.config.ts`.

**Build/Dev:**
- Tsup 8.5.1 - Library bundling in `libs/core/tsup.config.ts`, `libs/runtime/tsup.config.ts`, and `libs/cli/tsup.config.ts`.
- Drizzle Kit 0.31.4 - Schema generation and migration config in `drizzle.config.ts` and `drizzle.canonical.config.ts`.
- Next build/dev - App build and server scripts in `app/package.json`.
- ESLint 9 flat config and Prettier 3.6.2 - Formatting/linting config in `eslint.config.mjs` and `.prettierrc`.

## Key Dependencies

**Critical:**
- `next` ^15.1.6 - Hosts the browser UI and Node API proxy layer in `app/package.json` and `app/app/api/**`.
- `react` / `react-dom` ^18.3.1 - Core rendering dependencies used by the app and workspace libraries, declared in both `package.json` and `app/package.json`.
- `drizzle-orm` ^0.44.5 - Shared query/migration layer used by `libs/cli/src/chat/repository/db.ts` and `libs/shared/src/lib/canonical-persistence/pglite-db.ts`.
- `@electric-sql/pglite` ^0.3.8 - Embedded PostgreSQL-compatible storage for canonical persistence in `libs/shared/src/lib/canonical-persistence/pglite-db.ts`.
- `@modelcontextprotocol/sdk` ^1.25.3 - Stdio MCP server surface in `libs/cli/src/server/mcp.ts` and `libs/cli/src/mcp/index.ts`.

**Infrastructure:**
- `ws` ^8.19.0 and Bun WebSocket support - Local WebSocket server surfaces in `libs/cli/src/server/websocket.ts` and `app/ws/server.ts`.
- `chokidar` ^5.0.0 and `fast-glob` ^3.3.3 - Workspace file watching and discovery in `app/ws/server.ts`, `libs/cli/src/commands/dev.ts`, and `libs/cli/src/server/http.ts`.
- `esbuild` ^0.27.2 - TSX transpilation support used by the render/runtime pipeline and declared in `package.json`, `app/package.json`, and `libs/runtime/package.json`.
- `pino` ^10.3.0 - Structured logging in `libs/core/src/logger.ts` and `app/processes/canvas-runtime/keyboard/trace.ts`.

## Configuration

**Environment:**
- Local process wiring is env-driven through `MAGAM_TARGET_DIR`, `MAGAM_HTTP_PORT`, `MAGAM_WS_PORT`, and `NEXT_PUBLIC_MAGAM_WS_PORT` in `cli.ts`, `scripts/dev/app-dev.ts`, `app/ws/server.ts`, and `app/hooks/useFileSync.shared.ts`.
- Persistence and runtime tuning use `MAGAM_CHAT_DB_PATH`, `MAGAM_CANONICAL_DB_PATH`, `MAGAM_CANONICAL_DB_URL`, `MAGAM_WORKSPACE_ID`, `MAGAM_CHAT_TIMEOUT_MS`, `MAGAM_RENDER_CACHE_MAX`, `MAGAM_RENDER_CACHE_TTL_MS`, and `MAGAM_WS_ENABLE_FILE_MUTEX` in `drizzle.config.ts`, `drizzle.canonical.config.ts`, `libs/cli/src/chat/repository/db.ts`, `libs/shared/src/lib/canonical-persistence/pglite-db.ts`, `libs/cli/src/chat/handler.ts`, and `libs/cli/src/server/http.ts`.
- No tracked `.env*` file is detected by `rg --files`; runtime configuration is read from process environment in source.

**Build:**
- `tsconfig.json` and `tsconfig.base.json` - TypeScript project references and workspace aliases.
- `app/next.config.mjs`, `app/postcss.config.js`, and `app/tailwind.config.js` - App framework and CSS pipeline.
- `drizzle.config.ts` and `drizzle.canonical.config.ts` - Database generation and migration configuration.
- `libs/core/tsup.config.ts`, `libs/runtime/tsup.config.ts`, and `libs/cli/tsup.config.ts` - Package bundling.
- `eslint.config.mjs`, `.prettierrc`, and `playwright.config.ts` - Linting, formatting, and browser test execution.

## Platform Requirements

**Development:**
- Multi-process local development is the default: `scripts/dev/app-dev.ts` generates the Tailwind workspace safelist, builds `@magam/core`, and then runs `cli.ts dev`.
- `cli.ts` starts three local services together: the Bun HTTP render/chat server via `libs/cli/src/bin.ts`, the Bun WebSocket JSON-RPC server in `app/ws/server.ts`, and the Next dev server from `app/package.json`.
- A target workspace is required; when `MAGAM_TARGET_DIR` is unset, `scripts/dev/app-dev.ts` falls back to `./examples`.
- No Docker, cloud emulator, or managed local dependency is detected in tracked config.

**Production:**
- A Next production build path exists via `app/package.json` (`next build`, `next start`), but no deployment target or platform config is detected in tracked files.
- CLI and library packages build to local distributable artifacts: `libs/cli/tsup.config.ts` emits CommonJS CLI bundles, while `libs/core/tsup.config.ts` and `libs/runtime/tsup.config.ts` emit library bundles for reuse.

---

*Stack analysis: 2026-03-19*
*Update after major dependency changes*
