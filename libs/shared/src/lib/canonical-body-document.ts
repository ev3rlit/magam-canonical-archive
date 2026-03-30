import type {
  ContentBlock,
  ContentCapability,
} from './canonical-object-contract';

export const CANONICAL_BODY_SCHEMA_VERSION = 1 as const;

export type CanonicalBodyMarkType =
  | 'bold'
  | 'italic'
  | 'strike'
  | 'code'
  | 'link';

export interface CanonicalBodyMark {
  type: CanonicalBodyMarkType;
  attrs?: Record<string, unknown>;
}

export type CanonicalBodyNodeType =
  | 'doc'
  | 'paragraph'
  | 'text'
  | 'heading'
  | 'bulletList'
  | 'orderedList'
  | 'listItem'
  | 'taskList'
  | 'taskItem'
  | 'blockquote'
  | 'codeBlock'
  | 'horizontalRule'
  | 'image';

export interface CanonicalBodyNode {
  type: CanonicalBodyNodeType;
  attrs?: Record<string, unknown>;
  content?: CanonicalBodyNode[];
  text?: string;
  marks?: CanonicalBodyMark[];
}

export interface CanonicalBodyDocument {
  type: 'doc';
  content: CanonicalBodyNode[];
}

export interface CanonicalBodyCarrier {
  body?: CanonicalBodyDocument;
  body_json?: CanonicalBodyDocument;
  bodySchemaVersion?: number;
  body_schema_version?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function trimTrailingEmptyParagraph(nodes: CanonicalBodyNode[]): CanonicalBodyNode[] {
  if (nodes.length <= 1) {
    return nodes;
  }

  const last = nodes[nodes.length - 1];
  if (
    last?.type === 'paragraph'
    && (!Array.isArray(last.content) || last.content.length === 0)
  ) {
    return nodes.slice(0, -1);
  }

  return nodes;
}

export function createBodyTextNode(text: string, marks?: CanonicalBodyMark[]): CanonicalBodyNode {
  return {
    type: 'text',
    text,
    ...(marks && marks.length > 0 ? { marks } : {}),
  };
}

export function createBodyParagraphNode(text = ''): CanonicalBodyNode {
  return {
    type: 'paragraph',
    ...(text.length > 0 ? { content: [createBodyTextNode(text)] } : {}),
  };
}

export function createBodyImageNode(input?: {
  src?: string;
  alt?: string;
  title?: string;
}): CanonicalBodyNode {
  return {
    type: 'image',
    attrs: {
      src: input?.src ?? '',
      ...(input?.alt ? { alt: input.alt } : {}),
      ...(input?.title ? { title: input.title } : {}),
    },
  };
}

export function createCanonicalBodyDocument(
  content?: CanonicalBodyNode[],
): CanonicalBodyDocument {
  return {
    type: 'doc',
    content: content && content.length > 0 ? content : [createBodyParagraphNode()],
  };
}

export function isCanonicalBodyDocument(value: unknown): value is CanonicalBodyDocument {
  return isRecord(value)
    && value['type'] === 'doc'
    && Array.isArray(value['content']);
}

export function readCanonicalBody(
  carrier: CanonicalBodyCarrier,
): CanonicalBodyDocument | undefined {
  if (isCanonicalBodyDocument(carrier.body)) {
    return carrier.body;
  }

  if (isCanonicalBodyDocument(carrier.body_json)) {
    return carrier.body_json;
  }

  return undefined;
}

export function readCanonicalBodySchemaVersion(
  carrier: CanonicalBodyCarrier,
): number | undefined {
  if (typeof carrier.bodySchemaVersion === 'number' && Number.isFinite(carrier.bodySchemaVersion)) {
    return carrier.bodySchemaVersion;
  }
  if (typeof carrier.body_schema_version === 'number' && Number.isFinite(carrier.body_schema_version)) {
    return carrier.body_schema_version;
  }
  return undefined;
}

export function cloneCanonicalBodyNode(node: CanonicalBodyNode): CanonicalBodyNode {
  return {
    type: node.type,
    ...(node.attrs ? { attrs: { ...node.attrs } } : {}),
    ...(node.text !== undefined ? { text: node.text } : {}),
    ...(node.marks ? {
      marks: node.marks.map((mark) => ({
        type: mark.type,
        ...(mark.attrs ? { attrs: { ...mark.attrs } } : {}),
      })),
    } : {}),
    ...(node.content ? { content: node.content.map(cloneCanonicalBodyNode) } : {}),
  };
}

export function cloneCanonicalBodyDocument(
  body: CanonicalBodyDocument | undefined,
): CanonicalBodyDocument | undefined {
  if (!body) {
    return undefined;
  }

  return {
    type: 'doc',
    content: body.content.map(cloneCanonicalBodyNode),
  };
}

function appendTextNode(target: CanonicalBodyNode[], text: string): void {
  if (text.length === 0) {
    return;
  }
  target.push(createBodyTextNode(text));
}

function parseInlineText(line: string): CanonicalBodyNode[] {
  return line.length > 0 ? [createBodyTextNode(line)] : [];
}

function createListItemNode(text: string, checked?: boolean): CanonicalBodyNode {
  return {
    type: 'listItem',
    ...(checked === undefined ? {} : { attrs: { checked } }),
    content: [createBodyParagraphNode(text)],
  };
}

export function markdownToCanonicalBody(markdown: string): CanonicalBodyDocument {
  const normalized = markdown.replace(/\r\n/g, '\n').trimEnd();
  if (normalized.trim().length === 0) {
    return createCanonicalBodyDocument();
  }

  const lines = normalized.split('\n');
  const nodes: CanonicalBodyNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index] ?? '';
    const trimmed = line.trim();

