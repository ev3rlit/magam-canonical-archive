# Frame Reference

This guide covers `frame(...)` as the high-level reusable composition API in Magam.

Use `frame(...)` when you want a reusable graph component that:

- keeps local ids inside the component
- mounts into `Canvas` or `MindMap`
- can be instantiated multiple times without id collisions
- can contain child frames

## Import

```tsx
import { Canvas, MindMap, Node, Shape, Edge, Text, frame } from '@magam/core';
```

## Core Rule

Inside a frame, keep ids local.

```tsx
const ServiceFrame = frame(function ServiceFrame({ label }: { label: string }) {
  return (
    <>
      <Shape id="app" x={0} y={0}>{label} Service</Shape>
      <Shape id="db" anchor="app" position="bottom" gap={48}>Database</Shape>
      <Edge from="app" to="db" label="query" />
    </>
  );
});
```

The runtime expands those ids when mounted.

- `app` -> `auth.app`
- `db` -> `auth.db`

## Canvas Example

```tsx
const ServiceFrame = frame(function ServiceFrame({ label }: { label: string }) {
  return (
    <>
      <Shape id="lb" x={0} y={0} width={120} height={50}>Load Balancer</Shape>
      <Shape id="app" anchor="lb" position="bottom" gap={48} width={140} height={56}>
        {label} Service
      </Shape>
      <Shape id="db" anchor="app" position="bottom" gap={48} width={120} height={50}>
        Database
      </Shape>
      <Edge from="lb" to="app" label="route" />
      <Edge from="app" to="db" label="query" />
    </>
  );
});

export default function FrameCanvasExample() {
  return (
    <Canvas>
      <Text id="title" x={0} y={-120}>Frame Canvas Example</Text>
      <ServiceFrame id="auth" x={80} y={80} label="Auth" />
      <ServiceFrame id="billing" anchor="auth.db" position="right" gap={220} label="Billing" />
    </Canvas>
  );
}
```

## MindMap Example

```tsx
const DatabaseFrame = frame(function DatabaseFrame({ label }: { label: string }) {
  return (
    <>
      <Node id="store">{label}</Node>
      <Node id="replica" from="store">Replica</Node>
    </>
  );
});

const ServiceFrame = frame(function ServiceFrame({ label }: { label: string }) {
  return (
    <>
      <Node id="root">{label}</Node>
      <DatabaseFrame id="database" from="root" label={`${label} DB`} />
    </>
  );
});

export default function FrameMindMapExample() {
  return (
    <MindMap id="services">
      <Node id="platform">Platform</Node>
      <ServiceFrame id="auth" from="platform" label="Auth" />
      <ServiceFrame id="billing" from="platform" label="Billing" />
    </MindMap>
  );
}
```

## Nested Frame Example

```tsx
const CacheFrame = frame(function CacheFrame() {
  return (
    <>
      <Shape id="redis" x={0} y={0}>Redis</Shape>
      <Shape id="worker" anchor="redis" position="bottom" gap={40}>Worker</Shape>
    </>
  );
});

const ServiceFrame = frame(function ServiceFrame({ label }: { label: string }) {
  return (
    <>
      <Shape id="app" x={0} y={0}>{label} Service</Shape>
      <CacheFrame id="cache" anchor="app" position="right" gap={140} />
    </>
  );
});

<Canvas>
  <ServiceFrame id="auth" x={120} y={120} label="Auth" />
  <ServiceFrame id="billing" anchor="auth.cache.worker" position="right" gap={220} label="Billing" />
</Canvas>
```

The important part is that child frame ids stay local too.

- `cache.redis`
- `cache.worker`

At runtime they become:

- `auth.cache.redis`
- `auth.cache.worker`

## Guidance

- Prefer `frame(...)` for reusable user-facing code.
- Use `EmbedScope` and `MindMapEmbed` only when the user is working on core runtime internals.
- Keep frame internals local and declarative.
- Do not pre-expand ids manually unless the user explicitly needs cross-boundary references.

## Example Files

- `examples/frame_canvas.tsx`
- `examples/frame_mindmap.tsx`
