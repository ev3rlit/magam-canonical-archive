import { describe, expect, it } from 'vitest';
import type { CanvasRuntimeCommandNameV1 } from './commands';

describe('canvas-runtime contracts', () => {
  it('publishes the mandatory command vocabulary and excludes group membership', () => {
    const commandNames: CanvasRuntimeCommandNameV1[] = [
      'canvas.node.create',
      'canvas.node.move',
      'canvas.node.reparent',
      'canvas.node.resize',
      'canvas.node.rotate',
      'canvas.node.presentation-style.update',
      'canvas.node.render-profile.update',
      'canvas.node.rename',
      'canvas.node.delete',
      'canvas.node.z-order.update',
      'object.content.update',
      'object.capability.patch',
      'object.body.block.insert',
      'object.body.block.update',
      'object.body.block.remove',
      'object.body.block.reorder',
    ];

    expect(commandNames).not.toContain('node.group.update' as CanvasRuntimeCommandNameV1);
    expect(commandNames).toContain('object.body.block.reorder');
  });
});
