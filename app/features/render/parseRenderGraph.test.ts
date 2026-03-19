import { describe, expect, it } from 'bun:test';
import {
  CANONICAL_OBJECT_FIXTURE_SETS,
} from './__fixtures__/objectCapabilityFixtures';
import {
  assertCanonicalMatch,
  assertCanonicalValidationFailure,
} from './objectCapabilityTestUtils';
import { parseRenderGraph } from './parseRenderGraph';
import { createCanonicalFromLegacyAliasInput } from './aliasNormalization';

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

describe('parseRenderGraph structural canvas metadata', () => {
  it('preserves explicit groupId and zIndex props on canvas nodes', () => {
    const parsed = parseRenderGraph({
      graph: {
        children: [
          {
            type: 'graph-shape',
            props: {
              id: 'shape-a',
              x: 40,
              y: 80,
              groupId: 'group-1',
              zIndex: 12,
            },
            children: [],
          },
        ],
      },
    });

    expect(parsed).not.toBeNull();
    expect(parsed?.nodes[0]).toMatchObject({
      id: 'shape-a',
      zIndex: 12,
      data: {
        groupId: 'group-1',
        zIndex: 12,
      },
    });
  });
});

describe('parseRenderGraph canonical object normalization', () => {
  it('preserves minimal phase-1 shape variants on graph-shape nodes', () => {
    const parsed = parseRenderGraph({
      graph: {
        children: [
          {
            type: 'graph-shape',
            props: {
              id: 'ellipse-shape',
              x: 20,
              y: 30,
              type: 'ellipse',
              size: { width: 220, height: 140 },
            },
            children: [],
          },
          {
            type: 'graph-shape',
            props: {
              id: 'diamond-shape',
              x: 60,
              y: 80,
              type: 'diamond',
              size: { width: 160, height: 160 },
            },
            children: [],
          },
          {
            type: 'graph-shape',
            props: {
              id: 'line-shape',
              x: 90,
              y: 140,
              type: 'line',
              lineDirection: 'up',
              size: { width: 180, height: 48 },
            },
            children: [],
          },
        ],
      },
    });

    expect(parsed).not.toBeNull();
    const ellipseNode = parsed!.nodes.find((node) => node.id === 'ellipse-shape');
    const diamondNode = parsed!.nodes.find((node) => node.id === 'diamond-shape');
    const lineNode = parsed!.nodes.find((node) => node.id === 'line-shape');

    expect(ellipseNode?.type).toBe('shape');
    expect((ellipseNode?.data as Record<string, unknown>)?.type).toBe('ellipse');
    assertCanonicalMatch(
      (ellipseNode?.data as Record<string, unknown>)?.canonicalObject,
      {
        semanticRole: 'shape',
        alias: 'Shape',
        capabilities: {
          frame: {
            shape: 'ellipse',
          },
        },
      },
    );

    expect((diamondNode?.data as Record<string, unknown>)?.type).toBe('diamond');
    assertCanonicalMatch(
      (diamondNode?.data as Record<string, unknown>)?.canonicalObject,
      {
        semanticRole: 'shape',
        alias: 'Shape',
        capabilities: {
          frame: {
            shape: 'diamond',
          },
        },
      },
    );

    expect((lineNode?.data as Record<string, unknown>)?.type).toBe('line');
    expect((lineNode?.data as Record<string, unknown>)?.lineDirection).toBe('up');
    assertCanonicalMatch(
      (lineNode?.data as Record<string, unknown>)?.canonicalObject,
      {
        semanticRole: 'shape',
        alias: 'Shape',
        capabilities: {
          frame: {
            shape: 'line',
          },
        },
      },
    );
  });

  it('normalizes legacy node aliases into canonical text content', () => {
    const fixture = CANONICAL_OBJECT_FIXTURE_SETS.legacyAliasInference;
    const parsed = parseRenderGraph({
      graph: {
        children: [fixture.input.node as any],
      },
    });

    expect(parsed).not.toBeNull();
    expect(parsed!.nodes).toHaveLength(1);
    assertCanonicalMatch(
      (parsed!.nodes[0].data as Record<string, unknown>).canonicalObject,
      fixture.expectedCanonical!,
    );
  });

  it('prefers explicit frame props over preset defaults for shape-like nodes', () => {
    const fixture = CANONICAL_OBJECT_FIXTURE_SETS.explicitOverridePreset;
    const parsed = parseRenderGraph({
      graph: {
        children: [fixture.input.node as any],
      },
    });

    expect(parsed).not.toBeNull();
    expect(parsed!.nodes).toHaveLength(1);
    assertCanonicalMatch(
      (parsed!.nodes[0].data as Record<string, unknown>).canonicalObject,
      fixture.expectedCanonical!,
      );
  });

  it('infers text content from legacy renderer children when props are empty', () => {
    const canonicalResult = createCanonicalFromLegacyAliasInput({
      alias: 'Node',
      core: {
        id: 'legacy-children-text',
        sourceMeta: {
          sourceId: 'legacy-children-text',
          kind: 'canvas',
        },
      },
      legacyProps: {},
      legacyChildren: [
        {
          type: 'text',
          props: {
            text: 'Standalone text',
          },
          children: [],
        },
      ],
    });

    expect(canonicalResult).toMatchObject({ ok: true });
    if (!canonicalResult.ok) {
      throw new Error('Expected canonical normalization success');
    }

    assertCanonicalMatch(
      canonicalResult.canonical,
      {
        semanticRole: 'topic',
        alias: 'Node',
        capabilities: {
          content: {
            kind: 'text',
            value: 'Standalone text',
          },
        },
        capabilitySources: {
          content: 'legacy-inferred',
        },
      },
    );
  });

  it('applies explicit capability overrides above inferred and alias defaults', () => {
    const canonicalResult = createCanonicalFromLegacyAliasInput({
      alias: 'Shape',
      core: {
        id: 'shape-explicit-overrides',
        sourceMeta: {
          sourceId: 'shape-explicit-overrides',
          kind: 'canvas',
        },
      },
      legacyProps: {
        type: 'heart',
        fill: '#0f172a',
        stroke: '#38bdf8',
        strokeWidth: 3,
        text: 'explicit override stays explicit',
      },
      explicitCapabilities: {
        frame: {
          shape: 'rectangle',
          fill: '#ff6b6b',
          stroke: '#38bdf8',
          strokeWidth: 7,
        },
      },
    });

    expect(canonicalResult).toMatchObject({ ok: true });
    if (!canonicalResult.ok) {
      throw new Error('Expected canonical normalization success');
    }

    assertCanonicalMatch(
      canonicalResult.canonical,
      {
        semanticRole: 'shape',
        alias: 'Shape',
        capabilities: {
          frame: {
            shape: 'rectangle',
            fill: '#ff6b6b',
            stroke: '#38bdf8',
            strokeWidth: 7,
          },
          content: {
            kind: 'text',
            value: 'explicit override stays explicit',
          },
        },
        capabilitySources: {
          frame: 'explicit',
          content: 'legacy-inferred',
        },
      },
    );
  });

  it('prefers legacy-inferred capabilities above preset defaults', () => {
    const canonicalResult = createCanonicalFromLegacyAliasInput({
      alias: 'Shape',
      core: {
        id: 'shape-inferred',
        sourceMeta: {
          sourceId: 'shape-inferred',
          kind: 'canvas',
        },
      },
      legacyProps: {
        type: 'speech',
        text: 'inferred should beat preset frame',
      },
    });

    expect(canonicalResult).toMatchObject({ ok: true });
    if (!canonicalResult.ok) {
      throw new Error('Expected canonical normalization success');
    }

    assertCanonicalMatch(
      canonicalResult.canonical,
      {
        semanticRole: 'shape',
        alias: 'Shape',
        capabilities: {
          frame: {
            shape: 'speech',
          },
          content: {
            kind: 'text',
            value: 'inferred should beat preset frame',
          },
        },
        capabilitySources: {
          frame: 'legacy-inferred',
          content: 'legacy-inferred',
        },
      },
    );
  });

  it('reuses non-sticky material and attach capabilities on canonical shape nodes', () => {
    const parsed = parseRenderGraph({
      graph: {
        children: [
          {
            type: 'graph-shape',
            props: {
              id: 'shape-reusable-capabilities',
              x: 12,
              y: 18,
              type: 'rectangle',
              text: 'reused capabilities',
              pattern: { type: 'preset', id: 'postit' },
              texture: { opacity: 0.15 },
              at: {
                target: 'anchor-node',
                position: 'top',
                offset: 10,
              },
            },
            children: [],
          },
        ],
      },
    });

    expect(parsed).not.toBeNull();
    expect(parsed!.nodes).toHaveLength(1);
    assertCanonicalMatch(
      (parsed!.nodes[0].data as Record<string, unknown>).canonicalObject,
      {
        semanticRole: 'shape',
        alias: 'Shape',
        capabilities: {
          frame: {
            shape: 'rectangle',
          },
          content: {
            kind: 'text',
            value: 'reused capabilities',
          },
          material: {
            pattern: { type: 'preset', id: 'postit' },
          },
          texture: {
            texture: {
              opacity: 0.15,
            },
          },
          attach: {
            target: 'anchor-node',
            position: 'top',
            offset: 10,
          },
        },
        capabilitySources: {
          frame: 'explicit',
          content: 'explicit',
          material: 'explicit',
          texture: 'explicit',
          attach: 'explicit',
        },
      },
    );
  });

  it('keeps sticky-note semantic when defaults are partially reduced', () => {
    const parsed = parseRenderGraph({
      graph: {
        children: [
          {
            type: 'graph-sticky',
            props: {
              id: 'sticky-partial-defaults',
              x: 8,
              y: 14,
              text: 'sticky semantic with reduced defaults',
            },
            children: [],
          },
        ],
      },
    });

    expect(parsed).not.toBeNull();
    expect(parsed!.nodes).toHaveLength(1);
    assertCanonicalMatch(
      (parsed!.nodes[0].data as Record<string, unknown>).canonicalObject,
      {
        semanticRole: 'sticky-note',
        alias: 'Sticky',
        capabilities: {
          content: {
            kind: 'text',
            value: 'sticky semantic with reduced defaults',
          },
        },
        capabilitySources: {
          content: 'explicit',
        },
      },
    );
  });

  it('keeps sticky-note semantic when sticky defaults are reduced', () => {
    const fixture = CANONICAL_OBJECT_FIXTURE_SETS.stickySemanticPreservation;
    const parsed = parseRenderGraph({
      graph: {
        children: [fixture.input.node as any],
      },
    });

    expect(parsed).not.toBeNull();
    expect(parsed!.nodes).toHaveLength(1);
    assertCanonicalMatch(
      (parsed!.nodes[0].data as Record<string, unknown>).canonicalObject,
      fixture.expectedCanonical!,
    );
  });

  it('stores canonical validation failures for content-kind mismatch inputs', () => {
    const fixture = CANONICAL_OBJECT_FIXTURE_SETS.contentKindMismatch;
    const parsed = parseRenderGraph({
      graph: {
        children: [fixture.input.node as any],
      },
    });

    expect(parsed).not.toBeNull();
    expect(parsed!.nodes).toHaveLength(1);
    assertCanonicalValidationFailure(
      (parsed!.nodes[0].data as Record<string, unknown>).canonicalValidation as any,
      fixture.expectedValidation as any,
    );
  });

  it('normalizes top-level image nodes to content:media canonical objects', () => {
    const parsed = parseRenderGraph({
      graph: {
        children: [
          {
            type: 'graph-image',
            props: {
              id: 'img-media',
              x: 10,
              y: 20,
              src: '/media/diagram.png',
              alt: 'diagram',
              fit: 'cover',
              width: 180,
              height: 120,
            },
            children: [],
          },
        ],
      },
    });

    expect(parsed).not.toBeNull();
    const imageNode = parsed!.nodes.find((node) => node.id === 'img-media');
    expect(imageNode?.type).toBe('image');
    assertCanonicalMatch(
      (imageNode?.data as Record<string, unknown>)?.canonicalObject,
      {
        semanticRole: 'image',
        alias: 'Image',
        capabilities: {
          content: {
            kind: 'media',
            src: '/media/diagram.png',
            alt: 'diagram',
            fit: 'cover',
            width: 180,
            height: 120,
          },
        },
      },
    );
  });

  it('preserves child-authored text as canonical content on graph-text nodes', () => {
    const parsed = parseRenderGraph({
      graph: {
        children: [
          {
            type: 'graph-text',
            props: {
              id: 'text-child-content',
              x: 10,
              y: 20,
            },
            children: [
              {
                type: 'text',
                props: {
                  text: 'Standalone text',
                },
                children: [],
              },
            ],
          },
        ],
      },
    });

    expect(parsed).not.toBeNull();
    const textNode = parsed!.nodes.find((node) => node.id === 'text-child-content');
    expect(textNode?.type).toBe('text');
    assertCanonicalMatch(
      (textNode?.data as Record<string, unknown>)?.canonicalObject,
      {
        semanticRole: 'topic',
        alias: 'Node',
        capabilities: {
          content: {
            kind: 'text',
            value: 'Standalone text',
          },
        },
      },
    );
  });

  it('parses graph-sequence nodes as sequence renderer with canonical sequence content', () => {
    const parsed = parseRenderGraph({
      graph: {
        children: [
          {
            type: 'graph-sequence',
            props: {
              id: 'seq-1',
              x: 10,
              y: 20,
              participantSpacing: 190,
              messageSpacing: 70,
            },
            children: [
              { type: 'graph-participant', props: { id: 'alice', label: 'Alice' } },
              { type: 'graph-participant', props: { id: 'bob', label: 'Bob' } },
              {
                type: 'graph-message',
                props: {
                  from: 'alice',
                  to: 'bob',
                  label: 'hello',
                  type: 'async',
                },
              },
            ],
          },
        ],
      },
    });

    expect(parsed).not.toBeNull();
    const seqNode = parsed!.nodes.find((node) => node.id === 'seq-1');
    expect(seqNode?.type).toBe('sequence-diagram');
    expect(seqNode?.data).toMatchObject({
      participantSpacing: 190,
      messageSpacing: 70,
      participants: [
        { id: 'alice', label: 'Alice', className: undefined },
        { id: 'bob', label: 'Bob', className: undefined },
      ],
      messages: [
        {
          from: 'alice',
          to: 'bob',
          label: 'hello',
          type: 'async',
        },
      ],
    });
    assertCanonicalMatch(
      (seqNode?.data as Record<string, unknown>)?.canonicalObject,
      {
        semanticRole: 'sequence',
        alias: 'Sequence',
        capabilities: {
          content: {
            kind: 'sequence',
            participants: [],
            messages: [],
          },
        },
      },
    );
  });

  it('rejects canonical explicit content mismatches for Image/Markdown/Sequence aliases', () => {
    const cases = [
      {
        alias: 'Image',
        content: { kind: 'text', value: 'bad media contract' },
        expectedMessage: 'alias "Image" only supports content kind media.',
      },
      {
        alias: 'Markdown',
        content: { kind: 'media', src: '/media.png', alt: 'bad markdown contract' },
        expectedMessage: 'alias "Markdown" only supports content kind markdown.',
      },
      {
        alias: 'Sequence',
        content: { kind: 'text', value: 'bad sequence contract' },
        expectedMessage: 'alias "Sequence" only supports content kind sequence.',
      },
    ] as const;

    for (const caseItem of cases) {
      const canonicalResult = createCanonicalFromLegacyAliasInput({
        alias: caseItem.alias as any,
        core: {
          id: `content-kind-mismatch-${caseItem.alias.toLowerCase()}`,
          sourceMeta: {
            sourceId: `content-kind-mismatch-${caseItem.alias.toLowerCase()}`,
            kind: 'canvas',
          },
        },
        legacyProps: {},
        explicitCapabilities: {
          content: caseItem.content as any,
        },
      });

      expect(canonicalResult).toMatchObject({
        ok: false,
        code: 'CONTENT_CONTRACT_VIOLATION',
        path: 'capabilities.content',
      });
      if (canonicalResult.ok) {
        throw new Error(`Expected ${caseItem.alias} canonicalization mismatch failure`);
      }

      expect(canonicalResult.message).toContain(caseItem.expectedMessage);
    }
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
