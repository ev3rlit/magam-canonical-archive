import {
  parseColorInput,
  resolveFillColor,
  resolveOutlineColor,
} from '../editor-appearance';
import { createBodyDocument, createBodyImageNode, createBodyParagraphNode } from '../editor-body';
import {
  cloneBody,
  createSeedBodyDocument,
  getCanvasObjectMinimumHeight,
} from '../editor-content-blocks';
import { getChildObjects, getDescendantIds, normalizeRotationDegrees } from '../editor-geometry';
import type {
  EditorCanvasObject,
  EditorCanvasObjectKind,
  EditorReferenceTarget,
} from '../editor-types';
import type { EditorClipboardState } from '../editor-state';

const MIN_OBJECT_WIDTH = 120;
const MIN_OBJECT_HEIGHT = 96;

const OBJECT_DEFAULTS: Record<
  Exclude<EditorCanvasObjectKind, 'group'>,
  Pick<EditorCanvasObject, 'width' | 'height' | 'fillPreset' | 'outlinePreset'>
> = {
  shape: {
    width: 184,
    height: 124,
    fillPreset: 'iris',
    outlinePreset: 'thin',
  },
  sticky: {
    width: 208,
    height: 208,
    fillPreset: 'amber',
    outlinePreset: 'thin',
  },
  text: {
    width: 240,
    height: 108,
    fillPreset: 'slate',
    outlinePreset: 'none',
  },
  image: {
    width: 252,
    height: 180,
    fillPreset: 'sky',
    outlinePreset: 'thin',
  },
  frame: {
    width: 380,
    height: 256,
    fillPreset: 'sky',
    outlinePreset: 'thin',
  },
};

export interface ObjectCommandDeps {
  createObjectId: (prefix: string) => string;
  placeholderImageSrc: string;
}

function getKindLabel(kind: EditorCanvasObjectKind) {
  switch (kind) {
    case 'shape':
      return 'Shape';
    case 'sticky':
      return 'Sticky';
    case 'text':
      return 'Text';
    case 'image':
      return 'Image';
    case 'frame':
      return 'Frame';
    case 'group':
      return 'Group';
  }
}

function getObjectOrdinal(id: string) {
  const next = Number(id.split('-').at(-1));
  return Number.isFinite(next) ? next : id;
}

export function getObjectDefaults(kind: Exclude<EditorCanvasObjectKind, 'group'>) {
  return OBJECT_DEFAULTS[kind];
}

export function cloneCanvasObjects(objects: EditorCanvasObject[]) {
  return objects.map((object) => ({
    ...object,
    body: cloneBody(object.body),
  }));
}

export function buildDraftObject(
  input: {
    kind: Exclude<EditorCanvasObjectKind, 'group'>;
    x: number;
    y: number;
    zIndex: number;
    parentId?: string | null;
  },
  deps: ObjectCommandDeps,
): EditorCanvasObject {
  const defaults = OBJECT_DEFAULTS[input.kind];
  const id = deps.createObjectId(input.kind);

  return {
    id,
    kind: input.kind,
    name: `${getKindLabel(input.kind)} ${getObjectOrdinal(id)}`,
    parentId: input.parentId ?? null,
    x: input.x,
    y: input.y,
    width: defaults.width,
    height: defaults.height,
    rotation: 0,
    zIndex: input.zIndex,
    locked: false,
    visible: true,
    fillPreset: defaults.fillPreset,
    fillColor: resolveFillColor(defaults.fillPreset),
    outlinePreset: defaults.outlinePreset,
    outlineColor: resolveOutlineColor(defaults.fillPreset),
    shapeVariant: input.kind === 'shape' ? 'rectangle' : undefined,
    body: createSeedBodyDocument({
      kind: input.kind,
      placeholderImageSrc: deps.placeholderImageSrc,
    }),
    libraryItemId: null,
    referenceTarget: null,
  };
}

export function cloneBranch(
  rootId: string,
  objects: EditorCanvasObject[],
  offset: { x: number; y: number },
  parentId: string | null,
  clones: EditorCanvasObject[],
  deps: Pick<ObjectCommandDeps, 'createObjectId'>,
) {
  const original = objects.find((object) => object.id === rootId);
  if (!original) {
    return;
  }

  const nextId = deps.createObjectId(original.kind);
  clones.push({
    ...original,
    id: nextId,
    name: `${original.name} copy`,
    body: cloneBody(original.body),
    parentId,
    x: original.x + offset.x,
    y: original.y + offset.y,
    zIndex: original.zIndex + 20,
  });

  getChildObjects(objects, rootId).forEach((child) => {
    cloneBranch(child.id, objects, offset, nextId, clones, deps);
  });
}

