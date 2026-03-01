import { describe, expect, it } from 'bun:test';
import type { Node } from 'reactflow';
import { resolveAnchors } from './anchorResolver';

describe('resolveAnchors', () => {
  it('recomputes anchored node position when anchor node moves', () => {
    const initialNodes = [
      {
        id: 'anchor',
        position: { x: 100, y: 100 },
        data: { width: 100, height: 50 },
      },
      {
        id: 'sticker',
        position: { x: 0, y: 0 },
        data: {
          anchor: 'anchor',
          position: 'right',
          gap: 20,
          width: 80,
          height: 40,
        },
      },
    ] as unknown as Node[];

    const first = resolveAnchors(initialNodes);
    const firstSticker = first.find((n) => n.id === 'sticker');
    expect(firstSticker?.position).toEqual({ x: 220, y: 105 });

    const moved = first.map((n) =>
      n.id === 'anchor'
        ? { ...n, position: { x: 300, y: 150 } }
        : n,
    );

    const second = resolveAnchors(moved as Node[]);
    const secondSticker = second.find((n) => n.id === 'sticker');

    expect(secondSticker?.position).toEqual({ x: 420, y: 155 });
  });

  it('recomputes washi attach position when target node moves', () => {
    const initialNodes = [
      {
        id: 'target',
        type: 'shape',
        position: { x: 100, y: 100 },
        data: { width: 100, height: 50 },
      },
      {
        id: 'washi',
        type: 'washi-tape',
        position: { x: 0, y: 0 },
        data: {
          at: {
            type: 'attach',
            target: 'target',
            placement: 'top',
            span: 0.5,
            align: 0.5,
            thickness: 20,
          },
          seed: 'w-1',
        },
      },
    ] as unknown as Node[];

    const first = resolveAnchors(initialNodes);
    const firstWashi = first.find((n) => n.id === 'washi');
    expect(firstWashi?.position).toEqual({ x: 125, y: 90 });

    const moved = first.map((n) =>
      n.id === 'target'
        ? { ...n, position: { x: 300, y: 200 } }
        : n,
    );

    const second = resolveAnchors(moved as Node[]);
    const secondWashi = second.find((n) => n.id === 'washi');
    expect(secondWashi?.position).toEqual({ x: 325, y: 190 });
  });

  it('applies sticky at.anchor with higher priority than x/y', () => {
    const nodes = [
      {
        id: 'target',
        type: 'shape',
        position: { x: 100, y: 100 },
        data: { width: 100, height: 50 },
      },
      {
        id: 'sticky-with-at',
        type: 'sticky',
        position: { x: 999, y: 999 },
        data: {
          width: 80,
          height: 40,
          at: {
            type: 'anchor',
            target: 'target',
            position: 'bottom',
            gap: 20,
          },
          anchor: 'ignored',
          position: 'left',
          gap: 999,
        },
      },
    ] as unknown as Node[];

    const resolved = resolveAnchors(nodes);
    const sticky = resolved.find((node) => node.id === 'sticky-with-at');
    expect(sticky?.position).toEqual({ x: 110, y: 170 });
  });

  it('recomputes sticky attach position when target node moves', () => {
    const initialNodes = [
      {
        id: 'target',
        type: 'shape',
        position: { x: 80, y: 120 },
        data: { width: 120, height: 60 },
      },
      {
        id: 'sticky-attach',
        type: 'sticky',
        position: { x: 0, y: 0 },
        data: {
          width: 110,
          height: 48,
          at: {
            type: 'attach',
            target: 'target',
            placement: 'bottom',
            span: 0.5,
            align: 0.5,
            thickness: 24,
          },
        },
      },
    ] as unknown as Node[];

    const first = resolveAnchors(initialNodes);
    const firstSticky = first.find((node) => node.id === 'sticky-attach');
    expect(firstSticky?.position).toEqual({ x: 110, y: 168 });

    const moved = first.map((node) =>
      node.id === 'target'
        ? { ...node, position: { x: 220, y: 260 } }
        : node,
    );

    const second = resolveAnchors(moved as Node[]);
    const secondSticky = second.find((node) => node.id === 'sticky-attach');
    expect(secondSticky?.position).toEqual({ x: 250, y: 308 });
  });
});
