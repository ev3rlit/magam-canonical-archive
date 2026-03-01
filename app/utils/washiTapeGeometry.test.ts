import { describe, expect, it } from 'bun:test';
import type { Node } from 'reactflow';
import { getWashiNodePosition, resolveWashiGeometry } from './washiTapeGeometry';

describe('washiTapeGeometry', () => {
  it('normalizes segment placement with expected angle and length', () => {
    const geometry = resolveWashiGeometry({
      at: {
        type: 'segment',
        from: { x: 0, y: 0 },
        to: { x: 100, y: 100 },
        thickness: 24,
      },
      seed: 'segment-1',
    });

    expect(geometry.mode).toBe('segment');
    expect(Math.round(geometry.angle)).toBe(45);
    expect(Math.round(geometry.length)).toBe(141);
    expect(geometry.thickness).toBe(24);
  });

  it('keeps polar jitter deterministic when angle is omitted', () => {
    const first = resolveWashiGeometry({
      at: { type: 'polar', x: 10, y: 20, length: 180, thickness: 32 },
      seed: 'same-seed',
    });
    const second = resolveWashiGeometry({
      at: { type: 'polar', x: 10, y: 20, length: 180, thickness: 32 },
      seed: 'same-seed',
    });

    expect(first.angle).toBe(second.angle);
    expect(first.length).toBe(second.length);
  });

  it('resolves attach placement against target node snapshot', () => {
    const nodes = [
      {
        id: 'target-1',
        type: 'shape',
        position: { x: 200, y: 120 },
        width: 160,
        height: 80,
        data: {},
      } as unknown as Node,
    ];

    const geometry = resolveWashiGeometry({
      at: {
        type: 'attach',
        target: 'target-1',
        placement: 'top',
        span: 0.5,
        align: 0.5,
        thickness: 20,
      },
      nodes,
      seed: 'attach-1',
    });

    expect(geometry.mode).toBe('attach');
    expect(geometry.targetSnapshot?.id).toBe('target-1');
    expect(geometry.thickness).toBe(20);
    expect(geometry.from.y).toBe(120);
    expect(geometry.to.y).toBe(120);
  });

  it('supports signed offset for attach placement', () => {
    const nodes = [
      {
        id: 'target-2',
        type: 'shape',
        position: { x: 100, y: 200 },
        width: 160,
        height: 80,
        data: {},
      } as unknown as Node,
    ];

    const topWithNegativeOffset = resolveWashiGeometry({
      at: {
        type: 'attach',
        target: 'target-2',
        placement: 'top',
        span: 0.5,
        align: 0,
        offset: -8,
        thickness: 16,
      },
      nodes,
      seed: 'attach-signed-top',
    });
    const rightWithNegativeOffset = resolveWashiGeometry({
      at: {
        type: 'attach',
        target: 'target-2',
        placement: 'right',
        span: 0.5,
        align: 0,
        offset: -12,
        thickness: 16,
      },
      nodes,
      seed: 'attach-signed-right',
    });

    // Negative top offset pulls tape downward into the target area.
    expect(topWithNegativeOffset.from.y).toBe(208);
    // Negative right offset pulls tape leftward into the target area.
    expect(rightWithNegativeOffset.from.x).toBe(248);
  });

  it('calculates node position from resolved geometry center', () => {
    const position = getWashiNodePosition({
      from: { x: 100, y: 100 },
      to: { x: 300, y: 100 },
      length: 200,
      thickness: 40,
    });

    expect(position).toEqual({ x: 100, y: 80 });
  });
});
