import type {
  EditorBounds,
  EditorCanvasObject,
  EditorHierarchyNode,
  EditorMarqueeState,
  EditorSelectionState,
  EditorViewportState,
} from './editor-types';
import { estimateCanvasObjectHeight } from './editor-content-blocks';

const GROUP_PADDING = 24;

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function normalizeBounds(bounds: EditorBounds): EditorBounds {
  const x = bounds.width < 0 ? bounds.x + bounds.width : bounds.x;
  const y = bounds.height < 0 ? bounds.y + bounds.height : bounds.y;
  return {
    x,
    y,
    width: Math.abs(bounds.width),
    height: Math.abs(bounds.height),
  };
}

export function marqueeToBounds(marquee: EditorMarqueeState): EditorBounds {
  return normalizeBounds(marquee);
}

export function createObjectMap(objects: EditorCanvasObject[]) {
  return new Map(objects.map((object) => [object.id, object]));
}

export function getChildObjects(objects: EditorCanvasObject[], parentId: string | null) {
  return objects
    .filter((object) => object.parentId === parentId)
    .sort((left, right) => left.zIndex - right.zIndex);
}

export function getDescendantIds(
  objectId: string,
  objects: EditorCanvasObject[],
): string[] {
  const directChildren = getChildObjects(objects, objectId);
  return directChildren.flatMap((child) => [child.id, ...getDescendantIds(child.id, objects)]);
}

export function getAncestorIds(objectId: string, objectMap: Map<string, EditorCanvasObject>) {
  const ancestors: string[] = [];
  let current = objectMap.get(objectId)?.parentId ?? null;
  while (current) {
    ancestors.push(current);
    current = objectMap.get(current)?.parentId ?? null;
  }
  return ancestors;
}

export function hasSelectedAncestor(
  objectId: string,
  selectionIds: string[],
  objectMap: Map<string, EditorCanvasObject>,
) {
  const selection = new Set(selectionIds);
  return getAncestorIds(objectId, objectMap).some((ancestorId) => selection.has(ancestorId));
}

export function getEffectiveBounds(
  object: EditorCanvasObject,
  objects: EditorCanvasObject[],
): EditorBounds {
  if (object.kind !== 'group') {
    return {
      x: object.x,
      y: object.y,
      width: object.width,
      height: estimateCanvasObjectHeight(object),
    };
  }

  const descendants = getChildObjects(objects, object.id);
  if (descendants.length === 0) {
    return {
      x: object.x,
      y: object.y,
      width: object.width,
      height: object.height,
    };
  }

  const childBounds = descendants.map((child) => getEffectiveBounds(child, objects));
  const x = Math.min(...childBounds.map((bounds) => bounds.x)) - GROUP_PADDING;
  const y = Math.min(...childBounds.map((bounds) => bounds.y)) - GROUP_PADDING - 12;
  const maxX = Math.max(...childBounds.map((bounds) => bounds.x + bounds.width)) + GROUP_PADDING;
  const maxY = Math.max(...childBounds.map((bounds) => bounds.y + bounds.height)) + GROUP_PADDING;

  return {
    x,
    y,
    width: maxX - x,
    height: maxY - y,
  };
}

export function getSelectionBounds(
  selection: EditorSelectionState,
  objects: EditorCanvasObject[],
): EditorBounds | null {
  if (selection.ids.length === 0) {
    return null;
  }

  const objectMap = createObjectMap(objects);
  const selectedBounds = selection.ids
    .filter((id) => !hasSelectedAncestor(id, selection.ids, objectMap))
    .map((id) => objectMap.get(id))
    .filter((object): object is EditorCanvasObject => Boolean(object))
    .map((object) => getEffectiveBounds(object, objects));

  if (selectedBounds.length === 0) {
    return null;
  }

  const x = Math.min(...selectedBounds.map((bounds) => bounds.x));
  const y = Math.min(...selectedBounds.map((bounds) => bounds.y));
  const maxX = Math.max(...selectedBounds.map((bounds) => bounds.x + bounds.width));
  const maxY = Math.max(...selectedBounds.map((bounds) => bounds.y + bounds.height));

  return {
    x,
    y,
    width: maxX - x,
    height: maxY - y,
  };
}

export function intersectsBounds(source: EditorBounds, target: EditorBounds) {
  return (
    source.x < target.x + target.width &&
    source.x + source.width > target.x &&
    source.y < target.y + target.height &&
    source.y + source.height > target.y
  );
}

export function worldPointFromClient(input: {
  clientX: number;
  clientY: number;
  stageRect: DOMRect;
  viewport: EditorViewportState;
}) {
  return {
    x: (input.clientX - input.stageRect.left - input.viewport.x) / input.viewport.zoom,
    y: (input.clientY - input.stageRect.top - input.viewport.y) / input.viewport.zoom,
  };
}

export function screenBoundsFromWorld(bounds: EditorBounds, viewport: EditorViewportState): EditorBounds {
  return {
    x: viewport.x + bounds.x * viewport.zoom,
    y: viewport.y + bounds.y * viewport.zoom,
    width: bounds.width * viewport.zoom,
    height: bounds.height * viewport.zoom,
  };
}

export function clampFloatingPosition(input: {
  stageRect: Pick<DOMRect, 'width' | 'height'>;
  menuWidth: number;
  menuHeight: number;
  anchorX: number;
  anchorY: number;
}) {
  return {
    x: clamp(input.anchorX - input.menuWidth / 2, 16, input.stageRect.width - input.menuWidth - 16),
    y: clamp(input.anchorY - input.menuHeight, 16, input.stageRect.height - input.menuHeight - 16),
  };
}

export function buildHierarchyTree(input: {
  objects: EditorCanvasObject[];
  selection: EditorSelectionState;
  collapsedNodeIds: string[];
}): EditorHierarchyNode[] {
  const objectMap = createObjectMap(input.objects);
  const selected = new Set(input.selection.ids);
  const collapsed = new Set(input.collapsedNodeIds);

  const buildNode = (object: EditorCanvasObject, depth: number): EditorHierarchyNode => {
    const children = getChildObjects(input.objects, object.id).map((child) => buildNode(child, depth + 1));
    const selectedDescendantCount = children.reduce(
      (count, child) => count + child.selectedDescendantCount + (child.selected ? 1 : 0),
      0,
    );

    return {
      object,
      children,
      depth,
      selected: selected.has(object.id),
      selectedDescendantCount,
      isCollapsed: collapsed.has(object.id),
    };
  };

  return getChildObjects(input.objects, null)
    .filter((object) => !getAncestorIds(object.id, objectMap).length)
    .map((object) => buildNode(object, 0));
}

export function nextZIndex(objects: EditorCanvasObject[]) {
  return objects.reduce((max, object) => Math.max(max, object.zIndex), 0) + 1;
}
