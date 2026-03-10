import { MindMap, Node, frame } from '@magam/core';

const DatabaseFrame = frame(function DatabaseFrame({ label }: { label: string }) {
  return (
    <>
      <Node id="store">{label}</Node>
      <Node id="replica" from="store">
        Replica
      </Node>
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
    <MindMap id="services" x={0} y={0}>
      <Node id="platform">Platform</Node>
      <ServiceFrame id="auth" from="platform" label="Auth" />
      <ServiceFrame id="billing" from="platform" label="Billing" />
    </MindMap>
  );
}
