# React Environment Workaround

## Problem Description

When using Magam within a Next.js application (via `/api/render` route), we encounter a conflict between Next.js's server-side React and the client-side React required by `react-reconciler`.

### The Core Issue

Next.js Route Handlers run in a "React Server Components" environment by default. This environment provides a specialized "Server React" that:

1. **Lacks `__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED`** - This internal API is required by `react-reconciler` to create custom renderers
2. **Has different module resolution** - `require('react')` in a Route Handler may resolve to `react-server` instead of the full client React

### Why This Matters

Magam uses `react-reconciler` to create a custom renderer that converts React elements to graph structures. The reconciler absolutely requires access to React internals that only exist in the "client" version of React.

## Current Workaround

The workaround in `app/app/api/render/route.ts` manually loads the client React:

```typescript
// Force load client React from node_modules
const reactDir = reactPath.substring(
  0,
  reactPath.lastIndexOf('node_modules/react') + 'node_modules/react'.length
);
const devPath = join(reactDir, 'cjs/react.development.js');
ReactClient = require(devPath);

// Bridge internals to global
(global as any).React = ReactClient;
const internals = ReactClient.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED;
```

### How It Works

1. **Path Resolution**: Find the actual `node_modules/react` directory
2. **Direct CJS Loading**: Load `react/cjs/react.development.js` directly, bypassing Next.js module aliasing
3. **Global Injection**: Set the loaded React as `global.React` and ensure internals are available
4. **Custom Require**: Create a custom `require` function that intercepts `react` imports

## Risks and Mitigations

### Risks

| Risk | Severity | Description |
|------|----------|-------------|
| Version Mismatch | High | If loaded React differs from what `react-reconciler` was built against |
| Bundle Pollution | Medium | Global React may leak into other parts of the application |
| Build Changes | Medium | Next.js internal paths may change between versions |
| Performance | Low | Additional module loading at runtime |

### Mitigations

1. **Version Pinning**: Ensure `react`, `react-reconciler`, and Next.js versions are compatible
2. **Scope Isolation**: The workaround only affects the specific API route
3. **Fallback Logic**: Multiple path candidates are tried before failing
4. **Explicit Runtime**: Route uses `export const runtime = 'nodejs'` to ensure Node.js runtime

## Long-term Alternatives

### Option 1: Separate Worker Process

Run Magam rendering in a completely separate Node.js process:

```typescript
// Spawn isolated worker
const worker = fork('./render-worker.js');
worker.send({ code: userCode });
```

**Pros**: Complete isolation, no React conflicts
**Cons**: IPC overhead, process management complexity

### Option 2: Edge Runtime with WASM

Compile core rendering to WebAssembly:

```typescript
export const runtime = 'edge';
const { renderToGraph } = await import('./magam.wasm');
```

**Pros**: Consistent environment, fast cold starts
**Cons**: Complex toolchain, WASM limitations

### Option 3: Dedicated Render Server

Run a separate Express/Fastify server just for rendering:

```typescript
// Separate server on port 3002
app.post('/render', async (req, res) => {
  const result = await renderToGraph(req.body.code);
  res.json(result);
});
```

**Pros**: Full control over Node.js environment
**Cons**: Additional infrastructure, CORS handling

### Option 4: Build-time Rendering (SSG)

Pre-render graphs at build time where possible:

```typescript
// In getStaticProps or generateStaticParams
const graphs = await Promise.all(files.map(renderToGraph));
```

**Pros**: No runtime conflicts
**Cons**: Only works for static content

## Recommended Path Forward

For production stability, we recommend **Option 3: Dedicated Render Server**:

1. Create a minimal Fastify server with Magam
2. Run alongside Next.js app
3. Proxy requests from Next.js API route to render server
4. Use WebSocket for real-time updates

This provides:
- Clean separation of concerns
- Predictable React environment
- Easy horizontal scaling of render workload
- No Next.js version coupling

## Related Files

- `app/app/api/render/route.ts` - Current workaround implementation
- `libs/core/src/renderer.ts` - Core reconciler setup
- `libs/shared/src/lib/module-resolution.ts` - Shared module resolution utilities
