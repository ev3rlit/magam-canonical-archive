import { describe, expect, it } from 'bun:test';
import type { Edge, Node } from 'reactflow';
import {
  applyGraphSnapshot,
  createGraphClipboardPayload,
  createPastedGraphState,
  isGraphClipboardPayload,
  serializeNodeIdsForClipboard,
  snapshotGraphState,
} from './clipboardGraph';

describe('clipboardGraph', () => {
  it('validates clipboard payload shape', () => {
    expect(isGraphClipboardPayload({ nodes: [], edges: [] })).toBe(true);
    expect(isGraphClipboardPayload({ nodes: [] })).toBe(false);
    expect(isGraphClipboardPayload(null)).toBe(false);
  });

  it('creates pasted nodes/edges with remapped ids and keeps sticker data', () => {
    const payload = {
      nodes: [
        {
          id: 's1',
          type: 'sticker',
          position: { x: 10, y: 20 },
          data: {
            kind: 'image',
            src: './assets/logo.svg',
            outlineWidth: 8,
            outlineColor: '#fff',
            shadow: 'lg',
            padding: 12,
          },
        } as unknown as Node,
      ],
      edges: [] as Edge[],
    };

    const next = createPastedGraphState(payload, [], [], 24);
    expect(next.nodes).toHaveLength(1);
    expect(next.nodes[0].id).not.toBe('s1');
    expect(next.nodes[0].position).toEqual({ x: 34, y: 44 });
    expect(next.nodes[0].data).toMatchObject({
      kind: 'image',
      src: './assets/logo.svg',
      outlineWidth: 8,
      outlineColor: '#fff',
      shadow: 'lg',
      padding: 12,
    });
    expect(next.selectedNodeIds).toEqual([next.nodes[0].id]);
  });

  it('snapshots/restores graph state for undo/redo', () => {
    const nodes = [{ id: 'n1', position: { x: 0, y: 0 }, data: {}, selected: true } as unknown as Node];
    const edges = [{ id: 'e1', source: 'n1', target: 'n1' } as unknown as Edge];

    const snap = snapshotGraphState(nodes, edges);
    const restored = applyGraphSnapshot(snap);

    expect(restored.nodes).toEqual(nodes);
    expect(restored.edges).toEqual(edges);
    expect(restored.selectedNodeIds).toEqual(['n1']);
  });

  it('creates selected clipboard payload and serializes ids as plain text', () => {
    const nodes = [
      { id: 'n1', type: 'text', position: { x: 0, y: 0 }, data: {} } as unknown as Node,
      { id: 'n2', type: 'text', position: { x: 10, y: 10 }, data: {} } as unknown as Node,
      { id: 'n3', type: 'text', position: { x: 20, y: 20 }, data: {} } as unknown as Node,
    ];
    const edges = [
      { id: 'e1', source: 'n1', target: 'n2' } as unknown as Edge,
      { id: 'e2', source: 'n2', target: 'n3' } as unknown as Edge,
    ];

    const payload = createGraphClipboardPayload(nodes, edges, ['n1', 'n2']);

    expect(payload.nodes.map((node) => node.id)).toEqual(['n1', 'n2']);
    expect(payload.edges.map((edge) => edge.id)).toEqual(['e1']);
    expect(serializeNodeIdsForClipboard(payload)).toBe('n1\nn2');
  });

  it('falls back to the full graph payload when nothing is selected', () => {
    const nodes = [
      { id: 'n1', type: 'text', position: { x: 0, y: 0 }, data: {} } as unknown as Node,
      { id: 'n2', type: 'text', position: { x: 10, y: 10 }, data: {} } as unknown as Node,
    ];
    const edges = [{ id: 'e1', source: 'n1', target: 'n2' } as unknown as Edge];

    const payload = createGraphClipboardPayload(nodes, edges, []);

    expect(payload.nodes.map((node) => node.id)).toEqual(['n1', 'n2']);
    expect(payload.edges.map((edge) => edge.id)).toEqual(['e1']);
  });

  it('creates pasted nodes while keeping washi pattern/placement fields', () => {
    const payload = {
      nodes: [
        {
          id: 'w1',
          type: 'washi-tape',
          position: { x: 20, y: 40 },
          data: {
            pattern: { type: 'preset', id: 'pastel-dots' },
            at: { type: 'polar', x: 20, y: 40, length: 180, thickness: 36 },
            opacity: 0.9,
          },
        } as unknown as Node,
      ],
      edges: [] as Edge[],
    };

    const next = createPastedGraphState(payload, [], [], 10);
    expect(next.nodes).toHaveLength(1);
    expect(next.nodes[0].id).not.toBe('w1');
    expect(next.nodes[0].data).toMatchObject({
      pattern: { type: 'preset', id: 'pastel-dots' },
      at: { type: 'polar', x: 20, y: 40, length: 180, thickness: 36 },
      opacity: 0.9,
    });
  });
});
