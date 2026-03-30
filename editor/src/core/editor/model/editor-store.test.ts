import { beforeEach, describe, expect, it } from 'vitest';
import { createBodyDocument, createBodyImageNode, createBodyParagraphNode } from './editor-body';
import { getSelectionTransformFrame } from './editor-geometry';
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

  it('seeds new objects with explicit appearance defaults', () => {
    useEditorStore.getState().createObjectAtViewportCenter('shape');
    const shape = useEditorStore.getState().scene.objects[0]!;

    expect(shape.fillPreset).toBe('iris');
    expect(shape.fillColor).toBe('#ecebff');
    expect(shape.outlinePreset).toBe('thin');
    expect(shape.outlineColor).toBe('#5851ff');
    expect(shape.shapeVariant).toBe('rectangle');
  });

  it('copies the current selection into the clipboard and pastes offset clones', () => {
    useEditorStore.getState().createObjectAtViewportCenter('shape');
    const originalId = useEditorStore.getState().selection.primaryId!;
    const original = useEditorStore.getState().scene.objects.find((object) => object.id === originalId)!;

    useEditorStore.getState().copySelection();
    expect(useEditorStore.getState().clipboard.rootIds).toEqual([originalId]);

    useEditorStore.getState().pasteClipboard();
    expect(useEditorStore.getState().scene.objects).toHaveLength(2);

    const firstPaste = useEditorStore.getState().scene.objects.find((object) => object.id !== originalId)!;
    expect(firstPaste.x).toBe(original.x + 24);
    expect(firstPaste.y).toBe(original.y + 24);

    useEditorStore.getState().pasteClipboard();
    const pastedObjects = useEditorStore.getState().scene.objects.filter((object) => object.id !== originalId);
    const secondPaste = pastedObjects.find((object) => object.id !== firstPaste.id)!;
    expect(secondPaste.x).toBe(original.x + 48);
    expect(secondPaste.y).toBe(original.y + 48);
  });

  it('moves selection one z-order step forward and backward', () => {
    useEditorStore.getState().createObjectAtViewportCenter('shape');
    const shapeId = useEditorStore.getState().selection.primaryId!;
    useEditorStore.getState().createObjectAtViewportCenter('sticky');
    const stickyId = useEditorStore.getState().selection.primaryId!;

    useEditorStore.getState().selectOnly(shapeId);
    useEditorStore.getState().bringSelectionForward();
    expect(
      useEditorStore.getState().scene.objects
        .sort((left, right) => left.zIndex - right.zIndex)
        .map((object) => object.id),
    ).toEqual([stickyId, shapeId]);

    useEditorStore.getState().sendSelectionBackward();
    expect(
      useEditorStore.getState().scene.objects
        .sort((left, right) => left.zIndex - right.zIndex)
        .map((object) => object.id),
    ).toEqual([shapeId, stickyId]);
  });

  it('tracks shape variant and custom appearance changes through undo and redo', () => {
    useEditorStore.getState().createObjectAtViewportCenter('shape');
    const shapeId = useEditorStore.getState().selection.primaryId!;

    useEditorStore.getState().updateObjectPatch(shapeId, {
      shapeVariant: 'pill',
      fillColor: '#112233',
      outlinePreset: 'dashed',
      outlineColor: '#445566',
    });

    let shape = useEditorStore.getState().scene.objects.find((object) => object.id === shapeId)!;
    expect(shape.shapeVariant).toBe('pill');
    expect(shape.fillColor).toBe('#112233');
    expect(shape.outlinePreset).toBe('dashed');
    expect(shape.outlineColor).toBe('#445566');

    useEditorStore.getState().undo();
    shape = useEditorStore.getState().scene.objects.find((object) => object.id === shapeId)!;
    expect(shape.shapeVariant).toBe('rectangle');
    expect(shape.fillColor).toBe('#ecebff');
    expect(shape.outlinePreset).toBe('thin');
    expect(shape.outlineColor).toBe('#5851ff');

    useEditorStore.getState().redo();
    shape = useEditorStore.getState().scene.objects.find((object) => object.id === shapeId)!;
    expect(shape.shapeVariant).toBe('pill');
    expect(shape.fillColor).toBe('#112233');
    expect(shape.outlinePreset).toBe('dashed');
    expect(shape.outlineColor).toBe('#445566');
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

  it('seeds sticky and shape objects with empty documents and image objects with image-first documents', () => {
    useEditorStore.getState().createObjectAtViewportCenter('sticky');
    const stickyId = useEditorStore.getState().selection.primaryId!;
    const sticky = useEditorStore.getState().scene.objects.find((object) => object.id === stickyId);

    expect(sticky?.body.content).toEqual([
      expect.objectContaining({
        type: 'paragraph',
      }),
    ]);

    useEditorStore.getState().createObjectAtViewportCenter('shape');
    const shapeId = useEditorStore.getState().selection.primaryId!;
    const shape = useEditorStore.getState().scene.objects.find((object) => object.id === shapeId);

    expect(shape?.body.content).toEqual([
      expect.objectContaining({
        type: 'paragraph',
      }),
    ]);

    useEditorStore.getState().createObjectAtViewportCenter('image');
    const imageId = useEditorStore.getState().selection.primaryId!;
    const image = useEditorStore.getState().scene.objects.find((object) => object.id === imageId);

    expect(image?.body.content).toEqual([
      expect.objectContaining({
        type: 'image',
      }),
      expect.objectContaining({
        type: 'paragraph',
      }),
    ]);
  });

  it('tracks document body commits through undo and redo without per-keystroke history noise', () => {
    useEditorStore.getState().createObjectAtViewportCenter('sticky');
    const stickyId = useEditorStore.getState().selection.primaryId!;
    useEditorStore.getState().updateObjectBody(stickyId, createBodyDocument([
      {
        type: 'heading',
        attrs: { level: 1 },
        content: [{ type: 'text', text: 'First block' }],
      },
      createBodyParagraphNode('Second block'),
    ]));

    let sticky = useEditorStore.getState().scene.objects.find((object) => object.id === stickyId)!;
    expect(sticky.body.content).toHaveLength(2);

    useEditorStore.getState().updateObjectBody(stickyId, createBodyDocument([
      createBodyParagraphNode('Second block'),
    ]));
    expect(useEditorStore.getState().scene.objects.find((object) => object.id === stickyId)?.body.content).toHaveLength(1);

    useEditorStore.getState().undo();
    sticky = useEditorStore.getState().scene.objects.find((object) => object.id === stickyId)!;
    expect(sticky.body.content).toHaveLength(2);

    useEditorStore.getState().redo();
    expect(useEditorStore.getState().scene.objects.find((object) => object.id === stickyId)?.body.content).toHaveLength(1);
  });

  it('opens and closes the body editor for selected objects', () => {
    useEditorStore.getState().createObjectAtViewportCenter('sticky');
    const stickyId = useEditorStore.getState().selection.primaryId!;

    useEditorStore.getState().openBodyEditor(stickyId, '/');
    expect(useEditorStore.getState().overlays.activeBodyEditorObjectId).toBe(stickyId);
    expect(useEditorStore.getState().overlays.isBodyEditorOpen).toBe(true);
    expect(useEditorStore.getState().overlays.bodyEditorSession?.dirty).toBe(false);
    expect(useEditorStore.getState().consumeBodyEditorPendingText()).toBe('/');
    expect(useEditorStore.getState().overlays.bodyEditorPendingText).toBeNull();

    useEditorStore.getState().discardActiveBodyEditor();
    expect(useEditorStore.getState().overlays.activeBodyEditorObjectId).toBeNull();
    expect(useEditorStore.getState().overlays.isBodyEditorOpen).toBe(false);
  });

  it('keeps the body draft in session until explicit commit and then writes it once', () => {
    useEditorStore.getState().createObjectAtViewportCenter('sticky');
    const stickyId = useEditorStore.getState().selection.primaryId!;

    useEditorStore.getState().openBodyEditor(stickyId);
    useEditorStore.getState().updateBodyEditorDraft(stickyId, createBodyDocument([
      createBodyParagraphNode('draft body'),
    ]));

    expect(useEditorStore.getState().overlays.bodyEditorSession).toEqual(expect.objectContaining({
      objectId: stickyId,
      dirty: true,
    }));
    expect(useEditorStore.getState().scene.objects.find((object) => object.id === stickyId)?.body.content[0])
      .toEqual(expect.objectContaining({ type: 'paragraph' }));

    useEditorStore.getState().commitActiveBodyEditor();
    expect(useEditorStore.getState().scene.objects.find((object) => object.id === stickyId)?.body.content[0])
      .toEqual(expect.objectContaining({
        type: 'paragraph',
        content: [{ type: 'text', text: 'draft body' }],
      }));
    expect(useEditorStore.getState().overlays.bodyEditorSession).toBeNull();
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

  it('resizes and rotates a single selection through transform actions', () => {
    useEditorStore.getState().createObjectAtViewportCenter('shape');
    const historyBefore = useEditorStore.getState().captureHistorySnapshot();
    const baseFrame = getSelectionTransformFrame(useEditorStore.getState().selection, historyBefore.objects)!;

    useEditorStore.getState().resizeSelection({
      baseObjects: historyBefore.objects,
      baseFrame,
      nextFrame: {
        ...baseFrame,
        x: baseFrame.x - 20,
        y: baseFrame.y - 12,
        width: baseFrame.width + 60,
        height: baseFrame.height + 36,
      },
    });

    const resized = useEditorStore.getState().scene.objects[0]!;
    expect(resized.width).toBeGreaterThan(baseFrame.width);
    expect(resized.height).toBeGreaterThan(baseFrame.height);

    useEditorStore.getState().rotateSelection({
      baseObjects: useEditorStore.getState().captureHistorySnapshot().objects,
      baseFrame: getSelectionTransformFrame(useEditorStore.getState().selection, useEditorStore.getState().scene.objects)!,
      nextFrame: {
        ...getSelectionTransformFrame(useEditorStore.getState().selection, useEditorStore.getState().scene.objects)!,
        rotation: 90,
      },
    });

    expect(useEditorStore.getState().scene.objects[0]?.rotation).toBe(90);
  });

  it('keeps multi-selection spacing and group descendants coherent during transforms', () => {
    useEditorStore.getState().createObjectAtViewportCenter('shape');
    const firstId = useEditorStore.getState().selection.primaryId!;
    useEditorStore.getState().createObjectAtViewportCenter('sticky');
    const secondId = useEditorStore.getState().selection.primaryId!;
    useEditorStore.getState().selectMany([firstId, secondId], secondId);
    useEditorStore.getState().groupSelection();

    const groupId = useEditorStore.getState().selection.primaryId!;
    const childIds = useEditorStore.getState().scene.objects
      .filter((object) => object.parentId === groupId)
      .map((object) => object.id);
    const before = useEditorStore.getState().captureHistorySnapshot();
    const baseFrame = getSelectionTransformFrame(useEditorStore.getState().selection, before.objects)!;

    useEditorStore.getState().rotateSelection({
      baseObjects: before.objects,
      baseFrame,
      nextFrame: {
        ...baseFrame,
        rotation: 90,
      },
    });

    const rotatedGroup = useEditorStore.getState().scene.objects.find((object) => object.id === groupId)!;
    const rotatedChildren = useEditorStore.getState().scene.objects.filter((object) => childIds.includes(object.id));

    expect(rotatedGroup.rotation).toBe(90);
    expect(rotatedChildren.every((object) => object.rotation === 90)).toBe(true);
  });

  it('does not mutate locked selections through transform actions', () => {
    useEditorStore.getState().createObjectAtViewportCenter('shape');
    const shapeId = useEditorStore.getState().selection.primaryId!;
    useEditorStore.getState().updateObjectPatch(shapeId, { locked: true });
    const before = useEditorStore.getState().captureHistorySnapshot();
    const baseFrame = getSelectionTransformFrame(useEditorStore.getState().selection, before.objects)!;

    useEditorStore.getState().resizeSelection({
      baseObjects: before.objects,
      baseFrame,
      nextFrame: {
        ...baseFrame,
        width: baseFrame.width + 80,
        height: baseFrame.height + 40,
      },
    });

    const lockedShape = useEditorStore.getState().scene.objects.find((object) => object.id === shapeId)!;
    expect(lockedShape.width).toBe(before.objects.find((object) => object.id === shapeId)!.width);
    expect(lockedShape.height).toBe(before.objects.find((object) => object.id === shapeId)!.height);
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
