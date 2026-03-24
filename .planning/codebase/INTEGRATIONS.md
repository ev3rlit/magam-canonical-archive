# External Integrations

**Analysis Date:** 2026-03-19

## APIs & External Services

**Local Process Services:**
- Magam HTTP render/chat service - Local Bun/Node HTTP server used as the backend boundary for render, file listing, file tree, and chat features.
  - SDK/Client: native `fetch` from `app/app/api/render/route.ts`, `app/app/api/files/route.ts`, `app/app/api/file-tree/route.ts`, and `app/app/api/chat/*`.
  - Auth: none detected; routes proxy to `http://localhost:${MAGAM_HTTP_PORT}` from `app/app/api/**`.
  - Endpoints used: `/render`, `/files`, `/file-tree`, `/chat/providers`, `/chat/sessions`, `/chat/groups`, `/chat/send`, `/chat/stop` implemented in `libs/cli/src/server/http.ts`.
- File-sync WebSocket service - Local JSON-RPC channel for file watching and mutation commands.
  - Integration method: browser/client WebSocket URL resolution in `app/hooks/useFileSync.shared.ts`; server implementation in `app/ws/server.ts`.
  - Auth: none detected; URL is assembled from `NEXT_PUBLIC_MAGAM_WS_PORT` or `MAGAM_WS_PORT`.
  - Protocol surface: mutation methods such as `node.update`, `node.move`, `node.create`, `node.delete`, and `node.reparent`, plus `file.changed` and `files.changed` notifications from `app/ws/server.ts` and `app/ws/methods.ts`.

**External AI Access via Local CLIs:**
- Claude Code CLI - Chat execution path for provider id `claude`.
  - Integration method: subprocess spawn through `libs/cli/src/chat/adapters/cli-runner.ts`, with detection in `libs/cli/src/chat/detector.ts` and command construction in `libs/cli/src/chat/adapters/provider-command.ts`.
  - Auth: handled by the local Claude CLI installation; the repo does not read Anthropic API keys directly.
  - Endpoints used: not called directly in-repo; the external CLI owns upstream API traffic.
- Gemini CLI - Chat execution path for provider id `gemini`.
  - Integration method: same local subprocess pattern through `libs/cli/src/chat/adapters/cli-runner.ts`.
  - Auth: handled by the local Gemini CLI installation; no Google API credential handling is implemented in repo code.
  - Endpoints used: not called directly in-repo.
- Codex CLI - Chat execution path for provider id `codex`.
  - Integration method: same local subprocess pattern through `libs/cli/src/chat/adapters/cli-runner.ts`.
  - Auth: handled by the local Codex CLI installation; no OpenAI API key handling is implemented in repo code.
  - Endpoints used: not called directly in-repo.

**Model Context Protocol:**
- MCP clients running on the same machine - `magam mcp` exposes resources/tools over stdio.
  - SDK/Client: `@modelcontextprotocol/sdk` in `libs/cli/src/server/mcp.ts` and `libs/cli/src/mcp/index.ts`.
  - Auth: none in transport; the trust boundary is the local parent process connected to stdio.

## Data Storage

**Databases:**
- SQLite on local disk - Chat sessions, groups, and messages.
  - Connection: `MAGAM_CHAT_DB_PATH` or `${MAGAM_TARGET_DIR}/.magam/chat.db` resolved in `libs/cli/src/chat/repository/db.ts`.
  - Client: Bun `bun:sqlite` plus Drizzle ORM in `libs/cli/src/chat/repository/db.ts`.
  - Migrations: `libs/cli/src/chat/repository/drizzle/` generated from `libs/cli/src/chat/repository/schema.ts` and `drizzle.config.ts`.
- PGlite (embedded Postgres-compatible storage) - Canonical workspace, document, and plugin-runtime persistence.
  - Connection: `MAGAM_CANONICAL_DB_PATH` or `${targetDir}/.magam/canonical-pgdata` resolved in `libs/shared/src/lib/canonical-persistence/pglite-db.ts`.
  - Client: `@electric-sql/pglite` plus Drizzle ORM in `libs/shared/src/lib/canonical-persistence/pglite-db.ts`.
  - Migrations: `libs/shared/src/lib/canonical-persistence/drizzle/` from `libs/shared/src/lib/canonical-persistence/schema.ts`.
- PostgreSQL URL for migration tooling only - Drizzle generation/migrate workflows can target a conventional Postgres URL.
  - Connection: `MAGAM_CANONICAL_DB_URL` in `drizzle.canonical.config.ts`, defaulting to `postgres://postgres:postgres@localhost:5432/magam_canonical`.
  - Client: Drizzle Kit config only; runtime persistence still uses local PGlite in `libs/shared/src/lib/canonical-persistence/pglite-db.ts`.

