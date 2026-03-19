# Coding Conventions

**Analysis Date:** 2026-03-19

## Naming Patterns

**Files:**
- React component files use `PascalCase.tsx` for exported UI modules: `app/components/GraphCanvas.tsx`, `app/components/nodes/BaseNode.tsx`.
- Feature, store, hook, and utility modules use lower camel case filenames: `app/store/graph.ts`, `app/features/render/parseRenderGraph.ts`, `app/components/editor/workspaceEditUtils.ts`.
- Companion contract files use dotted suffixes instead of nested filenames: `app/features/editing/actionRoutingBridge.types.ts`, `app/components/GraphCanvas.viewport.ts`, `app/components/GraphCanvas.relayout.ts`.
- Kebab-case is used for feature directories that model UI surfaces or subsystems: `app/features/canvas-ui-entrypoints/pane-context-menu/`, `app/features/overlay-host/`.
- Barrel files are explicit package or feature boundaries: `libs/core/src/index.ts`, `libs/shared/src/index.ts`, `libs/runtime/src/index.ts`, `app/features/workspace-styling/index.ts`.
- Tests are either co-located as `*.test.ts(x)` / `*.spec.ts(x)` or grouped in `__tests__`: `app/ws/filePatcher.test.ts`, `app/store/chat.spec.ts`, `libs/core/src/__tests__/publicApiBoundary.spec.ts`.

**Functions:**
- Use `camelCase` for all functions, including async functions: `parseRenderGraph`, `runWithOptionalFileMutex`, `validateCapabilityBag`, `createCanvasKeyboardTraceSink`.
- Factory helpers usually start with `create` or `build`: `createActionRoutingBridgeError` in `app/features/editing/actionRoutingErrors.ts`, `buildPaperTextureStyle` in `app/components/nodes/BaseNode.tsx`.
- Resolver helpers use `resolve*`: `resolveTraceLevel` in `app/processes/canvas-runtime/keyboard/trace.ts`, `resolveWorkspaceFilePath` in `app/ws/methods.ts`.
- Guards and contract checks use `is*`, `ensure*`, or `assert*`: `isRecord` in `libs/shared/src/lib/canonical-persistence/validators.ts`, `ensureString` in `app/ws/methods.ts`, `assertContentContractPatchAllowed` in `app/ws/filePatcher.ts`.
- CLI entry points use `run*Command`: `runObjectCommand` in `libs/cli/src/commands/object.ts`, `runSearchCommand` in `libs/cli/src/commands/search.ts`.

**Variables:**
- Local variables and state fields use `camelCase`: `workspaceStyleByNodeId` in `app/store/graph.ts`, `logPayload` in `app/processes/canvas-runtime/keyboard/trace.ts`.
- Module-level constants use `UPPER_SNAKE_CASE`: `DEFAULT_MINDMAP_SPACING` in `app/features/render/parseRenderGraph.ts`, `KEYBOARD_TRACE_SUBSYSTEM` in `app/processes/canvas-runtime/keyboard/trace.ts`, `RPC_ERRORS` in `app/ws/rpc.ts`.
- Boolean flags use `is*`, `has*`, `can*`, or `should*`: `isFileMutexEnabled` in `app/ws/methods.ts`, `hasPattern` in `app/components/nodes/BaseNode.tsx`.
- Mock variables in tests are prefixed with `mock` or `mocked`: `mockChatGetProviders` in `libs/cli/src/server/http.spec.ts`, `mockedReadFile` in `libs/cli/src/commands/image.spec.ts`.

**Types:**
- Interfaces and type aliases use `PascalCase` with no `I` prefix: `ActionRoutingResult`, `CanonicalObjectExpectation`, `PluginInstanceRuntimeRecord`.
- Discriminated union aliases are used heavily for boundary contracts: `ActionRoutingSurfaceId` in `app/features/editing/actionRoutingBridge/types.ts`, `CanvasBackgroundStyle` in `app/store/graph.ts`.
- Result, error, context, and descriptor types are named by role: `ActionRoutingError`, `RpcContext`, `DispatchDescriptor`, `PersistenceResult`.
- Prefer `satisfies` to lock literal registry structure without widening: `app/features/canvas-ui-entrypoints/pane-context-menu/contribution.ts`, `app/features/canvas-ui-entrypoints/canvas-toolbar/toolbarActions.ts`, `app/utils/lucideRegistry.ts`.

## Code Style

**Formatting:**
- Prettier is present in `.prettierrc` and only enforces `singleQuote: true`.
- `.editorconfig` is the stronger shared formatter contract: UTF-8, spaces, `indent_size = 2`, trailing whitespace trimmed, final newline required.
- Semicolons are used consistently in source and tests: `app/store/graph.ts`, `libs/shared/src/lib/canonical-persistence/validators.ts`, `libs/cli/src/server/http.spec.ts`.
- Formatting is not fully normalized repo-wide. Most app and test files use 2-space indentation (`app/components/GraphCanvas.tsx`, `app/store/chat.spec.ts`), while older WS/core/config files still use 4 spaces (`app/ws/filePatcher.ts`, `app/ws/methods.ts`, `app/ws/rpc.ts`, `eslint.config.mjs`). Preserve the surrounding file style instead of reflowing unrelated lines.

