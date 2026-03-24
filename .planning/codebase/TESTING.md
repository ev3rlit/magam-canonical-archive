# Testing Patterns

**Analysis Date:** 2026-03-19

## Test Framework

**Runner:**
- Root default runner is Bun via `package.json` (`"test": "bun test"`). Most app, WS, script, and ESLint plugin tests import from `bun:test`: `app/ws/filePatcher.test.ts`, `app/store/graph.test.ts`, `scripts/dev/app-dev.test.ts`, `.eslint/magam-plugin.test.ts`.
- Vitest is used for route, store, CLI, and shared-library specs that import `vitest`: `app/store/chat.spec.ts`, `app/app/api/assets/file/route.spec.ts`, `libs/cli/src/commands/image.spec.ts`, `libs/shared/src/lib/canonical-persistence/validators.spec.ts`.
- CLI has an explicit Vitest config in `libs/cli/vitest.config.mts`.
- Jest/Nx config still exists at `jest.config.ts`, `jest.preset.js`, `libs/core/jest.config.cts`, and `libs/runtime/jest.config.cts`, and some older specs still use Jest globals: `libs/runtime/src/lib/runtime.spec.ts`, `libs/core/src/__tests__/publicApiBoundary.spec.ts`.
- Browser E2E uses Playwright from `playwright.config.ts`.

**Assertion Library:**
- Bun, Vitest, and Jest files all use their built-in `expect` APIs.
- Playwright E2E uses `expect` from `@playwright/test`.
- Common matcher style is behavioral and explicit: `toEqual`, `toMatchObject`, `toContain`, `toBe`, `rejects.toThrow`, `resolves.toEqual`.

**Run Commands:**
```bash
bun test                                                # Run the repo's default unit/spec suite
bun test --watch                                        # Watch mode for Bun-driven tests
bun test app/ws/filePatcher.test.ts                     # Run a single Bun test file
bunx vitest --config libs/cli/vitest.config.mts         # Run the dedicated CLI Vitest suite
bunx vitest --config libs/cli/vitest.config.mts --coverage  # CLI coverage report (V8)
bun run test:e2e                                        # Playwright end-to-end tests
```

## Test File Organization

**Location:**
- Most app and WS tests are co-located with the source they exercise: `app/components/ContextMenu.test.tsx`, `app/features/render/parseRenderGraph.test.ts`, `app/ws/methods.test.ts`.
- CLI tests are co-located under `libs/cli/src/**`: `libs/cli/src/server/http.spec.ts`, `libs/cli/src/commands/image.integration.spec.ts`.
- Shared library tests are also co-located: `libs/shared/src/lib/canonical-persistence/validators.spec.ts`.
- `libs/core` mixes `src/__tests__/` for public-surface/component tests with nearby `*.spec.ts(x)` files in implementation folders such as `libs/core/src/layout/elk.spec.ts` and `libs/core/src/reconciler/resolveTreeAnchors.spec.ts`.
- E2E tests live in a separate `e2e/` tree and rely on `playwright.config.ts`.

**Naming:**
- `*.test.ts(x)` is common for Bun-focused app tests: `app/ws/filePatcher.test.ts`, `app/features/editing/actionRoutingBridge.test.ts`.
- `*.spec.ts(x)` is common for Vitest and older library tests: `app/store/chat.spec.ts`, `libs/cli/src/server/websocket.spec.ts`, `libs/core/src/__tests__/publicApiBoundary.spec.ts`.
- `*.integration.spec.ts` marks filesystem or route integration tests that use real temp directories: `app/app/api/assets/file/route.integration.spec.ts`, `libs/cli/src/commands/image.integration.spec.ts`.
- Playwright follows `*.spec.ts` inside `e2e/`: `e2e/chat-session-management.spec.ts`, `e2e/tabs.spec.ts`.

**Structure:**
```text
app/
  components/
    ContextMenu.tsx
    ContextMenu.test.tsx
  features/
    render/
      parseRenderGraph.ts
      parseRenderGraph.test.ts
  ws/
    filePatcher.ts
    filePatcher.test.ts
  app/api/assets/file/
    route.ts
    route.spec.ts
    route.integration.spec.ts

libs/cli/src/
  commands/
    image.ts
    image.spec.ts
    image.integration.spec.ts
  server/
    http.ts
    http.spec.ts

libs/core/src/
  __tests__/
    publicApiBoundary.spec.ts
  layout/
    elk.ts
    elk.spec.ts

e2e/
  chat-session-management.spec.ts
```

## Test Structure

