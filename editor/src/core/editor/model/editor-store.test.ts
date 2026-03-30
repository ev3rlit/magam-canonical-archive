import { beforeEach, describe, expect, it } from 'vitest';
import { getEffectiveTool, useEditorStore } from './editor-store';

describe('editor store history', () => {
  beforeEach(() => {
    useEditorStore.getState().reset();
    useEditorStore.getState().setViewportRect(1200, 800);
  });

  it('tracks create, duplicate, and delete through undo and redo', () => {
    const state = useEditorStore.getState();

    state.createObjectAtViewportCenter('shape');
    const createdId = useEditorStore.getState().selection.primaryId;
    expect(createdId).toBe('shape-1');
    expect(useEditorStore.getState().canUndo()).toBe(true);

    state.undo();
    expect(useEditorStore.getState().scene.objects).toHaveLength(0);

    state.redo();
    expect(useEditorStore.getState().scene.objects).toHaveLength(1);

    useEditorStore.getState().duplicateSelection();
    expect(useEditorStore.getState().scene.objects).toHaveLength(2);

    useEditorStore.getState().undo();
    expect(useEditorStore.getState().scene.objects).toHaveLength(1);

    useEditorStore.getState().redo();
    expect(useEditorStore.getState().scene.objects).toHaveLength(2);

    const allObjectIds = useEditorStore.getState().scene.objects.map((object) => object.id);
    useEditorStore.getState().selectMany(allObjectIds, allObjectIds[0] ?? null);
    useEditorStore.getState().deleteSelection();
    expect(useEditorStore.getState().scene.objects).toHaveLength(0);

    useEditorStore.getState().undo();
    expect(useEditorStore.getState().scene.objects).toHaveLength(2);
  });

  it('tracks group and ungroup as discrete history entries', () => {
    useEditorStore.getState().createObjectAtViewportCenter('shape');
    const shapeId = useEditorStore.getState().selection.primaryId;
    useEditorStore.getState().createObjectAtViewportCenter('sticky');
    const stickyId = useEditorStore.getState().selection.primaryId;

    expect(shapeId).toBeTruthy();
    expect(stickyId).toBeTruthy();

    useEditorStore.getState().selectMany([shapeId!, stickyId!], stickyId!);
    useEditorStore.getState().groupSelection();

    const groupedState = useEditorStore.getState();
    const group = groupedState.scene.objects.find((object) => object.kind === 'group');
    expect(group).toBeTruthy();
    expect(groupedState.selection.primaryId).toBe(group?.id ?? null);

    useEditorStore.getState().undo();
    const ungroupedState = useEditorStore.getState();
    expect(ungroupedState.scene.objects.some((object) => object.kind === 'group')).toBe(false);
    expect(ungroupedState.scene.objects.every((object) => object.parentId === null)).toBe(true);

    useEditorStore.getState().redo();
    const regroupedState = useEditorStore.getState();
    const regroupedGroup = regroupedState.scene.objects.find((object) => object.kind === 'group');
    expect(regroupedGroup).toBeTruthy();

    useEditorStore.getState().ungroupSelection();
    expect(useEditorStore.getState().scene.objects.some((object) => object.kind === 'group')).toBe(false);

    useEditorStore.getState().undo();
    expect(useEditorStore.getState().scene.objects.some((object) => object.kind === 'group')).toBe(true);
  });

  it('creates empty sticky objects and seeded image objects', () => {
    useEditorStore.getState().createObjectAtViewportCenter('sticky');
    const stickyId = useEditorStore.getState().selection.primaryId!;
    const sticky = useEditorStore.getState().scene.objects.find((object) => object.id === stickyId);

    expect(sticky?.contentBlocks).toEqual([]);

    useEditorStore.getState().createObjectAtViewportCenter('image');
    const imageId = useEditorStore.getState().selection.primaryId!;
    const image = useEditorStore.getState().scene.objects.find((object) => object.id === imageId);

    expect(image?.contentBlocks).toEqual([
      expect.objectContaining({
        blockType: 'canvas.image',
      }),
    ]);
  });

  it('tracks block insert, edit, remove, undo, and redo without per-keystroke history noise', () => {
    useEditorStore.getState().createObjectAtViewportCenter('sticky');
    const stickyId = useEditorStore.getState().selection.primaryId!;

    useEditorStore.getState().insertBlock(stickyId, 'markdown');
    let sticky = useEditorStore.getState().scene.objects.find((object) => object.id === stickyId)!;
    const firstBlockId = sticky.contentBlocks[0]!.id;
    useEditorStore.getState().commitBlockEdit(stickyId, firstBlockId, { source: '# First block' });

    useEditorStore.getState().insertBlock(stickyId, 'markdown', firstBlockId);
    sticky = useEditorStore.getState().scene.objects.find((object) => object.id === stickyId)!;
    const secondBlockId = sticky.contentBlocks[1]!.id;
    useEditorStore.getState().commitBlockEdit(stickyId, secondBlockId, { source: 'Second block' });

    sticky = useEditorStore.getState().scene.objects.find((object) => object.id === stickyId)!;
    expect(sticky.contentBlocks).toHaveLength(2);
    expect(sticky.contentBlocks[0]).toEqual(expect.objectContaining({ source: '# First block' }));
    expect(sticky.contentBlocks[1]).toEqual(expect.objectContaining({ source: 'Second block' }));

    useEditorStore.getState().removeBlock(stickyId, firstBlockId);
    expect(useEditorStore.getState().scene.objects.find((object) => object.id === stickyId)?.contentBlocks).toHaveLength(1);

    useEditorStore.getState().undo();
    expect(useEditorStore.getState().scene.objects.find((object) => object.id === stickyId)?.contentBlocks).toHaveLength(2);

    useEditorStore.getState().redo();
    expect(useEditorStore.getState().scene.objects.find((object) => object.id === stickyId)?.contentBlocks).toHaveLength(1);
  });

  it('records drag history once and clears redo after a new mutation', () => {
    useEditorStore.getState().createObjectAtViewportCenter('shape');
    const shapeId = useEditorStore.getState().selection.primaryId;
    const initialX = useEditorStore.getState().scene.objects.find((object) => object.id === shapeId)?.x ?? 0;

    const before = useEditorStore.getState().captureHistorySnapshot();
    useEditorStore.getState().moveSelection(12, 0);
    useEditorStore.getState().moveSelection(18, 0);
    useEditorStore.getState().commitHistoryEntry('Move selection', before);

    expect(useEditorStore.getState().scene.objects.find((object) => object.id === shapeId)?.x).toBe(initialX + 30);

    useEditorStore.getState().undo();
    expect(useEditorStore.getState().scene.objects.find((object) => object.id === shapeId)?.x).toBe(initialX);

    useEditorStore.getState().redo();
    expect(useEditorStore.getState().scene.objects.find((object) => object.id === shapeId)?.x).toBe(initialX + 30);

    useEditorStore.getState().undo();
    useEditorStore.getState().createObjectAtViewportCenter('sticky');
    expect(useEditorStore.getState().canRedo()).toBe(false);
  });

  it('keeps viewport and overlay-only changes out of history', () => {
    const state = useEditorStore.getState();

    state.panViewport(10, 12);
    state.setMarquee({
      x: 0,
      y: 0,
      width: 20,
      height: 20,
      originX: 0,
      originY: 0,
    });
    state.setContextMenu({
      objectId: 'shape-1',
      x: 10,
      y: 10,
    });
    state.togglePanel('outliner');
    state.setTemporaryToolOverride('pan');

    expect(state.canUndo()).toBe(false);
    expect(getEffectiveTool(useEditorStore.getState())).toBe('pan');
  });
});
