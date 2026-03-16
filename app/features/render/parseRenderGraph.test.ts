import { describe, expect, it } from 'bun:test';
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
    expect(parsed!.layoutType).toBe('compact');
    expect(parsed!.mindMapGroups).toEqual([
      expect.objectContaining({
        id: 'map',
        layoutType: 'compact',
        spacing: 50,
      }),
    ]);
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
    expect(parsed!.layoutType).toBe('compact');
    expect(parsed!.nodes.map((n) => n.id)).toEqual(['map.root-a', 'map.root-b']);
    expect(parsed!.edges).toHaveLength(0);
  });

  it('preserves compact layout metadata and defaults spacing for multi-root mindmaps', () => {
    const parsed = parseRenderGraph({
      graph: {
        children: [
          {
            type: 'graph-mindmap',
            props: { id: 'map', layout: 'compact' },
            children: [
              { type: 'graph-node', props: { id: 'root-a', text: 'Root A' }, children: [] },
              { type: 'graph-node', props: { id: 'root-b', text: 'Root B' }, children: [] },
            ],
          },
        ],
      },
    });

    expect(parsed).not.toBeNull();
    expect(parsed!.needsAutoLayout).toBe(true);
    expect(parsed!.layoutType).toBe('compact');
    expect(parsed!.mindMapGroups).toEqual([
      expect.objectContaining({
        id: 'map',
        layoutType: 'compact',
        basePosition: { x: 0, y: 0 },
        spacing: 50,
      }),
    ]);
    expect(parsed!.nodes.map((node) => node.id)).toEqual(['map.root-a', 'map.root-b']);
    expect(parsed!.edges).toHaveLength(0);
  });

  it('preserves explicit spacing for compact mindmap groups', () => {
    const parsed = parseRenderGraph({
      graph: {
        children: [
          {
            type: 'graph-mindmap',
            props: { id: 'map', layout: 'compact', spacing: 72 },
            children: [
              { type: 'graph-node', props: { id: 'root', text: 'Root' }, children: [] },
              { type: 'graph-node', props: { id: 'child', from: 'root', text: 'Child' }, children: [] },
            ],
          },
        ],
      },
    });

    expect(parsed).not.toBeNull();
    expect(parsed!.layoutType).toBe('compact');
    expect(parsed!.mindMapGroups).toEqual([
      expect.objectContaining({
        id: 'map',
        layoutType: 'compact',
        spacing: 72,
      }),
    ]);
  });

  it('preserves embedded subtree namespaces within one mindmap', () => {
    const parsed = parseRenderGraph({
      graph: {
        children: [
          {
            type: 'graph-mindmap',
            props: { id: 'map' },
            children: [
              { type: 'graph-node', props: { id: 'platform', text: 'Platform' }, children: [] },
              {
                type: 'graph-node',
                props: { id: 'auth.root', from: 'platform', text: 'Auth', __mindmapEmbedScope: 'auth' },
                children: [],
              },
              {
                type: 'graph-node',
                props: { id: 'auth.jwt', from: 'auth.root', text: 'JWT', __mindmapEmbedScope: 'auth' },
                children: [],
              },
              {
                type: 'graph-node',
                props: { id: 'billing.root', from: 'platform', text: 'Billing', __mindmapEmbedScope: 'billing' },
                children: [],
              },
              {
                type: 'graph-node',
                props: { id: 'billing.invoice', from: 'billing.root', text: 'Invoice', __mindmapEmbedScope: 'billing' },
                children: [],
              },
            ],
          },
        ],
      },
    });

    expect(parsed).not.toBeNull();
    expect(parsed!.nodes.map((node) => node.id)).toEqual([
      'map.platform',
      'map.auth.root',
      'map.auth.jwt',
      'map.billing.root',
      'map.billing.invoice',
    ]);
    expect(parsed!.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: 'map.platform', target: 'map.auth.root' }),
        expect.objectContaining({ source: 'map.auth.root', target: 'map.auth.jwt' }),
        expect.objectContaining({ source: 'map.platform', target: 'map.billing.root' }),
        expect.objectContaining({ source: 'map.billing.root', target: 'map.billing.invoice' }),
      ]),
    );
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

  it('defaults embedded markdown nodes without size to auto content sizing', () => {
    const parsed = parseRenderGraph({
      graph: {
        children: [
          {
            type: 'graph-node',
            props: { id: 'doc-auto', x: 0, y: 0 },
            children: [
              {
                type: 'graph-markdown',
                props: { content: '# Title\n\n- one\n- two' },
                children: [],
              },
            ],
          },
        ],
      },
    });

    expect(parsed).not.toBeNull();
    const markdownNode = parsed!.nodes.find((node) => node.id === 'doc-auto');
    expect(markdownNode?.type).toBe('markdown');
    expect(markdownNode?.data?.size).toEqual({ token: 'auto' });
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

  it('preserves frame-aware source metadata on parsed nodes', () => {
    const parsed = parseRenderGraph({
      graph: {
        children: [
          {
            type: 'graph-shape',
            props: {
              id: 'auth.cache.worker',
              x: 10,
              y: 20,
              sourceMeta: {
                sourceId: 'worker',
                renderedId: 'auth.cache.worker',
                filePath: 'components/service-frame.tsx',
                kind: 'canvas',
                frameScope: 'auth.cache',
                framePath: ['auth', 'cache'],
              },
            },
            children: [],
          },
        ],
      },
    });

    expect(parsed).not.toBeNull();
    const workerNode = parsed!.nodes.find((node) => node.id === 'auth.cache.worker');
    expect(workerNode?.data?.sourceMeta).toEqual({
      sourceId: 'worker',
      renderedId: 'auth.cache.worker',
      filePath: 'components/service-frame.tsx',
      kind: 'canvas',
      frameScope: 'auth.cache',
      framePath: ['auth', 'cache'],
    });
  });

  it('derives editMeta for rich content, relative attachments, and mindmap members', () => {
    const parsed = parseRenderGraph({
      graph: {
        children: [
          { type: 'graph-text', props: { id: 'text-1', x: 0, y: 0, text: 'Hello' }, children: [] },
          {
            type: 'graph-washi-tape',
            props: {
              id: 'washi-1',
              at: { type: 'attach', target: 'ref', placement: 'top', offset: 12 },
            },
            children: [],
          },
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

    const textNode = parsed!.nodes.find((node) => node.id === 'text-1');
    const washiNode = parsed!.nodes.find((node) => node.id === 'washi-1');
    const mindmapNode = parsed!.nodes.find((node) => node.id === 'map.child');

    expect(textNode?.data?.editMeta).toMatchObject({
      family: 'rich-content',
      contentCarrier: 'text-child',
      createMode: 'canvas',
    });
    expect(textNode?.data?.editMeta?.styleEditableKeys).toContain('fontSize');

    expect(washiNode?.data?.editMeta).toMatchObject({
      family: 'relative-attachment',
      relativeCarrier: 'at.offset',
      createMode: 'canvas',
    });
    expect(washiNode?.data?.editMeta?.styleEditableKeys).toContain('pattern');

    expect(mindmapNode?.data?.editMeta).toMatchObject({
      family: 'mindmap-member',
      contentCarrier: 'label-prop',
      createMode: 'mindmap-child',
    });
  });

  it('preserves className surfaces for image and washi runtime styling targets', () => {
    const parsed = parseRenderGraph({
      graph: {
        children: [
          {
            type: 'graph-image',
            props: {
              id: 'image-1',
              src: '/sample.png',
              className: 'rounded-2xl shadow-xl group-hover:ring-2',
            },
            children: [],
          },
          {
            type: 'graph-washi-tape',
            props: {
              id: 'washi-1',
              at: { type: 'polar', x: 0, y: 0, length: 180, thickness: 36 },
              className: 'bg-cyan-200 group-hover:bg-cyan-300',
            },
            children: [],
          },
        ],
      },
    });

    expect(parsed).not.toBeNull();
    const imageNode = parsed!.nodes.find((node) => node.id === 'image-1');
    const washiNode = parsed!.nodes.find((node) => node.id === 'washi-1');

    expect(imageNode?.data?.className).toBe('rounded-2xl shadow-xl group-hover:ring-2');
    expect(washiNode?.data?.className).toBe('bg-cyan-200 group-hover:bg-cyan-300');
  });
});