**Suite Organization:**
```typescript
describe('chat store payload serialization', () => {
  it('serializes selected model and effort into send payload', async () => {
    let capturedBody: Record<string, unknown> | null = null;

    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.body) {
        capturedBody = JSON.parse(String(init.body));
      }
      return new Response('', {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      });
    });

    vi.spyOn(globalThis, 'fetch').mockImplementation(
      fetchMock as unknown as typeof fetch,
    );

    await useChatStore.getState().sendMessage({ content: 'hello world' });

    expect(capturedBody).toMatchObject({
      message: 'hello world',
      providerId: 'claude',
    });
  });
});
```

**Patterns:**
- Tests are organized around a single module-level `describe(...)` with focused behavioral `it(...)` cases: `app/features/editing/actionRoutingBridge.test.ts`, `libs/shared/src/lib/canonical-persistence/validators.spec.ts`.
- `beforeEach` and `afterEach` reset mocks, stores, temp directories, or environment state instead of relying on process-global ordering: `app/store/chat.spec.ts`, `app/ws/filePatcher.test.ts`, `libs/cli/src/commands/image.spec.ts`, `app/app/api/assets/file/route.integration.spec.ts`.
- Behavior descriptions are precise and can be English or Korean. Match the dominant language in the file you edit: `app/ws/filePatcher.test.ts`, `app/ws/methods.mutex.test.ts`, `app/store/chat.spec.ts`.
- Assertions usually target the observable contract, not internals: HTTP status and error codes in `app/app/api/assets/file/route.spec.ts`, generated TSX snippets in `app/ws/filePatcher.test.ts`, response payloads in `libs/cli/src/server/http.spec.ts`.

## Mocking

**Framework:**
- Bun uses `mock.module(...)` for ESM-safe dependency replacement, usually followed by top-level `await import(...)`: `app/hooks/useContextMenu.test.ts`, `app/features/canvas-ui-entrypoints/pane-context-menu/paneMenuItems.test.ts`, `app/processes/canvas-runtime/createCanvasRuntime.test.ts`.
- Vitest uses `vi.mock(...)`, `vi.mocked(...)`, and `vi.spyOn(...)`: `app/store/chat.spec.ts`, `libs/cli/src/commands/image.spec.ts`, `libs/cli/src/server/http.spec.ts`, `libs/cli/src/server/websocket.spec.ts`.
- Jest is still used in older runtime/core specs with `jest.mock(...)` and timer control: `libs/runtime/src/lib/runtime.spec.ts`.

**Patterns:**
```typescript
mock.module('lucide-react', () => ({
  Download: () => null,
  FileText: () => null,
}));

const { paneMenuItems } = await import('./paneMenuItems');

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
}));

const mockedReadFile = vi.mocked(readFile);
const mockedWriteFile = vi.mocked(writeFile);
```

**What to Mock:**
- Node and browser boundaries: `node:fs/promises`, `fs`, `child_process`, `ws`, `net`, global `fetch`, and `process.cwd()` in `libs/cli/src/commands/image.spec.ts`, `libs/cli/src/chat/adapters/cli-runner.spec.ts`, `libs/cli/src/server/websocket.spec.ts`, `app/store/chat.spec.ts`.
- UI-only dependencies that add noise but not behavior, especially icons: `lucide-react` in `app/hooks/useContextMenu.test.ts`, `app/processes/canvas-runtime/createCanvasRuntime.test.ts`.
- External handlers and servers at integration boundaries: `ChatHandler` in `libs/cli/src/server/http.spec.ts`, route network stubs in `e2e/chat-session-management.spec.ts`.

**What NOT to Mock:**
- Pure validation, transformation, and registry logic is usually exercised directly: `app/features/render/parseRenderGraph.test.ts`, `app/features/workspace-styling/eligibility.test.ts`, `libs/shared/src/lib/canonical-persistence/validators.spec.ts`.
- File patcher tests do not mock Babel internals; they write real TSX fixtures to temp directories and read back the mutated file in `app/ws/filePatcher.test.ts`.
- Public API boundary tests import the actual package barrel instead of mocking exports: `libs/core/src/__tests__/publicApiBoundary.spec.ts`.

## Fixtures and Factories

**Test Data:**
```typescript
function buildBaseRecord(overrides?: Partial<CanonicalObjectRecord>): CanonicalObjectRecord {
  return {
    id: 'note-1',
    workspaceId: 'ws-1',
    semanticRole: 'sticky-note',
    publicAlias: 'Sticky',
    sourceMeta: { sourceId: 'note-1', kind: 'canvas' },
    capabilities: {},
    contentBlocks: [{ id: 'body-1', blockType: 'text', text: 'hello' }],
    primaryContentKind: 'text',
    canonicalText: 'hello',
    ...overrides,
  };
}
```

