import { describe, expect, it } from 'bun:test';
import {
  buildCanvasNodeCreateCommand,
  buildRuntimeContentUpdateCommand,
  buildRuntimePresentationStylePatch,
} from '../shared/runtimeTransforms';

describe('canvasHandlers shared runtime transforms', () => {
  it('maps canvas node create placement and style through the shared command builder', () => {
    const command = buildCanvasNodeCreateCommand({
      canvasId: 'canvas-1',
      nodeId: 'node-1',
      nodeType: 'shape',
      props: {
        width: 180,
        height: 120,
        fill: '#fff8d6',
        stroke: '#222222',
        strokeWidth: 2,
      },
      placement: {
        mode: 'mindmap-sibling',
        siblingOf: 'node-0',
        parentId: 'parent-1',
      },
    });

    expect(command).toEqual({
      name: 'canvas.node.create',
      canvasId: 'canvas-1',
      nodeId: 'node-1',
      kind: 'node',
      nodeType: 'shape',
      placement: {
        mode: 'mindmap-sibling',
        siblingOfNodeId: 'node-0',
        parentNodeId: 'parent-1',
      },
      transform: {
        width: 180,
        height: 120,
      },
      presentationStyle: {
        fillColor: '#fff8d6',
        strokeColor: '#222222',
        strokeWidth: 2,
      },
    });
  });

  it('builds runtime content updates with text-aware patch shape', () => {
    expect(buildRuntimeContentUpdateCommand({
      objectId: 'obj-text',
      kind: 'text',
      content: 'Hello',
    })).toEqual({
      name: 'object.content.update',
      objectId: 'obj-text',
      kind: 'text',
      patch: {
        text: 'Hello',
        value: 'Hello',
      },
      expectedContentKind: 'text',
    });

    expect(buildRuntimeContentUpdateCommand({
      objectId: 'obj-md',
      kind: 'markdown',
      content: '# Heading',
    })).toEqual({
      name: 'object.content.update',
      objectId: 'obj-md',
      kind: 'markdown',
      patch: {
        source: '# Heading',
        value: '# Heading',
      },
      expectedContentKind: 'markdown',
    });
  });

  it('maps style props to presentation-style patch keys once', () => {
    expect(buildRuntimePresentationStylePatch({
      fill: '#ffeeaa',
      stroke: '#111111',
      strokeWidth: 4,
      opacity: 0.7,
      color: '#333333',
      fontFamily: 'Virgil',
      fontSize: 18,
    })).toEqual({
      fillColor: '#ffeeaa',
      strokeColor: '#111111',
      strokeWidth: 4,
      opacity: 0.7,
      textColor: '#333333',
      fontFamily: 'Virgil',
      fontSize: 18,
    });
  });
});
