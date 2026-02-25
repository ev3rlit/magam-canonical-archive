export interface RenderChildNode {
  type: string;
  props?: {
    text?: string;
    content?: string;
    className?: string;
    children?: unknown;
    src?: string;
    alt?: string;
    width?: number;
    height?: number;
    [key: string]: unknown;
  };
  children?: RenderChildNode[];
}

export type RenderableChild =
  | { type: 'text'; text: string }
  | { type: 'lucide-icon'; name: string }
  | { type: 'graph-image'; src: string; alt?: string; width?: number; height?: number }
  | { type: 'graph-markdown'; content: string }
  | { type: 'svg-inline'; node: RenderChildNode };

const LUCIDE_BASE_CLASS = 'lucide';

function toCamelCase(value: string): string {
  return value.replace(/-([a-z])/g, (_, char: string) => char.toUpperCase());
}

function getClassTokens(className?: string): string[] {
  if (!className) return [];
  return className
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

export function getLucideNameFromChild(node: RenderChildNode): string | null {
  if (node.type !== 'svg') return null;

  const classTokens = getClassTokens(node.props?.className);
  if (!classTokens.includes(LUCIDE_BASE_CLASS)) return null;

  const iconToken = classTokens.find(
    (token) => token.startsWith('lucide-') && token !== LUCIDE_BASE_CLASS,
  );

  if (!iconToken) return null;
  return toCamelCase(iconToken.replace(/^lucide-/, ''));
}

export function isLucideChild(node: RenderChildNode): boolean {
  return getLucideNameFromChild(node) !== null;
}

function pushText(parsed: RenderableChild[], value: unknown): void {
  if (typeof value === 'string' || typeof value === 'number') {
    parsed.push({ type: 'text', text: String(value) });
  }
}

function pushFallbackText(parsed: RenderableChild[], fallbackChildren: unknown): void {
  const fallbackItems = Array.isArray(fallbackChildren)
    ? fallbackChildren
    : [fallbackChildren];

  fallbackItems.forEach((item) => pushText(parsed, item));
}

export function parseRenderableChildren(
  rendererChildren: RenderChildNode[],
  fallbackChildren?: unknown,
): RenderableChild[] {
  const parsed: RenderableChild[] = [];

  rendererChildren.forEach((child) => {
    const iconName = getLucideNameFromChild(child);
    if (iconName) {
      parsed.push({ type: 'lucide-icon', name: iconName });
      return;
    }

    if (child.type === 'text') {
      pushText(parsed, child.props?.text);
      return;
    }

    if (child.type === 'graph-text') {
      const textNode = child.children?.find((grandChild) => grandChild.type === 'text');
      if (textNode) {
        pushText(parsed, textNode.props?.text);
      } else {
        pushText(parsed, child.props?.children);
      }
      return;
    }

    if (child.type === 'graph-markdown') {
      pushText(parsed, child.props?.content);
    }
  });

  if (rendererChildren.length === 0 && fallbackChildren !== undefined) {
    pushFallbackText(parsed, fallbackChildren);
  }

  return parsed;
}

function logUnsupportedStickerChild(typeName: string): void {
  if (process.env.NODE_ENV !== 'production') {
    console.warn(`[Sticker parser] Unsupported child type '${typeName}' ignored.`);
  }
}

export function parseStickerChildren(
  rendererChildren: RenderChildNode[],
  fallbackChildren?: unknown,
): RenderableChild[] {
  const parsed: RenderableChild[] = [];

  rendererChildren.forEach((child) => {
    const iconName = getLucideNameFromChild(child);
    if (iconName) {
      parsed.push({ type: 'lucide-icon', name: iconName });
      return;
    }

    if (child.type === 'text') {
      pushText(parsed, child.props?.text);
      return;
    }

    if (child.type === 'graph-text') {
      const textNode = child.children?.find((grandChild) => grandChild.type === 'text');
      if (textNode) {
        pushText(parsed, textNode.props?.text);
      } else {
        pushText(parsed, child.props?.children);
      }
      return;
    }

    if (child.type === 'graph-image') {
      const src = child.props?.src;
      if (typeof src === 'string' && src.trim() !== '') {
        parsed.push({
          type: 'graph-image',
          src,
          alt: typeof child.props?.alt === 'string' ? child.props.alt : undefined,
          width:
            typeof child.props?.width === 'number'
              ? child.props.width
              : undefined,
          height:
            typeof child.props?.height === 'number'
              ? child.props.height
              : undefined,
        });
      }
      return;
    }

    if (child.type === 'graph-markdown') {
      if (typeof child.props?.content === 'string') {
        parsed.push({ type: 'graph-markdown', content: child.props.content });
      }
      return;
    }

    if (child.type === 'svg') {
      parsed.push({ type: 'svg-inline', node: child });
      return;
    }

    logUnsupportedStickerChild(child.type);
  });

  if (rendererChildren.length === 0 && fallbackChildren !== undefined) {
    pushFallbackText(parsed, fallbackChildren);
  }

  return parsed;
}
