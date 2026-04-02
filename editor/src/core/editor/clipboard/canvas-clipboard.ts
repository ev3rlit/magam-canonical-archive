import type { EditorBodyDocument } from '@/core/editor/model/editor-body';
import type { EditorClipboardState } from '@/core/editor/model/editor-state';
import type { EditorCanvasObject, EditorReferenceTarget } from '@/core/editor/model/editor-types';

export const MAGAM_CLIPBOARD_MIME_TYPE = 'application/x-magam-canvas';

interface SerializedClipboardPayload {
  kind: 'magam.canvas.clipboard';
  version: 1;
  clipboard: EditorClipboardState;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isBodyDocument(value: unknown): value is EditorBodyDocument {
  return isRecord(value)
    && value['type'] === 'doc'
    && Array.isArray(value['content']);
}

function isReferenceTarget(value: unknown): value is EditorReferenceTarget | null | undefined {
  if (value === undefined || value === null) {
    return true;
  }

  return isRecord(value)
    && (value['kind'] === 'url' || value['kind'] === 'canvas' || value['kind'] === 'object')
    && typeof value['value'] === 'string';
}

function isEditorCanvasObject(value: unknown): value is EditorCanvasObject {
  return isRecord(value)
    && typeof value['id'] === 'string'
    && typeof value['kind'] === 'string'
    && typeof value['name'] === 'string'
    && (typeof value['parentId'] === 'string' || value['parentId'] === null)
    && typeof value['x'] === 'number'
    && typeof value['y'] === 'number'
    && typeof value['width'] === 'number'
    && typeof value['height'] === 'number'
    && typeof value['rotation'] === 'number'
    && typeof value['zIndex'] === 'number'
    && typeof value['locked'] === 'boolean'
    && typeof value['visible'] === 'boolean'
    && typeof value['fillPreset'] === 'string'
    && typeof value['fillColor'] === 'string'
    && typeof value['outlinePreset'] === 'string'
    && typeof value['outlineColor'] === 'string'
    && (typeof value['shapeVariant'] === 'string' || value['shapeVariant'] === undefined)
    && isBodyDocument(value['body'])
    && (typeof value['libraryItemId'] === 'string' || value['libraryItemId'] === null || value['libraryItemId'] === undefined)
    && isReferenceTarget(value['referenceTarget']);
}

function isClipboardState(value: unknown): value is EditorClipboardState {
  return isRecord(value)
    && Array.isArray(value['objects'])
    && value['objects'].every(isEditorCanvasObject)
    && Array.isArray(value['rootIds'])
    && value['rootIds'].every((rootId) => typeof rootId === 'string')
    && typeof value['pasteCount'] === 'number';
}

export function serializeClipboardSnapshot(clipboard: EditorClipboardState) {
  const payload: SerializedClipboardPayload = {
    kind: 'magam.canvas.clipboard',
    version: 1,
    clipboard,
  };

  return JSON.stringify(payload);
}

export function deserializeClipboardSnapshot(raw: string): EditorClipboardState | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (
    !isRecord(parsed)
    || parsed['kind'] !== 'magam.canvas.clipboard'
    || parsed['version'] !== 1
    || !isClipboardState(parsed['clipboard'])
  ) {
    return null;
  }

  return parsed['clipboard'];
}

export function describeClipboardSnapshot(clipboard: EditorClipboardState) {
  const rootObjects = clipboard.rootIds
    .map((rootId) => clipboard.objects.find((object) => object.id === rootId))
    .filter((object): object is EditorCanvasObject => object !== undefined);

  if (rootObjects.length === 0) {
    return 'Magam canvas selection';
  }

  if (rootObjects.length === 1) {
    return `Magam canvas selection: ${rootObjects[0].name}`;
  }

  return `Magam canvas selection: ${rootObjects.length} objects`;
}