**Linting:**
- Root ESLint uses flat config in `eslint.config.mjs` with `@eslint/js` and `typescript-eslint` recommended presets.
- A custom rule, `magam/no-duplicate-ids`, is enforced as an error and tested in `.eslint/magam-plugin.test.ts`.
- `@typescript-eslint/no-explicit-any` is only a warning, so older interop and parser-heavy files still contain escape hatches such as `children?: any` in `app/features/render/parseRenderGraph.ts` and `(PinoPkg as any)` in `libs/core/src/logger.ts`.
- `@typescript-eslint/no-unused-vars` warns, with `_`-prefixed arguments exempted.
- No global lint rule enforces import sorting, `console` bans, or layered architecture boundaries. Future edits should follow the local file pattern instead of assuming automation will fix ordering.

## Import Organization

**Order:**
1. External runtime packages first in UI and library modules: `react`, `reactflow`, `zustand`, `pino`, `vitest`, `bun:test`.
2. Workspace aliases second: `@/` inside `app` and `@magam/*` across packages, as seen in `app/components/GraphCanvas.tsx`, `app/store/graph.ts`, `libs/cli/src/commands/object.ts`.
3. Relative imports last for nearby collaborators: `./rpc`, `./filePatcher`, `../headless/options`, `./types`.
4. `import type` is used aggressively and usually split into dedicated statements near the module they describe: `app/store/graph.ts`, `app/features/render/parseRenderGraph.ts`, `app/components/editor/workspaceEditUtils.ts`.

**Grouping:**
- Blank lines usually separate major groups, but exact grouping is manual rather than enforced: compare `app/components/GraphCanvas.tsx` with `app/store/graph.ts`.
- Side-effect imports stay near the owning package import: `import 'reactflow/dist/style.css';` in `app/components/GraphCanvas.tsx`.
- Tests that use Bun module mocking delay imports with top-level `await import(...)` after `mock.module(...)`: `app/hooks/useContextMenu.test.ts`, `app/processes/canvas-runtime/createCanvasRuntime.test.ts`.

**Path Aliases:**
- `app/tsconfig.json` defines `@/*` for the `app` workspace root and maps `@magam/core` to `../libs/core/src`.
- `tsconfig.base.json` defines workspace package aliases: `@magam/shared`, `@magam/core`, `@magam/cli`, `@magam/runtime`.
- `libs/cli/vitest.config.mts` still carries legacy `@graphwrite/shared` and `@graphwrite/core` aliases for CLI-only tests. Keep that in mind when moving CLI tests or config.

## Error Handling

**Patterns:**
- Core feature logic prefers tagged result objects over exceptions until a transport boundary is reached: `ActionRoutingResult<T>` in `app/features/editing/actionRoutingBridge/types.ts`, `ActionRoutingGateResult` usage in `app/features/editing/actionGating.ts`, `PersistenceResult<T>` conversion in `libs/shared/src/lib/canonical-persistence/validators.ts`.
- Transport and mutation boundaries throw structured errors with codes and diagnostic payloads: `createActionRoutingBridgeError` in `app/features/editing/actionRoutingErrors.ts`, `buildRpcLikeError` in `app/ws/filePatcher.ts`, `RPC_ERRORS` in `app/ws/rpc.ts`.
- Input validation is explicit and local. Add `is*`, `ensure*`, or `assert*` helpers instead of broad `try/catch`: `ensureString` / `ensureRecord` in `app/ws/methods.ts`, `isRecord` in `libs/shared/src/lib/canonical-persistence/validators.ts`.
- Mutating flows are contract-first. UI intent payloads are normalized into `OrderedDispatchPlan` descriptors in `app/features/editing/actionRoutingBridge/types.ts`, gated in `app/features/editing/actionGating.ts`, version-checked and optionally serialized in `app/ws/methods.ts`, then applied as AST patches in `app/ws/filePatcher.ts`.
- Safety checks are whitelist-oriented. Style patches are filtered through `pickStylePatch` in `app/features/editing/actionGating.ts`; AST patching blocks runtime-only plugin keys and invalid content fields in `app/ws/filePatcher.ts`.

**Error Types:**
- JSON-RPC uses stable numeric error codes and machine-readable messages from `app/ws/rpc.ts`.
- App feature code often returns `{ ok: false, error: { code, message, details } }` rather than throwing: `app/features/editing/actionRoutingBridge/types.ts`.
- Validation routines return path-aware failures rather than exceptions: `invalidValidation(...)` usage in `libs/shared/src/lib/canonical-persistence/validators.ts`.
- When a helper must throw, it usually throws a purpose-built error or RPC-like object rather than a generic silent fallback: `throwContentContractViolation` in `app/ws/filePatcher.ts`, `assertActionPayloadGate` in `app/features/editing/actionGating.ts`.

