'use client';

import React, { useEffect, useState } from 'react';
import remarkGfm from 'remark-gfm';

type MarkdownComponentType = typeof import('react-markdown').default;

let markdownModulePromise: Promise<MarkdownComponentType> | null = null;

async function loadMarkdownComponent(): Promise<MarkdownComponentType> {
  if (!markdownModulePromise) {
    markdownModulePromise = import('react-markdown').then((module) => module.default);
  }

  return markdownModulePromise;
}

export interface LazyMarkdownRendererProps {
  content: string;
  className?: string;
  style?: React.CSSProperties;
  components?: Record<string, any>;
  urlTransform?: (url: string) => string;
}

export function LazyMarkdownRenderer({
  content,
  className,
  style,
  components,
  urlTransform,
}: LazyMarkdownRendererProps) {
  const [MarkdownComponent, setMarkdownComponent] = useState<MarkdownComponentType | null>(null);

  useEffect(() => {
    let mounted = true;

    void loadMarkdownComponent()
      .then((component) => {
        if (mounted) {
          setMarkdownComponent(() => component);
        }
      })
      .catch((error) => {
        console.error('[LazyMarkdownRenderer] Failed to load react-markdown:', error);
      });

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className={className} style={style}>
      {MarkdownComponent ? (
        <MarkdownComponent
          remarkPlugins={[remarkGfm]}
          components={components}
          urlTransform={urlTransform}
        >
          {content}
        </MarkdownComponent>
      ) : (
        <div className="perf-lazy-markdown" aria-hidden>
          <div className="perf-lazy-skeleton" />
          <div className="perf-lazy-skeleton perf-lazy-skeleton-short" />
        </div>
      )}
    </div>
  );
}
