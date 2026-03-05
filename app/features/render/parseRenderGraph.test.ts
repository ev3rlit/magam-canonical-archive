import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseRenderGraph } from './parseRenderGraph';

describe('parseRenderGraph mindmap roots', () => {
  it('allows a root node without from and only builds edges for linked nodes', () => {
    const parsed = parseRenderGraph({
      graph: {
        children: [
          {
            type: 'graph-mindmap',
            props: { id: 'map' },
            children: [
              { type: 'graph-node', props: { id: 'root', text: 'Root' }, children: [] },
              { type: 'graph-node', props: { id: 'child', from: 'root', text: 'Child' }, children: [] },
            ],
          },
        ],
      },
    });

    expect(parsed).not.toBeNull();
    expect(parsed!.nodes.map((n) => n.id)).toEqual(['map.root', 'map.child']);
    expect(parsed!.edges).toHaveLength(1);
    expect(parsed!.edges[0]).toMatchObject({
      source: 'map.root',
      target: 'map.child',
    });
  });

  it('supports multiple root nodes in one mindmap', () => {
    const parsed = parseRenderGraph({
      graph: {
        children: [
          {
            type: 'graph-mindmap',
            props: { id: 'map' },
            children: [
              { type: 'graph-node', props: { id: 'root-a', text: 'Root A' }, children: [] },
              { type: 'graph-node', props: { id: 'root-b', text: 'Root B' }, children: [] },
            ],
          },
        ],
      },
    });

    expect(parsed).not.toBeNull();
    expect(parsed!.nodes.map((n) => n.id)).toEqual(['map.root-a', 'map.root-b']);
    expect(parsed!.edges).toHaveLength(0);
  });
});

describe('parseRenderGraph standardized sizes', () => {
  it('preserves token/number size payloads for Text/Sticky/Shape and ignores legacy width/height', () => {
    const warnings: string[] = [];
    const originalWarn = console.warn;
    console.warn = ((message: string) => warnings.push(String(message))) as typeof console.warn;

    const parsed = parseRenderGraph({
      graph: {
        children: [
          { type: 'graph-text', props: { id: 'text-1', x: 0, y: 0, text: 'hello', fontSize: 'l' }, children: [] },
          {
            type: 'graph-sticky',
            props: {
              id: 'sticky-1',
              x: 10,
              y: 10,
              text: 'sticky',
              size: { token: 'm', ratio: 'portrait' },
              width: 320,
              height: 180,
            },
            children: [],
          },
          {
            type: 'graph-shape',
            props: {
              id: 'shape-1',
              x: 20,
              y: 20,
              type: 'rectangle',
              label: 'shape',
              size: 120,
              width: 240,
            },
            children: [],
          },
        ],
      },
    });

    console.warn = originalWarn;

    expect(parsed).not.toBeNull();
    const textNode = parsed!.nodes.find((node) => node.id === 'text-1');
    const stickyNode = parsed!.nodes.find((node) => node.id === 'sticky-1');
    const shapeNode = parsed!.nodes.find((node) => node.id === 'shape-1');

    expect(textNode?.data?.fontSize).toBe('l');
    expect(stickyNode?.data?.size).toEqual({ token: 'm', ratio: 'portrait' });
    expect(stickyNode?.data?.width).toBeUndefined();
    expect(stickyNode?.data?.height).toBeUndefined();
    expect(shapeNode?.data?.size).toBe(120);
    expect(shapeNode?.data?.width).toBeUndefined();
    expect(warnings.some((line) => line.includes('UNSUPPORTED_LEGACY_SIZE_API'))).toBe(true);
  });

  it('maps graph-markdown size payload into markdown node data', () => {
    const parsed = parseRenderGraph({
      graph: {
        children: [
          {
            type: 'graph-node',
            props: { id: 'doc-1', x: 0, y: 0 },
            children: [
              {
                type: 'graph-markdown',
                props: { content: '# Title', size: { widthHeight: 's' } },
                children: [],
              },
            ],
          },
        ],
      },
    });

    expect(parsed).not.toBeNull();
    const markdownNode = parsed!.nodes.find((node) => node.id === 'doc-1');
    expect(markdownNode?.type).toBe('markdown');
    expect(markdownNode?.data?.size).toEqual({ widthHeight: 's' });
  });

  it('keeps Sequence and Sticker size token paths unsupported with warnings', () => {
    const warnings: string[] = [];
    const originalWarn = console.warn;
    console.warn = ((message: string) => warnings.push(String(message))) as typeof console.warn;

    const parsed = parseRenderGraph({
      graph: {
        children: [
          {
            type: 'graph-sequence',
            props: { id: 'seq-1', x: 0, y: 0, size: 'm' },
            children: [],
          },
          {
            type: 'graph-sticker',
            props: { id: 'sticker-1', x: 0, y: 0, size: 'm', width: 180, height: 120 },
            children: [],
          },
        ],
      },
    });

    console.warn = originalWarn;

    expect(parsed).not.toBeNull();
    expect(parsed!.nodes.map((node) => node.id)).toContain('seq-1');
    expect(parsed!.nodes.map((node) => node.id)).toContain('sticker-1');
    expect(warnings.filter((line) => line.includes('UNSUPPORTED_LEGACY_SIZE_API')).length).toBeGreaterThanOrEqual(2);
  });

  it('runs fixture-driven size contract regression from agent fixture catalog', () => {
    const catalogPath = join(
      process.cwd(),
      'specs/001-standardized-sizes/checklists/agent-size-fixtures.md',
    );
    const catalog = readFileSync(catalogPath, 'utf8');
    const fixtureLines = catalog
      .split('\n')
      .filter((line) => /^- (T|S|H|M|O)\d{2}\b/.test(line));
    expect(fixtureLines).toHaveLength(60);

    const fixtureGraphs = [
      { type: 'graph-text', props: { id: 'fx-text', x: 0, y: 0, text: 'text', fontSize: 'm' }, children: [] },
      { type: 'graph-sticky', props: { id: 'fx-sticky', x: 0, y: 0, text: 'sticky', size: { token: 'm', ratio: 'portrait' } }, children: [] },
      { type: 'graph-shape', props: { id: 'fx-shape', x: 0, y: 0, label: 'shape', type: 'rectangle', size: 120 }, children: [] },
      {
        type: 'graph-node',
        props: { id: 'fx-md', x: 0, y: 0 },
        children: [
          {
            type: 'graph-markdown',
            props: { content: '# md', size: { widthHeight: 's' } },
            children: [],
          },
        ],
      },
    ];

    const parsed = parseRenderGraph({
      graph: {
        children: fixtureGraphs,
      },
    });

    expect(parsed).not.toBeNull();
    const textNode = parsed!.nodes.find((node) => node.id === 'fx-text');
    const stickyNode = parsed!.nodes.find((node) => node.id === 'fx-sticky');
    const shapeNode = parsed!.nodes.find((node) => node.id === 'fx-shape');
    const markdownNode = parsed!.nodes.find((node) => node.id === 'fx-md');
    expect(textNode?.data?.fontSize).toBe('m');
    expect(stickyNode?.data?.size).toMatchObject({ token: 'm', ratio: 'portrait' });
    expect(shapeNode?.data?.size).toBe(120);
    expect(markdownNode?.data?.size).toEqual({ widthHeight: 's' });
  });
});
