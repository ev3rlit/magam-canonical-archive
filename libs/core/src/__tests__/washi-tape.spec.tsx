import * as React from 'react';
import { renderToGraph } from '../renderer';
import { WashiTape } from '../components/WashiTape';
import {
  attach,
  image,
  polar,
  preset,
  segment,
  solid,
  svg,
  texture,
  torn,
} from '../components/WashiTape.helpers';
import { kraftgrid, pasteldots } from '../components/WashiTape.presets';

describe('WashiTape component', () => {
  it('renders graph-washi-tape host node', async () => {
    const element = (
      <canvas>
        <WashiTape id="w1" x={12} y={20} pattern={preset(pasteldots)}>
          TODO
        </WashiTape>
      </canvas>
    );

    const result = await renderToGraph(element);
    expect(result.isOk()).toBe(true);

    result.map((graph) => {
      const canvas = graph.children[0];
      const washi = canvas?.children?.[0];
      expect(washi?.type).toBe('graph-washi-tape');
      expect(washi?.props?.id).toBe('w1');
      expect(washi?.props?.pattern?.type).toBe('preset');
      expect(washi?.props?.pattern?.id).toBe('pastel-dots');
      expect(washi?.props?.at?.type).toBe('polar');
      expect(washi?.children?.[0]).toMatchObject({
        type: 'text',
        props: { text: 'TODO' },
      });
      return graph;
    });
  });

  it('returns error when placement and coordinates are both missing', async () => {
    const element = (
      <canvas>
        <WashiTape id="w2">TODO</WashiTape>
      </canvas>
    );

    const result = await renderToGraph(element);
    expect(result.isErr()).toBe(true);
  });

  it('preserves export-related props for all target formats', async () => {
    const exportTargets = ['png', 'jpg', 'svg', 'pdf'];

    for (const exportTarget of exportTargets) {
      const element = (
        <canvas>
          <WashiTape
            id={`w-export-${exportTarget}`}
            dataExportTarget={exportTarget}
            at={polar(0, 0, 180, undefined, { thickness: 36 })}
            pattern={preset(kraftgrid)}
            edge={torn(1.5)}
            texture={texture({ opacity: 0.18, blendMode: 'multiply' })}
            text={{ align: 'center', color: '#0f172a', size: 14 }}
            sourceMeta={{ sourceId: `w-export-${exportTarget}`, kind: 'canvas' }}
            opacity={0.92}
          >
            Export
          </WashiTape>
        </canvas>
      );

      const result = await renderToGraph(element);
      expect(result.isOk()).toBe(true);

      result.map((graph) => {
        const canvas = graph.children[0];
        const washi = canvas?.children?.[0];
        expect(washi?.props?.dataExportTarget).toBe(exportTarget);
        expect(washi?.props?.pattern?.type).toBe('preset');
        expect(washi?.props?.pattern?.id).toBe('kraft-grid');
        expect(washi?.props?.edge?.variant).toBe('torn');
        expect(washi?.props?.texture?.blendMode).toBe('multiply');
        expect(washi?.props?.text?.align).toBe('center');
        expect(washi?.props?.sourceMeta?.sourceId).toBe(`w-export-${exportTarget}`);
        expect(washi?.props?.opacity).toBe(0.92);
        return graph;
      });
    }
  });

  it('accepts helper-generated at and pattern objects', async () => {
    const element = (
      <canvas>
        <WashiTape
          id="w-helper-segment"
          at={segment({ x: 40, y: 40 }, { x: 280, y: 80 }, { thickness: 26 })}
          pattern={solid('#fed7aa')}
        >
          Segment
        </WashiTape>
        <WashiTape
          id="w-helper-attach"
          at={attach({ target: 'w-helper-segment', placement: 'top', span: 0.5, align: 0 })}
          pattern={svg({ markup: '<svg xmlns="http://www.w3.org/2000/svg"></svg>' })}
        >
          Attach
        </WashiTape>
        <WashiTape
          id="w-helper-polar"
          at={polar(120, 220, 180, -6, { thickness: 24 })}
          pattern={image('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg"></svg>', { repeat: 'repeat-x' })}
        >
          Polar
        </WashiTape>
      </canvas>
    );

    const result = await renderToGraph(element);
    expect(result.isOk()).toBe(true);

    result.map((graph) => {
      const canvas = graph.children[0];
      const children = canvas?.children ?? [];
      const segmentNode = children.find((child) => child?.props?.id === 'w-helper-segment');
      const attachNode = children.find((child) => child?.props?.id === 'w-helper-attach');
      const polarNode = children.find((child) => child?.props?.id === 'w-helper-polar');

      expect(segmentNode?.props?.at?.type).toBe('segment');
      expect(segmentNode?.props?.pattern?.type).toBe('solid');
      expect(attachNode?.props?.at?.type).toBe('attach');
      expect(attachNode?.props?.pattern?.type).toBe('svg');
      expect(polarNode?.props?.at?.type).toBe('polar');
      expect(polarNode?.props?.pattern?.type).toBe('image');

      return graph;
    });
  });
});
