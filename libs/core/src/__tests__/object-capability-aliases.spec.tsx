/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import * as React from 'react';
import { describe, expect, it } from 'bun:test';

import { Image } from '../components/Image';
import { Node } from '../components/Node';
import { Shape } from '../components/Shape';
import { Sticky } from '../components/Sticky';
import { renderToGraph } from '../renderer';

function unwrapOrThrow(result: Awaited<ReturnType<typeof renderToGraph>>) {
  return result.match(
    (container) => container,
    (error) => {
      throw error;
    },
  );
}

describe('Object capability alias compatibility', () => {
  it('keeps Node rendering as graph-node for legacy text cases', async () => {
    const result = unwrapOrThrow(
      await renderToGraph(
        <canvas>
          <Node id="legacy-node" text="legacy alias inference" x={8} y={12} />
        </canvas>,
      ),
    );

    const renderedNode = result.children[0].children[0];
    expect(renderedNode.type).toBe('graph-node');
    expect(renderedNode.props).toEqual(
      expect.objectContaining({
        id: 'legacy-node',
        text: 'legacy alias inference',
      }),
    );
  });

  it('keeps Shape rendering as graph-shape for explicit frame props', async () => {
    const result = unwrapOrThrow(
      await renderToGraph(
        <canvas>
          <Shape
            id="shape-override"
            x={20}
            y={24}
            type="rectangle"
            fill="#0f172a"
            stroke="#38bdf8"
            strokeWidth={3}
          />
        </canvas>,
      ),
    );

    const renderedNode = result.children[0].children[0];
    expect(renderedNode.type).toBe('graph-shape');
    expect(renderedNode.props).toEqual(
      expect.objectContaining({
        id: 'shape-override',
        type: 'rectangle',
        fill: '#0f172a',
        stroke: '#38bdf8',
        strokeWidth: 3,
      }),
    );
  });

  it('keeps Sticky rendering as graph-sticky while preserving sticky authoring props', async () => {
    const result = unwrapOrThrow(
      await renderToGraph(
        <canvas>
          <Sticky
            id="sticky-semantic"
            x={60}
            y={120}
            text="keep sticky-note semantic even if defaults are reduced"
          />
        </canvas>,
      ),
    );

    const renderedNode = result.children[0].children[0];
    expect(renderedNode.type).toBe('graph-sticky');
    expect(renderedNode.props).toEqual(
      expect.objectContaining({
        id: 'sticky-semantic',
        text: 'keep sticky-note semantic even if defaults are reduced',
      }),
    );
  });

  it('keeps Image rendering as graph-image for media-bound authoring input', async () => {
    const result = unwrapOrThrow(
      await renderToGraph(
        <canvas>
          <Image
            id="image-mismatch"
            x={10}
            y={10}
            src="https://example.com/media.png"
            alt="media"
          />
        </canvas>,
      ),
    );

    const renderedNode = result.children[0].children[0];
    expect(renderedNode.type).toBe('graph-image');
    expect(renderedNode.props).toEqual(
      expect.objectContaining({
        id: 'image-mismatch',
        src: 'https://example.com/media.png',
        alt: 'media',
      }),
    );
  });

  it('keeps Shape rendering as graph-shape while preserving reusable capability props', async () => {
    const result = unwrapOrThrow(
      await renderToGraph(
        <canvas>
          <Shape
            id="shape-capability-reuse"
            x={18}
            y={24}
            text="shape should carry non-sticky capability props"
            pattern={{ type: 'preset', id: 'postit' }}
            at={{ target: 'anchor', position: 'top', offset: 8 }}
            texture={{ opacity: 0.25 }}
          />
        </canvas>,
      ),
    );

    const renderedNode = result.children[0].children[0];
    expect(renderedNode.type).toBe('graph-shape');
    expect(renderedNode.props).toEqual(
      expect.objectContaining({
        id: 'shape-capability-reuse',
        text: 'shape should carry non-sticky capability props',
        pattern: { type: 'preset', id: 'postit' },
        at: {
          target: 'anchor',
          position: 'top',
          offset: 8,
        },
        texture: {
          opacity: 0.25,
        },
      }),
    );
  });
});