**File Storage:**
- Local filesystem only - Workspace source files and uploaded assets live under the selected target directory.
  - Source files: `libs/cli/src/server/http.ts` and `libs/cli/src/commands/dev.ts` enumerate `**/*.tsx` inside `MAGAM_TARGET_DIR`.
  - Uploads: `app/app/api/assets/upload/route.ts` writes images into `assets/images` beneath the workspace root.
  - Reads: `app/app/api/assets/file/route.ts` serves local files after extension and path validation.

**Caching:**
- None external.
  - `libs/cli/src/server/http.ts` keeps an in-memory render cache keyed by source hashes, controlled by `MAGAM_RENDER_CACHE_MAX` and `MAGAM_RENDER_CACHE_TTL_MS`.

## Authentication & Identity

**Auth Provider:**
- None detected for end-user accounts.
  - Implementation: no login, OAuth, cookie session, or bearer token flow is present in `app/app/api/**`, `app/ws/server.ts`, or `libs/cli/src/server/http.ts`.
  - Token storage: not applicable.
  - Session management: chat sessions are application data stored in SQLite via `libs/cli/src/chat/repository/schema.ts`, not user-auth sessions.

**OAuth Integrations:**
- Not detected.

## Monitoring & Observability

**Error Tracking:**
- None detected.
  - DSN: not applicable.
  - Release tracking: not applicable.

**Analytics:**
- None detected.

**Logs:**
- stdout/stderr plus Pino.
  - Integration: structured logging in `libs/core/src/logger.ts` and `app/processes/canvas-runtime/keyboard/trace.ts`; service processes also log directly in `cli.ts`, `app/ws/server.ts`, and `libs/cli/src/server/http.ts`.

## CI/CD & Deployment

**Hosting:**
- Local multi-process composition is the only concrete runtime target detected in tracked files.
  - Deployment: `cli.ts` launches the local HTTP server from `libs/cli/src/bin.ts`, the WebSocket server from `app/ws/server.ts`, and the Next dev server from `app/package.json`.
  - Environment vars: forwarded and coordinated in `cli.ts` and `scripts/dev/app-dev.ts`.
- Build artifact path only - `app/package.json` exposes `next build` and `next start`, but no Vercel, Docker, or other hosted deployment config is present in tracked files.

**CI Pipeline:**
- Not detected.
  - Workflows: no `.github/workflows/*` files were found.
  - Secrets: not applicable in tracked repo config.

## Environment Configuration

**Development:**
- Required env vars: `MAGAM_TARGET_DIR`, `MAGAM_HTTP_PORT`, `MAGAM_WS_PORT`, and `NEXT_PUBLIC_MAGAM_WS_PORT` wire the local app, HTTP service, and WebSocket service across `cli.ts`, `scripts/dev/app-dev.ts`, `app/ws/server.ts`, and `app/hooks/useFileSync.shared.ts`.
- Persistence overrides: `MAGAM_CHAT_DB_PATH`, `MAGAM_CANONICAL_DB_PATH`, and `MAGAM_WORKSPACE_ID` are consumed by `libs/cli/src/chat/repository/db.ts`, `libs/shared/src/lib/canonical-persistence/pglite-db.ts`, and `libs/cli/src/headless/bootstrap.ts`.
- Optional runtime tuning: `MAGAM_CANONICAL_DB_URL`, `MAGAM_CHAT_TIMEOUT_MS`, `MAGAM_RENDER_CACHE_MAX`, `MAGAM_RENDER_CACHE_TTL_MS`, `MAGAM_WS_ENABLE_FILE_MUTEX`, `LOG_LEVEL`, `NEXT_PUBLIC_LOG_LEVEL`, and warm-up envs in `cli.ts`.
- Secrets location: no tracked `.env*` or credential file is detected; provider authentication is delegated to the installed `claude`, `gemini`, and `codex` CLIs.
- Mock/stub services: not required for core local operation; render, file tree, chat persistence, and websocket sync all run locally.

**Staging:**
- Not detected.

**Production:**
- Secrets management: not detected in tracked files.
- Failover/redundancy: not detected; caches, provider detection, and websocket client maps are process-local in `libs/cli/src/server/http.ts`, `libs/cli/src/chat/detector.ts`, and `app/ws/server.ts`.

## Webhooks & Callbacks

**Incoming:**
- None detected.
  - No webhook receiver, signature verification, or callback-specific endpoint is present in `app/app/api/**` or `libs/cli/src/server/http.ts`.

**Outgoing:**
- Local process calls only.
  - Next route handlers proxy to `http://localhost:${MAGAM_HTTP_PORT}` in `app/app/api/render/route.ts`, `app/app/api/files/route.ts`, `app/app/api/file-tree/route.ts`, and `app/app/api/chat/*`.
  - Chat adapters spawn `claude`, `gemini`, or `codex` child processes from `libs/cli/src/chat/adapters/cli-runner.ts`.
  - Remote URL image ingestion is intentionally rejected in `app/app/api/assets/upload/route.ts`, so no outbound fetch-to-upload integration is active.

---

*Integration audit: 2026-03-19*
*Update when adding/removing external services*
