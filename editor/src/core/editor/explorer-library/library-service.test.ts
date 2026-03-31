// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';
import { createBodyDocument, createBodyParagraphNode } from '@/core/editor/model/editor-body';
import { useEditorStore } from '@/core/editor/model/editor-store';
import {
  getExplorerLibraryService,
  resetExplorerLibraryServiceForTests,
} from './library-service';
import { resetExplorerLibraryStoreForTests } from './library-store';

describe('Explorer Library service', () => {
  beforeEach(async () => {
    await resetExplorerLibraryServiceForTests();
    resetExplorerLibraryStoreForTests();
    useEditorStore.getState().reset();
    useEditorStore.getState().setViewportRect(1200, 800);
    window.matchMedia = window.matchMedia ?? (((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    })) as typeof window.matchMedia);
  });

  it('creates a template from the current selection and instantiates a detached clone', async () => {
    const service = await getExplorerLibraryService();

    useEditorStore.getState().createObjectAtViewportCenter('sticky');
    const originalId = useEditorStore.getState().selection.primaryId!;
    useEditorStore.getState().updateObjectBody(originalId, createBodyDocument([
      createBodyParagraphNode('Original note'),
    ]));

    const created = await service.createTemplateFromSelection();
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    const applied = await service.applyItemToCanvas(created.value.id);
    expect(applied.ok).toBe(true);

    const objects = useEditorStore.getState().scene.objects;
    expect(objects).toHaveLength(2);

    const clone = objects.find((object) => object.id !== originalId)!;
    expect(clone.libraryItemId).toBe(created.value.id);
    expect(clone.id).not.toBe(originalId);

    useEditorStore.getState().updateObjectBody(clone.id, createBodyDocument([
      createBodyParagraphNode('Changed clone'),
    ]));

    expect(useEditorStore.getState().scene.objects.find((object) => object.id === originalId)?.body.content[0])
      .toEqual(expect.objectContaining({
        type: 'paragraph',
        content: [{ type: 'text', text: 'Original note' }],
      }));
  });

  it('imports a clipboard image into the library and places it on the canvas as imported', async () => {
    const service = await getExplorerLibraryService();

    const imported = await service.importClipboardImageAndPlace(new File(
      [Uint8Array.from([1, 2, 3, 4])],
      'clipboard.png',
      { type: 'image/png' },
    ));

    expect(imported.ok).toBe(true);

    const listed = await service.listItems({ visibility: 'imported' });
    expect(listed.ok).toBe(true);
    if (!listed.ok) {
      return;
    }

    expect(listed.value).toHaveLength(1);
    expect(listed.value[0]?.type).toBe('asset');

    const placedImage = useEditorStore.getState().scene.objects.find((object) => object.kind === 'image');
    expect(placedImage?.libraryItemId).toBe(listed.value[0]?.id);
  });

  it('promotes imported assets when metadata curation is explicit', async () => {
    const service = await getExplorerLibraryService();

    await service.importClipboardImageAndPlace(new File(
      [Uint8Array.from([1, 2, 3, 4])],
      'clipboard.png',
      { type: 'image/png' },
    ));
    const imported = await service.listItems({ visibility: 'imported' });
    expect(imported.ok).toBe(true);
    if (!imported.ok) {
      return;
    }

    const promoted = await service.updateItemMetadata({
      itemId: imported.value[0]!.id,
      tags: ['curated'],
    });
    expect(promoted.ok).toBe(true);
    if (!promoted.ok) {
      return;
    }

    expect(promoted.value.visibility).toBe('curated');
  });

  it('saves object references and reopens the target object', async () => {
    const service = await getExplorerLibraryService();

    useEditorStore.getState().createObjectAtViewportCenter('shape');
    const targetId = useEditorStore.getState().selection.primaryId!;
    const created = await service.createReferenceItem({
      title: 'Shape reference',
      targetKind: 'object',
      target: targetId,
      displayHint: 'Jump back to the shape',
    });

    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    const applied = await service.applyItemToCanvas(created.value.id);
    expect(applied.ok).toBe(true);

    const referenceObject = useEditorStore.getState().scene.objects.find((object) => object.libraryItemId === created.value.id);
    expect(referenceObject?.referenceTarget).toEqual({
      kind: 'object',
      value: targetId,
    });

    useEditorStore.getState().clearSelection();
    const opened = await service.openReference(created.value.id);
    expect(opened.ok).toBe(true);
    expect(useEditorStore.getState().selection.primaryId).toBe(targetId);
  });
});