export function duplicateSnapshotObjects(
  objects: EditorCanvasObject[],
  offset: { x: number; y: number },
  libraryItemId: string | null,
  deps: Pick<ObjectCommandDeps, 'createObjectId'>,
) {
  const idMap = new Map<string, string>();
  const clones = objects.map((object) => {
    const nextId = deps.createObjectId(object.kind);
    idMap.set(object.id, nextId);
    return {
      ...object,
      id: nextId,
      name: `${object.name} copy`,
      parentId: object.parentId,
      x: object.x + offset.x,
      y: object.y + offset.y,
      zIndex: object.zIndex + 20,
      body: cloneBody(object.body),
      libraryItemId: libraryItemId ?? object.libraryItemId ?? null,
      referenceTarget: object.referenceTarget ?? null,
    };
  });

  return {
    clones: clones.map((object) => ({
      ...object,
      parentId: object.parentId ? (idMap.get(object.parentId) ?? null) : null,
    })),
    idMap,
  };
}

export function createAssetImageObject(
  input: {
    itemId: string;
    src: string;
    alt: string;
    width?: number;
    height?: number;
  },
  deps: ObjectCommandDeps,
) {
  const nextObject = buildDraftObject(
    {
      kind: 'image',
      x: 0,
      y: 0,
      zIndex: 1,
    },
    deps,
  );

  return {
    ...nextObject,
    width: input.width ?? nextObject.width,
    height: input.height ?? nextObject.height,
    libraryItemId: input.itemId,
    body: createBodyDocument([
      createBodyImageNode({
        src: input.src,
        alt: input.alt,
      }),
      createBodyParagraphNode(input.alt),
    ]),
  };
}

export function createReferenceCanvasObject(
  input: {
    itemId: string;
    title: string;
    summary?: string | null;
    target: EditorReferenceTarget;
  },
  deps: ObjectCommandDeps,
) {
  const nextObject = buildDraftObject(
    {
      kind: 'text',
      x: 0,
      y: 0,
      zIndex: 1,
    },
    deps,
  );

  const lines = [input.title, input.summary ?? '', input.target.value].filter((value) => value.length > 0);
  return {
    ...nextObject,
    name: input.title,
    libraryItemId: input.itemId,
    referenceTarget: input.target,
    body: createBodyDocument(lines.map((line) => createBodyParagraphNode(line))),
  };
}

export function createGroupObject(
  input: {
    parentId: string | null;
    x: number;
    y: number;
    width: number;
    height: number;
    zIndex: number;
  },
  deps: Pick<ObjectCommandDeps, 'createObjectId'>,
): EditorCanvasObject {
  const id = deps.createObjectId('group');

  return {
    id,
    kind: 'group',
    name: `Group ${getObjectOrdinal(id)}`,
    parentId: input.parentId,
    x: input.x,
    y: input.y,
    width: input.width,
    height: input.height,
    rotation: 0,
    zIndex: input.zIndex,
    locked: false,
    visible: true,
    fillPreset: 'slate',
    fillColor: resolveFillColor('slate'),
    outlinePreset: 'none',
    outlineColor: resolveOutlineColor('slate'),
    shapeVariant: undefined,
    body: createBodyDocument(),
  };
}

export function removeObjects(objects: EditorCanvasObject[], ids: string[]) {
  const removalIds = new Set<string>();
  ids.forEach((id) => {
    removalIds.add(id);
    getDescendantIds(id, objects).forEach((descendantId) => removalIds.add(descendantId));
  });
  return objects.filter((object) => !removalIds.has(object.id));
}

