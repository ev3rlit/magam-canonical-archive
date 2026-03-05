import { describe, expect, it } from 'bun:test';
import { normalizeStickyDefaults } from '@/utils/washiTapeDefaults';
import { parseRenderGraph } from '@/features/render/parseRenderGraph';
import {
  assertMindMapTopology,
  buildMindMapEdge,
  parseFromProp,
  resolveNodeId,
} from './mindmapParser';

describe('page sticky parsing contracts', () => {
  it('preserves explicit preset pattern and shape inputs', () => {
    const normalized = normalizeStickyDefaults({
      pattern: { type: 'preset', id: 'lined-warm' },
      shape: 'cloud',
      width: 280,
      height: 180,
    });

    expect(normalized.pattern).toMatchObject({
      type: 'preset',
      id: 'lined-warm',
    });
    expect(normalized.shape).toBe('cloud');
    expect(normalized.width).toBe(280);
    expect(normalized.height).toBe(180);
  });

  it('maps legacy color and anchor fields into pattern/at defaults', () => {
    const normalized = normalizeStickyDefaults({
      color: '#ffd54f',
      anchor: 'node-1',
      position: 'bottom',
      gap: 24,
      align: 'center',
    });

    expect(normalized.pattern).toMatchObject({
      type: 'solid',
      color: '#ffd54f',
    });
    expect(normalized.at).toMatchObject({
      type: 'anchor',
      target: 'node-1',
      position: 'bottom',
      gap: 24,
      align: 'center',
    });
  });
});

describe('mindmap parser topology contracts', () => {
  it('parses string from values', () => {
    const parsed = parseFromProp('root', { mindmapId: 'map', nodeId: 'map.child' });
    expect(parsed).toEqual({ node: 'root', edge: {} });
  });

  it('parses object from values', () => {
    const parsed = parseFromProp(
      {
        node: 'root:bottom',
        edge: { pattern: 'dashed', label: { text: 'branch' } },
      },
      { mindmapId: 'map', nodeId: 'map.child' },
    );
    expect(parsed.node).toBe('root:bottom');
    expect(parsed.edge.pattern).toBe('dashed');
    expect((parsed.edge.label as { text?: string }).text).toBe('branch');
  });

  it('allows root nodes without from in mindmap context', () => {
    expect(() => assertMindMapTopology({
      mindmapId: 'map',
      childType: 'graph-shape',
      childId: 'shape-1',
      from: undefined,
    })).not.toThrow();
  });

  it('throws deterministic error for nested mindmap', () => {
    expect(() => assertMindMapTopology({
      mindmapId: 'parent',
      childType: 'graph-mindmap',
      childId: 'child-map',
      from: 'root',
    })).toThrow('[MindMap:parent] nested MindMap is not supported.');
  });

  it('does not throw for sibling mindmaps at canvas level', () => {
    expect(() => assertMindMapTopology({
      mindmapId: undefined,
      childType: 'graph-mindmap',
      childId: 'map-a',
    })).not.toThrow();
  });

  it('builds edge from from={{ node, edge }} with port + styles', () => {
    const edge = buildMindMapEdge({
      nodeId: 'map.child',
      mindmapId: 'map',
      edgeId: 'edge-1',
      from: {
        node: 'root:bottom',
        edge: {
          type: 'step',
          stroke: '#ef4444',
          strokeWidth: 3,
          pattern: 'dashed',
          label: { text: '판단', color: '#fff', bg: '#ef4444', fontSize: 14 },
        },
      },
      getEdgeType: (type) => (type === 'step' ? 'step' : 'floating'),
      getStrokeStyle: () => ({}),
    });

    expect(edge.source).toBe('map.root');
    expect(edge.sourceHandle).toBe('bottom');
    expect(edge.target).toBe('map.child');
    expect(edge.type).toBe('step');
    expect(edge.style).toMatchObject({
      stroke: '#ef4444',
      strokeWidth: 3,
      strokeDasharray: '5 5',
    });
    expect(edge.label).toBe('판단');
    expect(edge.labelStyle).toMatchObject({ fill: '#fff', fontSize: 14 });
    expect(edge.labelBgStyle).toMatchObject({ fill: '#ef4444' });
  });

  it('keeps edge builder strict when from is missing', () => {
    expect(() => buildMindMapEdge({
      nodeId: 'map.child',
      mindmapId: 'map',
      edgeId: 'edge-1',
      from: undefined,
      getEdgeType: () => 'floating',
      getStrokeStyle: () => ({}),
    })).toThrow('[MindMap:map] node "map.child" is missing required from prop.');
  });

  it('resolves node ids per sibling mindmap scope', () => {
    expect(resolveNodeId('child', 'mapA')).toBe('mapA.child');
    expect(resolveNodeId('child', 'mapB')).toBe('mapB.child');
    expect(resolveNodeId('mapA.child', 'mapB')).toBe('mapA.child');
  });
});

describe('size non-goal contracts', () => {
  it('keeps Sequence/Sticker size token paths unsupported with warning + ignore', () => {
    const warnings: string[] = [];
    const originalWarn = console.warn;
    console.warn = ((message: string) => warnings.push(String(message))) as typeof console.warn;

    const parsed = parseRenderGraph({
      graph: {
        children: [
          {
            type: 'graph-sequence',
            props: {
              id: 'seq-ignored',
              x: 0,
              y: 0,
              size: { token: 'm', ratio: 'portrait' },
            },
            children: [],
          },
          {
            type: 'graph-sticker',
            props: {
              id: 'sticker-ignored',
              x: 0,
              y: 0,
              size: 'l',
              width: 180,
              height: 120,
            },
            children: [],
          },
        ],
      },
    });

    console.warn = originalWarn;

    expect(parsed).not.toBeNull();
    expect(parsed!.nodes.map((node) => node.id)).toEqual(
      expect.arrayContaining(['seq-ignored', 'sticker-ignored']),
    );
    expect(
      warnings.some((line) => line.includes('UNSUPPORTED_LEGACY_SIZE_API')),
    ).toBe(true);
  });
});
