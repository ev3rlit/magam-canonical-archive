import { describe, expect, it } from 'bun:test';
import type { Node } from 'reactflow';
import {
  interpretWorkspaceStyle,
  resolveEligibleObjectProfileForNode,
} from './index';

function makeNode(input: {
  id: string;
  type: string;
  data: Record<string, unknown>;
}): Node {
  return {
    id: input.id,
    type: input.type,
    position: { x: 0, y: 0 },
    data: input.data,
  } as Node;
}

describe('workspace-styling smoke validation', () => {
  it('applies sticky example classes through size and visual categories', () => {
    const node = makeNode({
      id: 'sticky-smoke',
      type: 'sticky',
      data: {
        className: 'w-[320px] bg-amber-100 shadow-lg rounded-xl',
      },
    });

    const interpreted = interpretWorkspaceStyle({
      styleInput: {
        objectId: node.id,
        className: String(node.data.className),
        sourceRevision: 'rev-sticky',
        timestamp: 1,
      },
      eligibleProfile: resolveEligibleObjectProfileForNode(node),
    });

    expect(interpreted.result.status).toBe('applied');
    expect(interpreted.result.appliedCategories).toEqual([
      'size',
      'basic-visual',
      'shadow-elevation',
    ]);
    expect(interpreted.result.resolvedStylePayload?.style).toMatchObject({
      width: '320px',
      backgroundColor: '#fef3c7',
      borderRadius: '0.75rem',
    });
  });

  it('applies sticker emphasis classes through outline and shadow categories', () => {
    const node = makeNode({
      id: 'sticker-smoke',
      type: 'sticker',
      data: {
        className: 'ring-2 ring-violet-500 shadow-md',
        outlineWidth: 4,
        outlineColor: '#ffffff',
        shadow: 'md',
      },
    });

    const interpreted = interpretWorkspaceStyle({
      styleInput: {
        objectId: node.id,
        className: String(node.data.className),
        sourceRevision: 'rev-sticker',
        timestamp: 1,
      },
      eligibleProfile: resolveEligibleObjectProfileForNode(node),
    });

    expect(interpreted.result.status).toBe('applied');
    expect(interpreted.result.appliedCategories).toEqual([
      'shadow-elevation',
      'outline-emphasis',
    ]);
    expect(String(interpreted.result.resolvedStylePayload?.style.boxShadow)).toContain('#8b5cf6');
  });

  it('keeps washi example out of scope until it exposes a className surface', () => {
    const node = makeNode({
      id: 'washi-smoke',
      type: 'washi-tape',
      data: {
        label: 'Tape',
        at: {
          type: 'segment',
          from: { x: 0, y: 0 },
          to: { x: 100, y: 0 },
        },
      },
    });

    const interpreted = interpretWorkspaceStyle({
      styleInput: {
        objectId: node.id,
        className: 'shadow-lg ring-2',
        sourceRevision: 'rev-washi',
        timestamp: 1,
      },
      eligibleProfile: resolveEligibleObjectProfileForNode(node),
    });

    expect(interpreted.result.status).toBe('unsupported');
    expect(interpreted.diagnostics[0]?.code).toBe('OUT_OF_SCOPE_OBJECT');
  });
});