export function restackObjects(
  objects: EditorCanvasObject[],
  ids: string[],
  direction: 'front' | 'back' | 'forward' | 'backward',
) {
  const selection = new Set(ids);
  const ordered = [...objects].sort((left, right) => left.zIndex - right.zIndex);

  if (direction === 'front' || direction === 'back') {
    const rest = ordered.filter((object) => !selection.has(object.id));
    const moving = ordered.filter((object) => selection.has(object.id));
    const nextOrdered = direction === 'front' ? [...rest, ...moving] : [...moving, ...rest];

    return nextOrdered.map((object, index) => ({
      ...object,
      zIndex: index + 1,
    }));
  }

  const nextOrdered = [...ordered];
  if (direction === 'forward') {
    for (let index = nextOrdered.length - 2; index >= 0; index -= 1) {
      if (selection.has(nextOrdered[index]!.id) && !selection.has(nextOrdered[index + 1]!.id)) {
        [nextOrdered[index], nextOrdered[index + 1]] = [nextOrdered[index + 1]!, nextOrdered[index]!];
      }
    }
  } else {
    for (let index = 1; index < nextOrdered.length; index += 1) {
      if (selection.has(nextOrdered[index]!.id) && !selection.has(nextOrdered[index - 1]!.id)) {
        [nextOrdered[index - 1], nextOrdered[index]] = [nextOrdered[index]!, nextOrdered[index - 1]!];
      }
    }
  }

  return nextOrdered.map((object, index) => ({
    ...object,
    zIndex: index + 1,
  }));
}

export function createClipboardSnapshot(
  selectionIds: string[],
  objects: EditorCanvasObject[],
  getSelectionRoots: (selectionIds: string[], objects: EditorCanvasObject[]) => string[],
): EditorClipboardState {
  const rootIds = getSelectionRoots(selectionIds, objects);
  const copiedIds = new Set<string>();

  rootIds.forEach((rootId) => {
    copiedIds.add(rootId);
    getDescendantIds(rootId, objects).forEach((descendantId) => copiedIds.add(descendantId));
  });

  return {
    objects: cloneCanvasObjects(objects.filter((object) => copiedIds.has(object.id))),
    rootIds,
    pasteCount: 0,
  };
}

export function getMinimumObjectHeight(object: EditorCanvasObject) {
  if (object.kind === 'group') {
    return MIN_OBJECT_HEIGHT;
  }
  return Math.max(MIN_OBJECT_HEIGHT, getCanvasObjectMinimumHeight(object));
}

export function setFieldPatch(
  object: EditorCanvasObject,
  field: keyof EditorCanvasObject,
  value: string,
) {
  if (field === 'x' || field === 'y' || field === 'width' || field === 'height' || field === 'zIndex' || field === 'rotation') {
    const nextValue = Number(value);
    if (!Number.isFinite(nextValue)) {
      return object;
    }

    if (field === 'width') {
      return {
        ...object,
        width: Math.max(nextValue, MIN_OBJECT_WIDTH),
      };
    }

    if (field === 'height') {
      return {
        ...object,
        height: Math.max(nextValue, getMinimumObjectHeight(object)),
      };
    }

    if (field === 'rotation') {
      return {
        ...object,
        rotation: normalizeRotationDegrees(nextValue),
      };
    }

    return {
      ...object,
      [field]: nextValue,
    };
  }

  return {
    ...object,
    [field]: value,
  };
}

export function sanitizeObjectPatch(object: EditorCanvasObject, patch: Partial<EditorCanvasObject>) {
  const nextPatch = { ...patch };

  if (typeof nextPatch.width === 'number') {
    nextPatch.width = Math.max(nextPatch.width, MIN_OBJECT_WIDTH);
  }

  if (typeof nextPatch.height === 'number') {
    nextPatch.height = Math.max(nextPatch.height, getMinimumObjectHeight({
      ...object,
      width: typeof nextPatch.width === 'number' ? nextPatch.width : object.width,
    }));
  }

  if (typeof nextPatch.rotation === 'number') {
    nextPatch.rotation = normalizeRotationDegrees(nextPatch.rotation);
  }

  if (typeof nextPatch.fillColor === 'string') {
    nextPatch.fillColor = parseColorInput(nextPatch.fillColor, object.fillColor);
  }

  if (typeof nextPatch.outlineColor === 'string') {
    nextPatch.outlineColor = parseColorInput(nextPatch.outlineColor, object.outlineColor);
  }

  if (typeof nextPatch.shapeVariant === 'string' && object.kind !== 'shape') {
    delete nextPatch.shapeVariant;
  }

  return nextPatch;
}
