import { describe, expect, it } from 'vitest';
import {
  getEffectiveBounds,
  getSelectionBounds,
  normalizeRotationDegrees,
  syncGroupFrames,
} from './editor-geometry';
import type { EditorCanvasObject } from './editor-types';

function createObject(overrides: Partial<EditorCanvasObject> & Pick<EditorCanvasObject, 'id' | 'kind'>): EditorCanvasObject {
  const { id, kind, ...rest } = overrides;
  return {
    id,
    kind,
    name: id,
    parentId: null,
    x: 0,
    y: 0,
    width: 120,
    height: 80,
    rotation: 0,
    zIndex: 1,
    locked: false,
    visible: true,
    fillPreset: 'iris',
    contentBlocks: [],
    ...rest,
  };
}

describe('editor geometry transform helpers', () => {
  it('computes rotated single-object bounds', () => {
    const object = createObject({
      id: 'shape-1',
      kind: 'shape',
      width: 200,
      height: 100,
      rotation: 90,
    });

    const bounds = getEffectiveBounds(object, [object]);

    expect(Math.round(bounds.width)).toBe(100);
    expect(Math.round(bounds.height)).toBe(200);
  });

  it('aggregates multi-selection bounds from rotated roots', () => {
    const left = createObject({
      id: 'shape-1',
      kind: 'shape',
      x: 0,
      y: 0,
      width: 120,
      height: 80,
      rotation: 45,
    });
    const right = createObject({
      id: 'shape-2',
      kind: 'shape',
      x: 220,
      y: 30,
      width: 120,
      height: 80,
      rotation: 0,
    });

    const bounds = getSelectionBounds(
      {
        ids: [left.id, right.id],
        primaryId: right.id,
      },
      [left, right],
    );

    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeLessThanOrEqual(18);
    expect(bounds!.width).toBeGreaterThan(320);
  });

  it('re-syncs group frames from transformed children without double-applying rotation', () => {
    const group = createObject({
      id: 'group-1',
      kind: 'group',
      width: 200,
      height: 160,
      rotation: normalizeRotationDegrees(30),
    });
    const firstChild = createObject({
      id: 'shape-1',
      kind: 'shape',
      parentId: group.id,
      x: 40,
      y: 30,
      width: 120,
      height: 80,
      rotation: 30,
    });
    const secondChild = createObject({
      id: 'shape-2',
      kind: 'shape',
      parentId: group.id,
      x: 200,
      y: 120,
      width: 120,
      height: 80,
      rotation: 30,
    });

    const synced = syncGroupFrames([group, firstChild, secondChild]);
    const nextGroup = synced.find((object) => object.id === group.id)!;

    expect(nextGroup.rotation).toBe(30);
    expect(nextGroup.width).toBeGreaterThan(280);
    expect(nextGroup.height).toBeGreaterThan(140);
  });
});
