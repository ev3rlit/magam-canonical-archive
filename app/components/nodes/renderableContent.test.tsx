import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { renderNodeContent, resolveBodyEditSession } from './renderableContent';
import type { RenderableChild } from '@/utils/childComposition';

describe('renderNodeContent', () => {
  it('renders lucide + text children in order', () => {
    const html = renderToStaticMarkup(
      <>
        {renderNodeContent({
          children: [
            { type: 'lucide-icon', name: 'rocket' },
            { type: 'text', text: 'Deploy' },
          ],
          fallbackLabel: 'Ignored',
          iconClassName: 'icon-class',
          textClassName: 'text-class',
        })}
      </>,
    );

    expect(html).toContain('icon-class');
    expect(html).toContain('Deploy');
    expect(html.indexOf('icon-class')).toBeLessThan(html.indexOf('Deploy'));
  });

  it('falls back to label when children are missing', () => {
    const html = renderToStaticMarkup(
      <>
        {renderNodeContent({
          children: [],
          fallbackLabel: 'Sticky note',
          iconClassName: 'icon-class',
          textClassName: 'text-class',
        })}
      </>,
    );

    expect(html).toContain('Sticky note');
  });

  it('skips unknown lucide icon names and still renders text children', () => {
    const html = renderToStaticMarkup(
      <>
        {renderNodeContent({
          children: [
            { type: 'lucide-icon', name: 'not-registered-icon' },
            { type: 'text', text: 'Fallback text' },
          ],
          fallbackLabel: 'Ignored',
          iconClassName: 'icon-class',
          textClassName: 'text-class',
        })}
      </>,
    );

    expect(html).not.toContain('icon-class');
    expect(html).toContain('Fallback text');
  });

  it('keeps sticker text rendering content-driven even with irrelevant size metadata', () => {
    const children: Array<Extract<RenderableChild, { type: 'text' }> & { size: string }> = [
      { type: 'text', text: 'Sticker body', size: 'xl' },
    ];
    const html = renderToStaticMarkup(
      <>
        {renderNodeContent({
          children,
          fallbackLabel: 'Ignored',
          iconClassName: 'icon-class',
          textClassName: 'text-class',
        })}
      </>,
    );

    expect(html).toContain('Sticker body');
  });

  it('renders markdown child nodes before plain text sibling content', () => {
    const html = renderToStaticMarkup(
      <>
        {renderNodeContent({
          children: [
            { type: 'graph-markdown', content: '# Heading' },
            { type: 'text', text: 'Trailing body' },
          ],
          fallbackLabel: 'Ignored',
          iconClassName: 'icon-class',
          textClassName: 'text-class',
        })}
      </>,
    );

    expect(html).toContain('perf-lazy-markdown');
    expect(html).toContain('Trailing body');
    expect(html.indexOf('perf-lazy-markdown')).toBeLessThan(html.indexOf('Trailing body'));
  });

  it('omits media-only children and does not fallback when a renderer child type is unsupported', () => {
    const html = renderToStaticMarkup(
      <>
        {renderNodeContent({
          children: [
            { type: 'graph-image', src: 'https://example.com/media.png', alt: 'media' },
          ],
          fallbackLabel: 'Fallback text',
          iconClassName: 'icon-class',
          textClassName: 'text-class',
        })}
      </>,
    );

    expect(html).toBe('');
    expect(html).not.toContain('Fallback text');
  });

  it('resolves markdown-first body sessions for phase-1 content nodes only', () => {
    expect(resolveBodyEditSession({
      id: 'text-1',
      type: 'text',
      data: { label: '# Title' },
    })).toEqual({
      nodeId: 'text-1',
      initialDraft: '# Title',
      mode: 'markdown-wysiwyg',
    });

    expect(resolveBodyEditSession({
      id: 'shape-1',
      type: 'shape',
      data: { label: 'Shape label' },
    })).toBeNull();
  });
});