**Location:**
- Small factories are usually defined inline inside the spec: `buildBaseRecord` in `libs/shared/src/lib/canonical-persistence/validators.spec.ts`, `createDeferred` in `app/ws/methods.mutex.test.ts`.
- Reusable source fixtures live in nearby `__fixtures__` modules: `app/ws/__fixtures__/bidirectional-editing`, `app/features/editing/__fixtures__/actionRoutingBridgeFixtures`, `app/features/render/__fixtures__/objectCapabilityFixtures.tsx`.
- Temporary integration fixtures are built with `mkdtemp(...)` and cleaned up in `afterEach(...)`: `app/ws/filePatcher.test.ts`, `app/app/api/assets/file/route.integration.spec.ts`, `libs/cli/src/commands/image.integration.spec.ts`.

## Coverage

**Requirements:**
- No repo-wide coverage threshold is enforced in the checked-in config.
- Coverage is explicitly configured only for CLI Vitest in `libs/cli/vitest.config.mts`.
- Jest configs define coverage output directories for `libs/core` and `libs/runtime`, but no threshold policy is checked in there either.

**Configuration:**
- CLI Vitest uses the V8 coverage provider and writes to `coverage/libs/cli` from `libs/cli/vitest.config.mts`.
- `libs/core/jest.config.cts` writes coverage to `coverage/libs/core`.
- `libs/runtime/jest.config.cts` writes coverage to `coverage/libs/runtime`.

**View Coverage:**
```bash
bunx vitest --config libs/cli/vitest.config.mts --coverage
bunx jest --config libs/core/jest.config.cts --coverage
bunx jest --config libs/runtime/jest.config.cts --coverage
```

## Test Types

**Unit Tests:**
- Most app and library tests are pure unit or small contract tests against stores, reducers, validators, and registry builders: `app/store/chat.spec.ts`, `app/features/workspace-styling/diagnostics.test.ts`, `libs/shared/src/lib/canonical-persistence/validators.spec.ts`.
- UI contribution tests validate shape and gating of menu/runtime models without rendering the whole app: `app/features/canvas-ui-entrypoints/pane-context-menu/paneMenuItems.test.ts`, `app/processes/canvas-runtime/createCanvasRuntime.test.ts`.
- Public API surface tests assert export boundaries: `libs/core/src/__tests__/publicApiBoundary.spec.ts`.

**Integration Tests:**
- File and route integrations use real filesystem state in temp directories and call actual handlers: `app/ws/filePatcher.test.ts`, `app/app/api/assets/file/route.integration.spec.ts`, `app/app/api/assets/upload/route.integration.spec.ts`.
- CLI integration tests build a temporary workspace and exercise the command against it rather than mocking every layer: `libs/cli/src/commands/image.integration.spec.ts`.
- Server integration-style specs spin up an HTTP server with mocked adapters and make real `fetch` calls to its endpoints: `libs/cli/src/server/http.spec.ts`.

**E2E Tests:**
- Playwright drives the app through the browser using `@playwright/test`: `e2e/chat-session-management.spec.ts`, `e2e/tabs.spec.ts`.
- `playwright.config.ts` starts the Next app with `cd app && bun run dev -- --hostname 127.0.0.1 --port 4173` and points tests at `http://127.0.0.1:4173`.
- E2E tests stub backend routes with `page.route(...)` so the browser flow is real while the backend contract is controlled.

## Common Patterns

**Async Testing:**
```typescript
it('blocks traversal attempts', async () => {
  const { GET } = await loadRoute();
  const response = await GET(new Request('http://localhost/api/assets/file?path=../../etc/passwd'));

  expect(response.status).toBe(400);
  const body = await response.json();
  expect(body.code).toBe('IMG_400_INVALID_SOURCE');
});

await expect(runWithOptionalFileMutex('failure-file', async () => {
  throw new Error('boom');
})).rejects.toThrow('boom');
```

**Error Testing:**
```typescript
it('style update rejects disallowed patch keys with explicit bridge error', async () => {
  const response = await dispatchActionRoutingIntent(/* ... */);

  expect(response.error?.code).toBe('PATCH_SURFACE_VIOLATION');
  expect(response.error?.rpcCode).toBe(42211);
});

it('fails when required arguments are missing', async () => {
  await expect(insertImageCommand([
    '--source', SOURCE_FILE,
    '--mode', 'node',
    '--target', 'target',
  ])).rejects.toThrow('process exit');
});
```

**Snapshot Testing:**
- Snapshot matchers are not part of the current test style. No `toMatchSnapshot` or `__snapshots__` usage was detected in tracked source tests.
- When tests need a snapshot-like check, they assert explicit serialized output instead, such as patched TSX strings in `app/ws/filePatcher.test.ts` or exported object shapes in `app/processes/canvas-runtime/createCanvasRuntime.test.ts`.

---

*Testing analysis: 2026-03-19*
*Update when test patterns change*
