import type {
  EditorBlockPaletteType,
  EditorCanvasObject,
  EditorCanvasObjectKind,
  EditorContentBlock,
} from './editor-types';

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

function estimateTextBlockHeight(block: Extract<EditorContentBlock, { blockType: 'text' }>, width: number) {
  const lines = estimateWrappedLines(block.text, width, 8.5);
  return 22 + lines * 22;
}

function estimateMarkdownBlockHeight(block: Extract<EditorContentBlock, { blockType: 'markdown' }>, width: number) {
  const lines = block.source.split('\n');
  return lines.reduce((total, line) => {
    if (line.trim().length === 0) {
      return total + 18;
    }
    if (/^#{1,3}\s/.test(line)) {
      return total + 34;
    }
    if (/^[-*]\s/.test(line) || /^\d+\.\s/.test(line)) {
      return total + 26;
    }
    const wrapped = estimateWrappedLines(line, width, 8.2);
    return total + wrapped * 22;
  }, 28);
}

function estimateBlockHeight(block: EditorContentBlock, width: number) {
  if (block.blockType === 'text') {
    return estimateTextBlockHeight(block, width);
  }
  if (block.blockType === 'markdown') {
    return estimateMarkdownBlockHeight(block, width);
  }
  return IMAGE_BLOCK_HEIGHT;
}

export function cloneContentBlocks(contentBlocks: EditorContentBlock[]) {
  return contentBlocks.map((block) => ({ ...block }));
}

export function createContentBlockFromPalette(input: {
  blockId: string;
  type: EditorBlockPaletteType;
  placeholderImageSrc: string;
}): EditorContentBlock {
  if (input.type === 'text') {
    return {
      id: input.blockId,
      blockType: 'text',
      text: '',
    };
  }

  if (input.type === 'image') {
    return {
      id: input.blockId,
      blockType: 'canvas.image',
      src: input.placeholderImageSrc,
      alt: 'Canvas mood reference',
    };
  }

  return {
    id: input.blockId,
    blockType: 'markdown',
    source: '',
  };
}

export function createSeedContentBlocks(input: {
  kind: Exclude<EditorCanvasObjectKind, 'group'>;
  placeholderImageSrc: string;
}): EditorContentBlock[] {
  if (input.kind !== 'image') {
    return [];
  }

  return [
    createContentBlockFromPalette({
      blockId: 'body-1',
      type: 'image',
      placeholderImageSrc: input.placeholderImageSrc,
    }),
  ];
}

export function updateContentBlock(
  block: EditorContentBlock,
  patch: Record<string, unknown>,
): EditorContentBlock {
  if (block.blockType === 'text') {
    return {
      ...block,
      ...(typeof patch['text'] === 'string' ? { text: patch['text'] } : {}),
    };
  }

  if (block.blockType === 'markdown') {
    return {
      ...block,
      ...(typeof patch['source'] === 'string' ? { source: patch['source'] } : {}),
    };
  }

  return {
    ...block,
    ...(typeof patch['src'] === 'string' ? { src: patch['src'] } : {}),
    ...(typeof patch['alt'] === 'string' ? { alt: patch['alt'] } : {}),
  };
}

export function getContentBlockText(block: EditorContentBlock) {
  if (block.blockType === 'text') {
    return block.text;
  }
  if (block.blockType === 'markdown') {
    return block.source;
  }
  return block.alt;
}

export function estimateCanvasObjectHeight(object: EditorCanvasObject) {
  if (object.kind === 'group') {
    return object.height;
  }

  if (object.contentBlocks.length === 0) {
    return Math.max(object.height, EMPTY_OBJECT_HEIGHT);
  }

  const bodyHeight = object.contentBlocks.reduce((total, block, index) => {
    return total + estimateBlockHeight(block, object.width) + (index > 0 ? BLOCK_GAP : 0);
  }, 0);

  const shellPadding = object.kind === 'text' ? 20 : object.kind === 'frame' ? 36 : 28;
  return Math.max(object.height, bodyHeight + shellPadding * 2);
}

export function isBodyCapableObject(object: EditorCanvasObject) {
  return object.kind !== 'group';
}

export function findContentBlockIndex(object: EditorCanvasObject, blockId: string) {
  return object.contentBlocks.findIndex((block) => block.id === blockId);
}