## Logging

**Framework:**
- Structured app/runtime logging uses `pino`: `app/processes/canvas-runtime/keyboard/trace.ts`, `libs/core/src/logger.ts`.
- Operator-facing CLI and WS entry points still use `console.log`, `console.warn`, and `console.error`: `app/ws/server.ts`, `libs/cli/src/bin.ts`, `libs/cli/src/commands/dev.ts`.

**Patterns:**
- Pino loggers emit structured context objects plus a message string: `logger[level](logPayload, event.event)` in `app/processes/canvas-runtime/keyboard/trace.ts`, `this.logger.info(context, message)` in `libs/core/src/logger.ts`.
- Logging is usually concentrated at process or boundary layers, not inside pure validators and reducers.
- Tests either silence logging implicitly via `NODE_ENV === 'test'` in `app/processes/canvas-runtime/keyboard/trace.ts` or stub console methods directly with `vi.spyOn(console, ...)` as in `libs/cli/src/commands/image.spec.ts`.

## Comments

**When to Comment:**
- Use comments and docblocks to explain boundary modules, interop quirks, or non-obvious rendering logic: `app/ws/filePatcher.ts`, `app/ws/rpc.ts`, `libs/core/src/logger.ts`, `app/components/nodes/BaseNode.tsx`.
- Inline comments in tests often explain sequencing or mock timing rather than restating assertions: `libs/runtime/src/lib/runtime.spec.ts`, `libs/cli/src/server/websocket.spec.ts`.
- Obvious line-by-line narration is uncommon in newer app code. Prefer extracting a helper over leaving dense inline commentary.

**JSDoc/TSDoc:**
- Lightweight docblocks appear on exported helpers and prop contracts when behavior is easy to misuse: `NoiseOverlay` and `BaseNodeProps` in `app/components/nodes/BaseNode.tsx`.
- Public package barrels such as `libs/core/src/index.ts` and `libs/shared/src/index.ts` rely on strong naming and export structure more than heavy API docs.

**TODO Comments:**
- TODOs use plain `TODO:` comments without owner or issue metadata: `app/app/api/chat/providers/route.ts`, `app/components/chat/SetupGuide.tsx`.
- Treat TODOs as local reminders, not as a formal tracking system.

## Function Design

**Size:**
- Coordinators can be large when they own an integration boundary, but they are usually supported by many small guards and builders: `app/ws/methods.ts`, `app/components/GraphCanvas.tsx`, `libs/shared/src/lib/canonical-persistence/validators.ts`.
- Helper extraction is preferred for reusable checks and payload shaping: `createIntentScopedDiagnostics` appears in both `app/ws/filePatcher.ts` and `app/ws/methods.ts`, and small `isRecord`/`isString` guards are common.

**Parameters:**
- Object parameters are preferred when a function needs multiple related options or may grow: `createCanvasKeyboardTraceSink(input?)`, `resolvePaperSurface(input)`, `createActionRoutingBridgeError(input)`.
- Positional arguments remain common for short, mechanical helpers: `ensureString(value, fieldName)`, `patchNodePosition(filePath, nodeId, x, y)`.
- Future mutations should add fields to typed input objects before adding positional flags.

**Return Values:**
- Early returns and guard clauses are standard: `parseRenderGraph` in `app/features/render/parseRenderGraph.ts`, `gateActionPayload` in `app/features/editing/actionGating.ts`, `validateCapabilityBag` in `libs/shared/src/lib/canonical-persistence/validators.ts`.
- Prefer explicit unions and narrow records over implicit `undefined` success/failure channels.
- TypeScript strict mode is enabled in `app/tsconfig.json`, `libs/core/tsconfig.json`, `libs/shared/tsconfig.json`, `libs/cli/tsconfig.json`, and `libs/runtime/tsconfig.json`; future edits should preserve that discipline with `import type`, type guards, discriminated unions, and `satisfies`.

## Module Design

**Exports:**
- Named exports are the default in app and library code: `app/features/editing/actionRoutingBridge/types.ts`, `app/processes/canvas-runtime/keyboard/trace.ts`, `libs/shared/src/lib/canonical-persistence/validators.ts`.
- Default exports are mostly reserved for framework entry points or legacy component files, not general utilities.
- Public package surfaces are centralized through barrels: `libs/core/src/index.ts`, `libs/shared/src/index.ts`, `libs/runtime/src/index.ts`, `libs/cli/src/index.ts`.

**Barrel Files:**
- Use barrels for stable public APIs and feature bundles, not for every directory: `app/features/workspace-styling/index.ts`, `app/features/plugin-runtime/index.ts`, `libs/shared/src/lib/canonical-persistence/index.ts`.
- Internal collaborators often still import direct leaf modules when they need local implementation details. Follow the existing boundary of the area you edit instead of introducing a new barrel casually.

---

*Convention analysis: 2026-03-19*
*Update when patterns change*
