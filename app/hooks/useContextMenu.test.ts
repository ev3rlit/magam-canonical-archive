import { describe, expect, it } from 'bun:test';
import { sanitizeContextMenuItems, shouldDismissContextMenuForSelectionChange } from './useContextMenu.helpers';
import type { ContextMenuContext, ContextMenuItem } from '@/types/contextMenu';

const paneContext: ContextMenuContext = {
  type: 'pane',
  position: { x: 40, y: 80 },
  selectedNodeIds: [],
};

describe('useContextMenu helpers', () => {
  it('filters hidden items, sorts by order, and compacts separators', () => {
    const items: ContextMenuItem[] = [
      { type: 'separator' },
      {
        type: 'action',
        id: 'b',
        label: 'B',
        order: 20,
        handler: () => undefined,
      },
      {
        type: 'action',
        id: 'a',
        label: 'A',
        order: 10,
        handler: () => undefined,
      },
      {
        type: 'action',
        id: 'hidden',
        label: 'Hidden',
        order: 15,
        when: () => false,
        handler: () => undefined,
      },
      { type: 'separator' },
    ];

    expect(sanitizeContextMenuItems(items, paneContext)).toEqual([
      {
        type: 'action',
        id: 'a',
        label: 'A',
        order: 10,
        handler: expect.any(Function),
      },
      {
        type: 'action',
        id: 'b',
        label: 'B',
        order: 20,
        handler: expect.any(Function),
      },
    ]);
  });

  it('dismisses an open menu when selection context drifts', () => {
    expect(shouldDismissContextMenuForSelectionChange({
      instanceId: 'node-context-menu:1',
      context: {
        ...paneContext,
        type: 'node',
        nodeId: 'node-1',
        selectedNodeIds: ['node-1'],
      },
    }, ['node-2'])).toBe(true);

    expect(shouldDismissContextMenuForSelectionChange({
      instanceId: 'node-context-menu:1',
      context: {
        ...paneContext,
        type: 'node',
        nodeId: 'node-1',
        selectedNodeIds: ['node-1', 'node-2'],
      },
    }, ['node-2', 'node-1'])).toBe(false);
  });
});
