import { describe, expect, it } from 'bun:test';
import type { Edge, Node } from 'reactflow';
import {
  applyGraphSnapshot,
  createPastedGraphState,
  isGraphClipboardPayload,
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

  it('creates pasted nodes while keeping washi pattern/placement fields', () => {
    const payload = {
      nodes: [
        {
          id: 'w1',
          type: 'washi-tape',
          position: { x: 20, y: 40 },
          data: {
            preset: 'pastel-dots',
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
      preset: 'pastel-dots',
      pattern: { type: 'preset', id: 'pastel-dots' },
      at: { type: 'polar', x: 20, y: 40, length: 180, thickness: 36 },
      opacity: 0.9,
    });
  });
});
