import { describe, expect, it } from 'bun:test';
import {
  getLucideNameFromChild,
  isLucideChild,
  parseStickerChildren,
  parseRenderableChildren,
  type RenderChildNode,
} from './childComposition';

describe('childComposition', () => {
  it('identifies lucide svg child and normalizes icon name', () => {
    const lucideNode: RenderChildNode = {
      type: 'svg',
      props: {
        className: 'lucide lucide-alarm-clock h-4 w-4',
      },
      children: [],
    };

    expect(isLucideChild(lucideNode)).toBe(true);
    expect(getLucideNameFromChild(lucideNode)).toBe('alarmClock');
  });

  it('parses mixed text + lucide children in order', () => {
    const children: RenderChildNode[] = [
      { type: 'text', props: { text: 'Deploy' }, children: [] },
      {
        type: 'svg',
        props: { className: 'lucide lucide-rocket text-slate-500' },
        children: [],
      },
      { type: 'text', props: { text: ' now' }, children: [] },
    ];

    expect(parseRenderableChildren(children)).toEqual([
      { type: 'text', text: 'Deploy' },
      { type: 'lucide-icon', name: 'rocket' },
      { type: 'text', text: ' now' },
    ]);
  });

  it('uses fallback primitive children when renderer children are empty', () => {
    expect(parseRenderableChildren([], ['A', 1, { bad: true }])).toEqual([
      { type: 'text', text: 'A' },
      { type: 'text', text: '1' },
    ]);
  });

  it('parses sticker children including image and markdown', () => {
    expect(
      parseStickerChildren(
        [
          {
            type: 'graph-image',
            props: { src: '/assets/sticker.png', alt: 'Sticker', width: 120, height: 80 },
            children: [],
          },
          {
            type: 'graph-markdown',
            props: { content: 'Hello **world**' },
            children: [],
          },
          {
            type: 'svg',
            props: { className: 'lucide lucide-camera' },
            children: [],
          },
        ],
        undefined,
      ),
    ).toEqual([
      { type: 'graph-image', src: '/assets/sticker.png', alt: 'Sticker', width: 120, height: 80 },
      { type: 'graph-markdown', content: 'Hello **world**' },
      { type: 'lucide-icon', name: 'camera' },
    ]);
  });

  it('preserves graph-text fontSize metadata for sticker text children', () => {
    expect(
      parseStickerChildren(
        [
          {
            type: 'graph-text',
            props: { fontSize: 'xl' },
            children: [{ type: 'text', props: { text: 'Big sticker text' }, children: [] }],
          },
          {
            type: 'graph-text',
            props: { fontSize: 42 },
            children: [{ type: 'text', props: { text: 'Numeric size' }, children: [] }],
          },
        ],
        undefined,
      ),
    ).toEqual([
      { type: 'text', text: 'Big sticker text', fontSize: 'xl' },
      { type: 'text', text: 'Numeric size', fontSize: 42 },
    ]);
  });

  it('warns and ignores unsupported sticker child types', () => {
    const originalWarn = console.warn;
    let called = 0;

    console.warn = (() => {
      called += 1;
    }) as typeof console.warn;

    parseStickerChildren([{ type: 'unsupported', props: {}, children: [] }], undefined);

    expect(called).toBe(1);
    console.warn = originalWarn;
  });

  it('parses non-lucide svg as inline svg sticker child', () => {
    const svgNode: RenderChildNode = {
      type: 'svg',
      props: { viewBox: '0 0 24 24', width: 24, height: 24 },
      children: [
        {
          type: 'path',
          props: { d: 'M4 12h16', stroke: '#111827', strokeWidth: 2 },
          children: [],
        },
      ],
    };

    expect(parseStickerChildren([svgNode], undefined)).toEqual([
      { type: 'svg-inline', node: svgNode },
    ]);
  });
});
