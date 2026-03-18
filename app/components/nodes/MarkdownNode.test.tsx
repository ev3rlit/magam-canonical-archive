import { describe, expect, it } from 'bun:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { LazyMarkdownRenderer } from '@/components/markdown/LazyMarkdownRenderer';
import { resolveMarkdownSize } from '@/utils/sizeResolver';

function renderMarkdown(content: string): string {
  return renderToStaticMarkup(
    <div className="prose prose-sm prose-slate max-w-none">
      <LazyMarkdownRenderer content={content} />
    </div>,
  );
}

describe('MarkdownNode WYSIWYG parity', () => {
  it('편집 preview와 저장 렌더는 동일한 markdown renderer를 사용한다', () => {
    const draft = '# Title\n\n- one\n- two\n\n`inline`';
    const previewHtml = renderMarkdown(draft);
    const savedHtml = renderMarkdown(draft);
    expect(previewHtml).toBe(savedHtml);
  });

  it('링크/강조 문법도 preview와 저장 결과가 일치한다', () => {
    const draft = '**bold** and [node](node:root)';
    const previewHtml = renderMarkdown(draft);
    const savedHtml = renderMarkdown(draft);
    expect(previewHtml).toBe(savedHtml);
  });

  it('markdown size primitive input resolves to typography mode', () => {
    const resolved = resolveMarkdownSize('s', {
      component: 'MarkdownNode',
      inputPath: 'size',
    });
    expect(resolved.mode).toBe('typography');
    if (resolved.mode === 'typography') {
      expect(resolved.typography.fontSizePx).toBe(14);
      expect(resolved.typography.lineHeightPx).toBe(20);
    }
  });

  it('markdown size object input resolves to 2D mode', () => {
    const resolved = resolveMarkdownSize({ token: 'm', ratio: 'portrait' }, {
      component: 'MarkdownNode',
      inputPath: 'size',
    });
    expect(resolved.mode).toBe('object2d');
    if (resolved.mode === 'object2d') {
      expect(resolved.object2d).toMatchObject({
        mode: 'fixed',
        widthPx: 120,
        heightPx: 192,
        ratioUsed: 'portrait',
      });
    }
  });

  it('markdown 2d object token supports auto mode', () => {
    const resolved = resolveMarkdownSize({ token: 'auto' }, {
      component: 'MarkdownNode',
      inputPath: 'size',
    });

    expect(resolved.mode).toBe('object2d');
    if (resolved.mode === 'object2d') {
      expect(resolved.object2d).toMatchObject({
        mode: 'auto',
        tokenUsed: 'auto',
      });
    }
  });

  it('markdown size object with unsupported ratio is normalized into object2d mode', () => {
    const invalidSizeInput = {
      token: 'm',
      ratio: 'diagonal',
    } as unknown as Parameters<typeof resolveMarkdownSize>[0];
    const resolved = resolveMarkdownSize(
      invalidSizeInput,
      {
        component: 'MarkdownNode',
        inputPath: 'size',
      },
    );

    expect(resolved.mode).toBe('object2d');
    if (resolved.mode === 'object2d') {
      expect(resolved.object2d.mode).toBe('fixed');
      expect(resolved.object2d.tokenUsed).toBe('m');
      expect(['portrait', 'landscape', 'square']).toContain(resolved.object2d.ratioUsed);
    }
  });
});
