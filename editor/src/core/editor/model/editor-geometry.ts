import { estimateCanvasObjectHeight } from './editor-content-blocks';
import type {
  EditorBounds,
  EditorCanvasObject,
  EditorHierarchyNode,
  EditorMarqueeState,
  EditorSelectionState,
  EditorTransformFrame,
  EditorViewportState,
} from './editor-types';

const GROUP_PADDING = 24;
const GROUP_LABEL_OFFSET = 12;

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function normalizeRotationDegrees(rotation: number) {
  const normalized = rotation % 360;
  return normalized < 0 ? normalized + 360 : normalized;
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

export function getSelectionRootIds(selectionIds: string[], objects: EditorCanvasObject[]) {
  const objectMap = createObjectMap(objects);
  return selectionIds.filter((id) => !hasSelectedAncestor(id, selectionIds, objectMap));
}

export function getFrameCenter(frame: EditorTransformFrame) {
  return {
    x: frame.x + frame.width / 2,
    y: frame.y + frame.height / 2,
  };
}

export function rotatePoint(point: { x: number; y: number }, center: { x: number; y: number }, rotation: number) {
  const radians = rotation * (Math.PI / 180);
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const offsetX = point.x - center.x;
  const offsetY = point.y - center.y;

  return {
    x: center.x + offsetX * cos - offsetY * sin,
    y: center.y + offsetX * sin + offsetY * cos,
  };
}

export function getFrameCornerPoints(frame: EditorTransformFrame) {
  const center = getFrameCenter(frame);
  const corners = [
    { x: frame.x, y: frame.y },
    { x: frame.x + frame.width, y: frame.y },
    { x: frame.x + frame.width, y: frame.y + frame.height },
    { x: frame.x, y: frame.y + frame.height },
  ];

  if (frame.rotation === 0) {
    return corners;
  }

  return corners.map((corner) => rotatePoint(corner, center, frame.rotation));
}

function getBoundsFromPoints(points: Array<{ x: number; y: number }>): EditorBounds {
  const x = Math.min(...points.map((point) => point.x));
  const y = Math.min(...points.map((point) => point.y));
  const maxX = Math.max(...points.map((point) => point.x));
  const maxY = Math.max(...points.map((point) => point.y));

  return {
    x,
    y,
    width: maxX - x,
    height: maxY - y,
  };
}

function getProjectionBounds(points: Array<{ x: number; y: number }>, rotation: number) {
  const radians = rotation * (Math.PI / 180);
  const axisX = { x: Math.cos(radians), y: Math.sin(radians) };
  const axisY = { x: -Math.sin(radians), y: Math.cos(radians) };

  const projectedX = points.map((point) => point.x * axisX.x + point.y * axisX.y);
  const projectedY = points.map((point) => point.x * axisY.x + point.y * axisY.y);

  return {
    minX: Math.min(...projectedX),
    maxX: Math.max(...projectedX),
    minY: Math.min(...projectedY),
    maxY: Math.max(...projectedY),
    axisX,
    axisY,
  };
}

export function getObjectTransformFrame(
  object: EditorCanvasObject,
  _objects: EditorCanvasObject[],
): EditorTransformFrame {
  return {
    x: object.x,
    y: object.y,
    width: object.width,
    height: object.kind === 'group' ? object.height : estimateCanvasObjectHeight(object),
    rotation: normalizeRotationDegrees(object.rotation),
  };
}

function getObjectHullPoints(object: EditorCanvasObject, objects: EditorCanvasObject[]) {
  return getFrameCornerPoints(getObjectTransformFrame(object, objects));
}

export function getEffectiveBounds(
  object: EditorCanvasObject,
  objects: EditorCanvasObject[],
): EditorBounds {
  return getBoundsFromPoints(getObjectHullPoints(object, objects));
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

export function getSelectionTransformFrame(
  selection: EditorSelectionState,
  objects: EditorCanvasObject[],
): EditorTransformFrame | null {
  if (selection.ids.length === 0) {
    return null;
  }

  if (selection.ids.length === 1 && selection.primaryId) {
    const primaryObject = objects.find((object) => object.id === selection.primaryId);
    if (primaryObject) {
      return getObjectTransformFrame(primaryObject, objects);
    }
  }

  const selectionBounds = getSelectionBounds(selection, objects);
  if (!selectionBounds) {
    return null;
  }

  return {
    ...selectionBounds,
    rotation: 0,
  };
}

export function syncGroupFrames(objects: EditorCanvasObject[]) {
  const objectMap = createObjectMap(objects);
  const groups = objects
    .filter((object) => object.kind === 'group')
    .sort((left, right) => getAncestorIds(right.id, objectMap).length - getAncestorIds(left.id, objectMap).length);

  if (groups.length === 0) {
    return objects;
  }

  const nextObjects = objects.map((object) => ({ ...object }));
  const nextMap = createObjectMap(nextObjects);

  groups.forEach((group) => {
    const liveGroup = nextMap.get(group.id);
    if (!liveGroup) {
      return;
    }

    const children = getChildObjects(nextObjects, group.id);
    if (children.length === 0) {
      return;
    }

    const childPoints = children.flatMap((child) => getObjectHullPoints(child, nextObjects));
    const projection = getProjectionBounds(childPoints, liveGroup.rotation);
    const minX = projection.minX - GROUP_PADDING;
    const maxX = projection.maxX + GROUP_PADDING;
    const minY = projection.minY - GROUP_PADDING - GROUP_LABEL_OFFSET;
    const maxY = projection.maxY + GROUP_PADDING;

    liveGroup.x = minX * projection.axisX.x + minY * projection.axisY.x;
    liveGroup.y = minX * projection.axisX.y + minY * projection.axisY.y;
    liveGroup.width = maxX - minX;
    liveGroup.height = maxY - minY;
  });

  return nextObjects;
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

export function screenFrameFromWorld(frame: EditorTransformFrame, viewport: EditorViewportState): EditorTransformFrame {
  return {
    x: viewport.x + frame.x * viewport.zoom,
    y: viewport.y + frame.y * viewport.zoom,
    width: frame.width * viewport.zoom,
    height: frame.height * viewport.zoom,
    rotation: frame.rotation,
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
