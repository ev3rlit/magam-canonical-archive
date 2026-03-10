import { Canvas, Edge, Shape, Text, frame } from '@magam/core';

const CacheFrame = frame(function CacheFrame() {
  return (
    <>
      <Shape id="redis" x={0} y={0} width={120} height={50}>
        Redis
      </Shape>
      <Shape id="worker" anchor="redis" position="bottom" gap={48} width={120} height={50}>
        Worker
      </Shape>
      <Edge from="redis" to="worker" label="sync" />
    </>
  );
});

const ServiceFrame = frame(function ServiceFrame({ label }: { label: string }) {
  return (
    <>
      <Shape id="app" x={0} y={0} width={140} height={56}>
        {label} Service
      </Shape>
      <CacheFrame id="cache" anchor="app" position="right" gap={140} />
    </>
  );
});

export default function FrameCanvasExample() {
  return (
    <Canvas>
      <Text id="title" x={0} y={-120}>
        Frame Canvas Example
      </Text>
      <ServiceFrame id="auth" x={80} y={80} label="Auth" />
      <ServiceFrame id="billing" anchor="auth.cache.worker" position="right" gap={220} label="Billing" />
    </Canvas>
  );
}
