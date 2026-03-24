import React from 'react';
import { getLucideIconByName } from '@/utils/lucideRegistry';
import type { RenderableChild } from '@/utils/childComposition';
import { LazyMarkdownRenderer } from '@/components/markdown/LazyMarkdownRenderer';
import { resolveBodySlashCommand } from '@/features/editing/bodySlashCommands';
import type { TextEditMode } from '@/store/graph';

interface RenderNodeContentOptions {
  children?: RenderableChild[];
  fallbackLabel?: string;
  iconClassName: string;
  textClassName: string;
  textStyle?: React.CSSProperties;
}

type BodyEditNodeLike = {
  id: string;
  type?: string | null;
  data?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function resolveMarkdownChildContent(data: Record<string, unknown>): string | null {
  const children = data.children;
  if (!Array.isArray(children)) {
    return null;
  }

  for (const child of children) {
    if (!isRecord(child) || child.type !== 'graph-markdown') {
      continue;
    }

    if (typeof child.content === 'string') {
      return child.content;
    }
  }

  return null;
}

export function useExplicitBodyEntryAffordance(): boolean {
  const [explicitEntryEnabled, setExplicitEntryEnabled] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    const narrowViewportQuery = window.matchMedia('(max-width: 767px)');
    const coarsePointerQuery = window.matchMedia('(pointer: coarse)');
    const update = () => {
      setExplicitEntryEnabled(narrowViewportQuery.matches || coarsePointerQuery.matches);
    };
    const addListener = (query: MediaQueryList) => {
      if (typeof query.addEventListener === 'function') {
        query.addEventListener('change', update);
        return () => query.removeEventListener('change', update);
      }
      query.addListener(update);
      return () => query.removeListener(update);
    };

    update();
    const removeNarrowListener = addListener(narrowViewportQuery);
    const removePointerListener = addListener(coarsePointerQuery);

    return () => {
      removeNarrowListener();
      removePointerListener();
    };
  }, []);

  return explicitEntryEnabled;
}

export function resolveBodyEditSession(
  node: BodyEditNodeLike | null | undefined,
): { nodeId: string; initialDraft: string; mode: TextEditMode } | null {
  if (!node || (node.type !== 'text' && node.type !== 'markdown' && node.type !== 'sticky' && node.type !== 'shape')) {
    return null;
  }

  const data = isRecord(node.data) ? node.data : {};
  return {
    nodeId: node.id,
    initialDraft: resolveMarkdownChildContent(data) ?? (typeof data.label === 'string' ? data.label : ''),
    mode: 'markdown-wysiwyg',
  };
}

export function resolveBodySlashCommandSession(rawDraft: string): {
  command: '/' | '/markdown' | '/image';
} | null {
  const command = resolveBodySlashCommand(rawDraft);
  if (!command) {
    return null;
  }

  return {
    command: command.command,
  };
}

export function renderNodeContent({
  children,
  fallbackLabel,
  iconClassName,
  textClassName,
  textStyle,
}: RenderNodeContentOptions): React.ReactNode {
  const hasChildren = Array.isArray(children) && children.length > 0;

  if (!hasChildren) {
    return (
      <span className={textClassName} style={textStyle}>
        {fallbackLabel}
      </span>
    );
  }

  return children.map((child, index) => {
    switch (child.type) {
      case 'lucide-icon': {
        const Icon = getLucideIconByName(child.name);
        if (!Icon) return null;

        return <Icon key={`icon-${child.name}-${index}`} className={iconClassName} />;
      }
      case 'graph-image': {
        return null;
      }
      case 'graph-markdown': {
        return (
          <div
            key={`markdown-${index}`}
            className="prose prose-slate prose-sm max-w-none"
            style={{ lineHeight: 1.2, ...textStyle }}
          >
            <LazyMarkdownRenderer content={child.content} />
          </div>
        );
      }
      case 'svg-inline': {
        return null;
      }
      default:
        return (
          <span key={`text-${index}`} className={textClassName} style={textStyle}>
            {child.text}
          </span>
        );
    }
  });
}