    if (trimmed.length === 0) {
      index += 1;
      continue;
    }

    if (/^```/.test(trimmed)) {
      const fence = trimmed.slice(3).trim();
      const codeLines: string[] = [];
      index += 1;
      while (index < lines.length && !/^```/.test(lines[index]!.trim())) {
        codeLines.push(lines[index]!);
        index += 1;
      }
      if (index < lines.length) {
        index += 1;
      }
      nodes.push({
        type: 'codeBlock',
        ...(fence.length > 0 ? { attrs: { language: fence } } : {}),
        content: [createBodyTextNode(codeLines.join('\n'))],
      });
      continue;
    }

    if (/^---+$/.test(trimmed) || /^\*\*\*+$/.test(trimmed)) {
      nodes.push({ type: 'horizontalRule' });
      index += 1;
      continue;
    }

    const heading = /^(#{1,3})\s+(.*)$/.exec(trimmed);
    if (heading) {
      nodes.push({
        type: 'heading',
        attrs: { level: heading[1]!.length },
        content: parseInlineText(heading[2] ?? ''),
      });
      index += 1;
      continue;
    }

    if (/^>\s?/.test(trimmed)) {
      const quoteLines: string[] = [];
      while (index < lines.length && /^>\s?/.test(lines[index]!.trim())) {
        quoteLines.push(lines[index]!.trim().replace(/^>\s?/, ''));
        index += 1;
      }
      nodes.push({
        type: 'blockquote',
        content: [createBodyParagraphNode(quoteLines.join('\n'))],
      });
      continue;
    }

    if (/^[-*]\s+\[.\]\s+/.test(trimmed)) {
      const items: CanonicalBodyNode[] = [];
      while (index < lines.length && /^[-*]\s+\[.\]\s+/.test(lines[index]!.trim())) {
        const match = /^[-*]\s+\[(.| )\]\s+(.*)$/.exec(lines[index]!.trim());
        items.push(createListItemNode(match?.[2] ?? '', (match?.[1] ?? ' ').toLowerCase() === 'x'));
        index += 1;
      }
      nodes.push({ type: 'taskList', content: items });
      continue;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      const items: CanonicalBodyNode[] = [];
      while (index < lines.length && /^[-*]\s+/.test(lines[index]!.trim())) {
        items.push(createListItemNode(lines[index]!.trim().replace(/^[-*]\s+/, '')));
        index += 1;
      }
      nodes.push({ type: 'bulletList', content: items });
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      const items: CanonicalBodyNode[] = [];
      while (index < lines.length && /^\d+\.\s+/.test(lines[index]!.trim())) {
        items.push(createListItemNode(lines[index]!.trim().replace(/^\d+\.\s+/, '')));
        index += 1;
      }
      nodes.push({ type: 'orderedList', content: items });
      continue;
    }

    const paragraphLines: string[] = [trimmed];
    index += 1;
    while (index < lines.length) {
      const next = lines[index]!.trim();
      if (
        next.length === 0
        || /^```/.test(next)
        || /^#{1,3}\s+/.test(next)
        || /^>\s?/.test(next)
        || /^[-*]\s+\[.\]\s+/.test(next)
        || /^[-*]\s+/.test(next)
        || /^\d+\.\s+/.test(next)
        || /^---+$/.test(next)
        || /^\*\*\*+$/.test(next)
      ) {
        break;
      }
      paragraphLines.push(next);
      index += 1;
    }
    nodes.push(createBodyParagraphNode(paragraphLines.join(' ')));
  }

  return createCanonicalBodyDocument(nodes);
}

export function getNodePlainText(node: CanonicalBodyNode): string {
  if (node.type === 'text') {
    return node.text ?? '';
  }

  if (node.type === 'image') {
    if (!isRecord(node.attrs)) {
      return '';
    }
    const alt = typeof node.attrs['alt'] === 'string' ? node.attrs['alt'] : '';
    if (alt.length > 0) {
      return alt;
    }
    return typeof node.attrs['title'] === 'string' ? node.attrs['title'] : '';
  }

  if (!Array.isArray(node.content)) {
    return '';
  }

  return node.content.map(getNodePlainText).join(node.type === 'paragraph' ? '' : ' ').trim();
}

export function deriveCanonicalTextFromBody(body: CanonicalBodyDocument): string {
  return trimTrailingEmptyParagraph(body.content)
    .map((node) => getNodePlainText(node).trim())
    .filter((value) => value.length > 0)
    .join('\n')
    .trim();
}

export function getBodyBlockIdAtIndex(index: number): string {
  return `body-${index + 1}`;
}

export function getTopLevelBodyNodes(body: CanonicalBodyDocument): CanonicalBodyNode[] {
  return Array.isArray(body.content) ? body.content : [];
}

export function replaceTopLevelBodyNode(
  body: CanonicalBodyDocument,
  index: number,
  node: CanonicalBodyNode,
): CanonicalBodyDocument {
  const content = body.content.map(cloneCanonicalBodyNode);
  content[index] = cloneCanonicalBodyNode(node);
  return createCanonicalBodyDocument(content);
}

export function insertTopLevelBodyNode(
  body: CanonicalBodyDocument,
  index: number,
  node: CanonicalBodyNode,
): CanonicalBodyDocument {
  const content = body.content.map(cloneCanonicalBodyNode);
  content.splice(index, 0, cloneCanonicalBodyNode(node));
  return createCanonicalBodyDocument(content);
}

export function removeTopLevelBodyNode(
  body: CanonicalBodyDocument,
  index: number,
): CanonicalBodyDocument {
  const content = body.content.map(cloneCanonicalBodyNode);
  content.splice(index, 1);
  return createCanonicalBodyDocument(content.length > 0 ? content : [createBodyParagraphNode()]);
}

export function reorderTopLevelBodyNode(
  body: CanonicalBodyDocument,
  fromIndex: number,
  toIndex: number,
): CanonicalBodyDocument {
  const content = body.content.map(cloneCanonicalBodyNode);
  const [node] = content.splice(fromIndex, 1);
  if (!node) {
    return createCanonicalBodyDocument(content);
  }
  content.splice(Math.max(0, Math.min(toIndex, content.length)), 0, node);
  return createCanonicalBodyDocument(content);
}

export function contentBlocksToCanonicalBody(contentBlocks: readonly ContentBlock[]): CanonicalBodyDocument {
  const nodes: CanonicalBodyNode[] = [];

  for (const block of contentBlocks) {
    if (block.blockType === 'text') {
      nodes.push(createBodyParagraphNode(block.text));
      continue;
    }

    if (block.blockType === 'markdown') {
      nodes.push(...markdownToCanonicalBody(block.source).content);
      continue;
    }

    if (block.blockType.includes('image')) {
      const payload = isRecord(block.payload) ? block.payload : {};
      const assetRef = isRecord(payload['assetRef']) ? payload['assetRef'] : null;
      nodes.push(createBodyImageNode({
        src: typeof payload['src'] === 'string'
          ? payload['src']
          : assetRef && assetRef['kind'] === 'external-url' && typeof assetRef['value'] === 'string'
            ? assetRef['value']
            : '',
        alt: typeof payload['alt'] === 'string' ? payload['alt'] : '',
      }));
      nodes.push(createBodyParagraphNode());
      continue;
    }

    if (typeof block.textualProjection === 'string' && block.textualProjection.length > 0) {
      nodes.push(createBodyParagraphNode(block.textualProjection));
    }
  }

  return createCanonicalBodyDocument(nodes.length > 0 ? trimTrailingEmptyParagraph(nodes) : undefined);
}

export function contentCapabilityToCanonicalBody(
  content: ContentCapability,
): CanonicalBodyDocument | null {
  switch (content.kind) {
    case 'text':
      return createCanonicalBodyDocument([createBodyParagraphNode(content.value)]);
    case 'markdown':
      return markdownToCanonicalBody(content.source);
    case 'media':
      return createCanonicalBodyDocument([
        createBodyImageNode({
          src: content.src,
          alt: content.alt,
        }),
        createBodyParagraphNode(),
      ]);
    default:
      return null;
  }
}
