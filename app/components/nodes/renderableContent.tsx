import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getLucideIconByName } from '@/utils/lucideRegistry';
import type { RenderableChild } from '@/utils/childComposition';

interface RenderNodeContentOptions {
  children?: RenderableChild[];
  fallbackLabel?: string;
  iconClassName: string;
  textClassName: string;
  textStyle?: React.CSSProperties;
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
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {child.content}
            </ReactMarkdown>
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
