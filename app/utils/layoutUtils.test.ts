import { describe, expect, it } from 'bun:test';
import {
  areNodesMeasured,
  getMindMapSizeSignature,
  quantizeSize,
} from './layoutUtils';

describe('layoutUtils relayout helpers', () => {
  it('quantizeSize rounds to the nearest 2px by default', () => {
    expect(quantizeSize(101)).toBe(102);
    expect(quantizeSize(100.4)).toBe(100);
  });

  it('areNodesMeasured returns true only when all nodes have positive dimensions', () => {
    const measuredNodes = [
      { id: 'a', width: 120, height: 80, position: { x: 0, y: 0 } },
      { id: 'b', measured: { width: 200, height: 100 }, position: { x: 10, y: 10 } },
    ];
    const unmeasuredNodes = [
      { id: 'a', width: 120, height: 80, position: { x: 0, y: 0 } },
      { id: 'b', width: 0, height: 100, position: { x: 10, y: 10 } },
    ];

    expect(areNodesMeasured(measuredNodes as any)).toBe(true);
    expect(areNodesMeasured(unmeasuredNodes as any)).toBe(false);
    expect(areNodesMeasured([] as any)).toBe(false);
  });

  it('getMindMapSizeSignature is deterministic and ignores non-group nodes', () => {
    const nodes = [
      {
        id: 'map.child-b',
        width: 121,
        height: 81,
        data: { groupId: 'map' },
        position: { x: 0, y: 0 },
      },
      {
        id: 'canvas-free',
        width: 900,
        height: 600,
        data: {},
        position: { x: 0, y: 0 },
      },
      {
        id: 'map.child-a',
        width: 99,
        height: 49,
        data: { groupId: 'map' },
        position: { x: 0, y: 0 },
      },
    ];

    const signature = getMindMapSizeSignature(nodes as any);
    expect(signature).toBe('map.child-a:100x50|map.child-b:122x82');
  });

  it('getMindMapSizeSignature changes only when quantized size changes', () => {
    const baseNodes = [
      {
        id: 'map.root',
        width: 200,
        height: 100,
        data: { groupId: 'map' },
        position: { x: 0, y: 0 },
      },
    ];
    const jitterNodes = [
      {
        id: 'map.root',
        width: 200.9,
        height: 100.9,
        data: { groupId: 'map' },
        position: { x: 0, y: 0 },
      },
    ];
    const changedNodes = [
      {
        id: 'map.root',
        width: 205,
        height: 103,
        data: { groupId: 'map' },
        position: { x: 0, y: 0 },
      },
    ];

    const base = getMindMapSizeSignature(baseNodes as any);
    const jitter = getMindMapSizeSignature(jitterNodes as any);
    const changed = getMindMapSizeSignature(changedNodes as any);

    expect(jitter).toBe(base);
    expect(changed).not.toBe(base);
  });
});
