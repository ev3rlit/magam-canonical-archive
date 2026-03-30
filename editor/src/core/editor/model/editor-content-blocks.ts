import type { EditorCanvasObject, EditorCanvasObjectKind } from './editor-types';
import {
  cloneBodyDocument,
  createSeedBody,
  getNodePlainText,
  type EditorBodyDocument,
  type EditorBodyNode,
} from './editor-body';

const BODY_HORIZONTAL_PADDING = 24;
const EMPTY_OBJECT_HEIGHT = 88;
const IMAGE_BLOCK_HEIGHT = 164;
const BLOCK_GAP = 12;

function estimateWrappedLines(source: string, width: number, averageCharactersPerLine: number) {
  const safeWidth = Math.max(width - BODY_HORIZONTAL_PADDING * 2, 160);
  const characterBudget = Math.max(12, Math.floor(safeWidth / averageCharactersPerLine));
  return source.split('\n').reduce((count, line) => {
    if (line.length === 0) {
      return count + 1;
    }
    return count + Math.max(1, Math.ceil(line.length / characterBudget));
  }, 0);
}

function estimateNodeHeight(node: EditorBodyNode, width: number): number {
  const text = getNodePlainText(node);

  switch (node.type) {
    case 'heading': {
      const level = typeof node.attrs?.['level'] === 'number' ? node.attrs['level'] : 1;
      const lines = estimateWrappedLines(text, width, 8.2);
      return level === 1 ? lines * 34 : level === 2 ? lines * 28 : lines * 24;
    }
    case 'bulletList':
    case 'orderedList':
    case 'taskList':
      return Math.max(28, node.content?.reduce((total, item) => total + estimateNodeHeight(item, width), 0) ?? 28);
    case 'listItem':
      return Math.max(24, (node.content ?? []).reduce((total, child) => total + estimateNodeHeight(child, width), 0));
    case 'blockquote':
      return Math.max(32, (node.content ?? []).reduce((total, child) => total + estimateNodeHeight(child, width), 0));
    case 'codeBlock':
      return Math.max(44, 20 + estimateWrappedLines(text, width, 8.6) * 20);
    case 'horizontalRule':
      return 20;
    case 'image':
      return IMAGE_BLOCK_HEIGHT;
    case 'paragraph':
    default:
      return 22 + estimateWrappedLines(text, width, 8.4) * 22;
  }
}

export function cloneBody(body: EditorBodyDocument): EditorBodyDocument {
  return cloneBodyDocument(body);
}

export function createSeedBodyDocument(input: {
  kind: Exclude<EditorCanvasObjectKind, 'group'>;
  placeholderImageSrc: string;
}): EditorBodyDocument {
  return createSeedBody(input);
}

export function getCanvasObjectMinimumHeight(object: EditorCanvasObject) {
  if (object.kind === 'group') {
    return object.height;
  }

  const nodes = object.body.content;
  if (nodes.length === 0) {
    return EMPTY_OBJECT_HEIGHT;
  }

  const bodyHeight = nodes.reduce((total, node, index) => (
    total + estimateNodeHeight(node, object.width) + (index > 0 ? BLOCK_GAP : 0)
  ), 0);

  const shellPadding = object.kind === 'text' ? 20 : object.kind === 'frame' ? 36 : 28;
  return bodyHeight + shellPadding * 2;
}

export function estimateCanvasObjectHeight(object: EditorCanvasObject) {
  return Math.max(object.height, getCanvasObjectMinimumHeight(object));
}

export function isBodyCapableObject(object: EditorCanvasObject) {
  return object.kind !== 'group';
}
