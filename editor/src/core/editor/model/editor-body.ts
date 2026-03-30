'use client';

export type EditorBodyMarkType =
  | 'bold'
  | 'italic'
  | 'strike'
  | 'code'
  | 'link';

export interface EditorBodyMark {
  type: EditorBodyMarkType;
  attrs?: Record<string, unknown>;
}

export type EditorBodyNodeType =
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

export interface EditorBodyNode {
  type: EditorBodyNodeType;
  attrs?: Record<string, unknown>;
  content?: EditorBodyNode[];
  text?: string;
  marks?: EditorBodyMark[];
}

export interface EditorBodyDocument {
  type: 'doc';
  content: EditorBodyNode[];
}

export function createBodyTextNode(text: string): EditorBodyNode {
  return {
    type: 'text',
    text,
  };
}

export function createBodyParagraphNode(text = ''): EditorBodyNode {
  return {
    type: 'paragraph',
    ...(text.length > 0 ? { content: [createBodyTextNode(text)] } : {}),
  };
}

export function createBodyImageNode(input?: {
  src?: string;
  alt?: string;
  title?: string;
}): EditorBodyNode {
  return {
    type: 'image',
    attrs: {
      src: input?.src ?? '',
      ...(input?.alt ? { alt: input.alt } : {}),
      ...(input?.title ? { title: input.title } : {}),
    },
  };
}

export function createBodyDocument(content?: EditorBodyNode[]): EditorBodyDocument {
  return {
    type: 'doc',
    content: content && content.length > 0 ? content : [createBodyParagraphNode()],
  };
}

export function cloneBodyNode(node: EditorBodyNode): EditorBodyNode {
  return {
    type: node.type,
    ...(node.attrs ? { attrs: { ...node.attrs } } : {}),
    ...(node.text !== undefined ? { text: node.text } : {}),
    ...(node.marks ? { marks: node.marks.map((mark) => ({ ...mark, ...(mark.attrs ? { attrs: { ...mark.attrs } } : {}) })) } : {}),
    ...(node.content ? { content: node.content.map(cloneBodyNode) } : {}),
  };
}

export function cloneBodyDocument(body: EditorBodyDocument): EditorBodyDocument {
  return {
    type: 'doc',
    content: body.content.map(cloneBodyNode),
  };
}

export function getNodePlainText(node: EditorBodyNode): string {
  if (node.type === 'text') {
    return node.text ?? '';
  }

  if (node.type === 'image') {
    const attrs = node.attrs ?? {};
    return typeof attrs['alt'] === 'string'
      ? attrs['alt']
      : typeof attrs['title'] === 'string'
        ? attrs['title']
        : '';
  }

  if (!Array.isArray(node.content)) {
    return '';
  }

  return node.content.map(getNodePlainText).join(node.type === 'paragraph' ? '' : ' ').trim();
}

export function getBodyPlainText(body: EditorBodyDocument): string {
  return body.content
    .map((node) => getNodePlainText(node).trim())
    .filter((value) => value.length > 0)
    .join('\n')
    .trim();
}

export function createSeedBody(input: {
  kind: 'shape' | 'sticky' | 'text' | 'image' | 'frame';
  placeholderImageSrc: string;
}): EditorBodyDocument {
  if (input.kind === 'image') {
    return createBodyDocument([
      createBodyImageNode({
        src: input.placeholderImageSrc,
        alt: 'Canvas mood reference',
      }),
      createBodyParagraphNode(),
    ]);
  }

  return createBodyDocument();
}
