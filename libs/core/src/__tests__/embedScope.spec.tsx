// @ts-nocheck
import * as React from 'react';
import { renderToGraph } from '../renderer';
import { Sticky } from '../components/Sticky';
import { Shape } from '../components/Shape';
import { Text } from '../components/Text';
import { Edge } from '../components/Edge';
import { Group } from '../components/Group';
import { MindMap } from '../components/MindMap';
import { Node } from '../components/Node';
import { Sticker } from '../components/Sticker';
import { EmbedScope } from '../components/EmbedScope';
import { frame } from '../components/frame';

async function render(element: React.ReactNode) {
  const resultAsync = renderToGraph(element);
  return resultAsync.match(
    (container) => container,
    (error) => { throw error; },
  );
}

describe('EmbedScope', () => {
  it('should pass IDs through unchanged when no EmbedScope is present', async () => {
    const element = (
      <canvas>
        <Sticky id="A" text="Hello" x={0} y={0} />
      </canvas>
    );
    const result = await render(element);
    const sticky = result.children[0].children[0];
    expect(sticky.props.id).toBe('A');
  });

  it('should prefix IDs with scope when inside EmbedScope', async () => {
    const element = (
      <canvas>
        <EmbedScope id="auth">
          <Sticky id="jwt" text="JWT" x={0} y={0} />
        </EmbedScope>
      </canvas>
    );
    const result = await render(element);
    const sticky = result.children[0].children[0];
    expect(sticky.props.id).toBe('auth.jwt');
  });

  it('should chain nested EmbedScopes', async () => {
    const element = (
      <canvas>
        <EmbedScope id="infra">
          <EmbedScope id="aws">
            <Sticky id="ec2" text="EC2" x={0} y={0} />
          </EmbedScope>
        </EmbedScope>
      </canvas>
    );
    const result = await render(element);
    const sticky = result.children[0].children[0];
    expect(sticky.props.id).toBe('infra.aws.ec2');
  });

  it('should not prefix IDs that already contain a dot (cross-boundary)', async () => {
    const element = (
      <canvas>
        <EmbedScope id="auth">
          <Sticky id="backend.api" text="Cross" x={0} y={0} />
        </EmbedScope>
      </canvas>
    );
    const result = await render(element);
    const sticky = result.children[0].children[0];
    expect(sticky.props.id).toBe('backend.api');
  });

  it('should scope Edge from and to', async () => {
    const element = (
      <canvas>
        <EmbedScope id="auth">
          <Sticky id="A" text="Source" x={0} y={0} />
          <Sticky id="B" text="Target" x={100} y={0} />
          <Edge from="A" to="B" />
        </EmbedScope>
      </canvas>
    );
    const result = await render(element);
    const children = result.children[0].children;
    const edge = children.find((c: any) => c.type === 'graph-edge');
    expect(edge.props.from).toBe('auth.A');
    expect(edge.props.to).toBe('auth.B');
  });

  it('should inject scoped parent ID for nested Edge (from injection)', async () => {
    const element = (
      <canvas>
        <EmbedScope id="auth">
          <Sticky id="A" text="Source" x={0} y={0}>
            <Edge to="B" />
          </Sticky>
        </EmbedScope>
      </canvas>
    );
    const result = await render(element);
    const sticky = result.children[0].children[0];
    const edge = sticky.children[0];
    // Edge's from is injected by reconciler from scoped parent id
    expect(edge.props.from).toBe('auth.A');
    expect(edge.props.to).toBe('auth.B');
  });

  it('should scope Shape IDs', async () => {
    const element = (
      <canvas>
        <EmbedScope id="diagram">
          <Shape id="rect1" type="rectangle" x={0} y={0} width={100} height={50} />
        </EmbedScope>
      </canvas>
    );
    const result = await render(element);
    const shape = result.children[0].children[0];
    expect(shape.props.id).toBe('diagram.rect1');
  });

  it('should scope Text IDs', async () => {
    const element = (
      <canvas>
        <EmbedScope id="section">
          <Text id="title" text="Hello" x={0} y={0} />
        </EmbedScope>
      </canvas>
    );
    const result = await render(element);
    const text = result.children[0].children[0];
    expect(text.props.id).toBe('section.title');
  });

  it('should scope MindMap ID', async () => {
    const element = (
      <canvas>
        <EmbedScope id="auth">
          <MindMap id="map">
            <Node id="1" text="Root" />
            <Node id="2" text="Child" />
            <Edge from="1" to="2" />
          </MindMap>
        </EmbedScope>
      </canvas>
    );
    const result = await render(element);
    const mindmap = result.children[0].children[0];
    expect(mindmap.props.id).toBe('auth.map');
  });

  it('should scope Group ID and propagate scoped parentId to children', async () => {
    const element = (
      <canvas>
        <EmbedScope id="section">
          <Group id="G1">
            <Sticky id="S1" text="Inside" x={10} y={10} />
          </Group>
        </EmbedScope>
      </canvas>
    );
    const result = await render(element);
    const group = result.children[0].children[0];
    expect(group.props.id).toBe('section.G1');
    const child = group.children[0];
    expect(child.props.id).toBe('section.S1');
    expect(child.props.parentId).toBe('section.G1');
  });

  it('should work with multiple EmbedScopes at the same level', async () => {
    const element = (
      <canvas>
        <EmbedScope id="left">
          <Sticky id="box" text="Left" x={0} y={0} />
        </EmbedScope>
        <EmbedScope id="right">
          <Sticky id="box" text="Right" x={200} y={0} />
        </EmbedScope>
      </canvas>
    );
    const result = await render(element);
    const children = result.children[0].children;
    expect(children[0].props.id).toBe('left.box');
    expect(children[1].props.id).toBe('right.box');
  });

  it('should mount frame instances in Canvas with a scoped group root', async () => {
    const ServiceFrame = frame(function ServiceFrame({ label }: { label: string }) {
      return (
        <>
          <Shape id="lb" x={0} y={0}>{label} LB</Shape>
          <Shape id="app" anchor="lb" position="bottom" gap={60}>{label} App</Shape>
        </>
      );
    });

    const element = (
      <canvas>
        <ServiceFrame id="auth" x={120} y={80} label="Auth" />
      </canvas>
    );

    const result = await render(element);
    const group = result.children[0].children[0];
    const lb = group.children.find((child: any) => child.props.id === 'auth.lb');
    const app = group.children.find((child: any) => child.props.id === 'auth.app');

    expect(group.type).toBe('graph-group');
    expect(group.props).toEqual(expect.objectContaining({ id: 'auth', x: 120, y: 80 }));
    expect(lb.props.parentId).toBe('auth');
    expect(app.props.anchor).toBe('auth.lb');
  });

  it('should support nested frame instances in Canvas', async () => {
    const CacheFrame = frame(function CacheFrame() {
      return (
        <>
          <Shape id="redis" x={0} y={0}>Redis</Shape>
          <Shape id="worker" anchor="redis" position="bottom" gap={40}>Worker</Shape>
        </>
      );
    });

    const ServiceFrame = frame(function ServiceFrame() {
      return (
        <>
          <Shape id="app" x={0} y={0}>App</Shape>
          <CacheFrame id="cache" anchor="app" position="right" gap={120} />
        </>
      );
    });

    const element = (
      <canvas>
        <ServiceFrame id="auth" x={80} y={40} />
      </canvas>
    );

    const result = await render(element);
    const group = result.children[0].children[0];
    const nestedGroup = group.children.find((child: any) => child.type === 'graph-group');
    const nestedRedis = nestedGroup.children.find((child: any) => child.props.id === 'auth.cache.redis');

    expect(nestedGroup.props.id).toBe('auth.cache');
    expect(nestedGroup.props.anchor).toBe('auth.app');
    expect(nestedRedis.props.parentId).toBe('auth.cache');
  });

  it('should resolve anchor prop to scoped ID within same scope', async () => {
    const element = (
      <canvas>
        <Shape id="gateway" x={0} y={0} width={100} height={50} />
        <EmbedScope id="auth">
          <Shape id="lb" anchor="gateway" position="bottom" gap={80} width={100} height={50} />
          <Shape id="app" anchor="lb" position="bottom" gap={60} width={100} height={50} />
        </EmbedScope>
      </canvas>
    );
    const result = await render(element);
    const children = result.children[0].children;
    const lb = children.find((c: any) => c.props.id === 'auth.lb');
    const app = children.find((c: any) => c.props.id === 'auth.app');
    // "lb" inside auth scope → "auth.lb" exists → resolved
    expect(app.props.anchor).toBe('auth.lb');
    // "gateway" is not in auth scope (no "auth.gateway") → kept as-is
    expect(lb.props.anchor).toBe('gateway');
  });

  it('should resolve anchor in nested EmbedScope', async () => {
    const element = (
      <canvas>
        <EmbedScope id="infra">
          <Shape id="root" x={0} y={0} width={100} height={50} />
          <EmbedScope id="aws">
            <Shape id="vpc" anchor="root" position="bottom" gap={60} width={100} height={50} />
            <Shape id="ec2" anchor="vpc" position="bottom" gap={60} width={100} height={50} />
          </EmbedScope>
        </EmbedScope>
      </canvas>
    );
    const result = await render(element);
    const children = result.children[0].children;
    const ec2 = children.find((c: any) => c.props.id === 'infra.aws.ec2');
    // "vpc" in infra.aws scope → "infra.aws.vpc" exists → resolved
    expect(ec2.props.anchor).toBe('infra.aws.vpc');
  });

  it('should resolve MindMap anchor prop to scoped ID', async () => {
    const element = (
      <canvas>
        <Shape id="gateway" x={0} y={0} width={100} height={50} />
        <EmbedScope id="infra">
          <Shape id="ref" anchor="gateway" position="right" gap={80} width={100} height={50} />
          <MindMap id="map" anchor="ref" position="bottom" gap={60}>
            <Node id="root" text="Root" />
          </MindMap>
        </EmbedScope>
      </canvas>
    );
    const result = await render(element);
    const children = result.children[0].children;
    const mindmap = children.find((c: any) => c.props.id === 'infra.map');
    // "ref" in infra scope → "infra.ref" exists → resolved
    expect(mindmap.props.anchor).toBe('infra.ref');
  });

  it('should not resolve anchor when scoped candidate does not exist', async () => {
    const element = (
      <canvas>
        <Shape id="external" x={0} y={0} width={100} height={50} />
        <EmbedScope id="auth">
          <Shape id="lb" anchor="external" position="bottom" gap={80} width={100} height={50} />
        </EmbedScope>
      </canvas>
    );
    const result = await render(element);
    const children = result.children[0].children;
    const lb = children.find((c: any) => c.props.id === 'auth.lb');
    // "external" → "auth.external" does NOT exist → kept as-is
    expect(lb.props.anchor).toBe('external');
  });

  it('should scope Sticker ID and resolve Sticker anchor in scope', async () => {
    const element = (
        <canvas>
          <EmbedScope id="auth">
            <Shape id="target" x={0} y={0} width={100} height={50} />
          <Sticker id="badge" anchor="target" position="right" gap={16}>
            ✅
          </Sticker>
        </EmbedScope>
      </canvas>
    );

    const result = await render(element);
    const children = result.children[0].children;
    const sticker = children.find((c: any) => c.type === 'graph-sticker');

    expect(sticker.props.id).toBe('auth.badge');
    expect(sticker.props.anchor).toBe('auth.target');
  });
});
