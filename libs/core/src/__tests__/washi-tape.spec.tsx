// @ts-nocheck
import * as React from 'react';
import { renderToGraph } from '../renderer';
import { WashiTape } from '../components/WashiTape';

describe('WashiTape component', () => {
  it('renders graph-washi-tape host node', async () => {
    const element = (
      <canvas>
        <WashiTape id="w1" x={12} y={20} preset="pastel-dots">
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
      expect(washi?.props?.preset).toBe('pastel-dots');
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
            at={{ type: 'polar', x: 0, y: 0, length: 180, thickness: 36 }}
            pattern={{ type: 'preset', id: 'kraft-grid' }}
            edge={{ variant: 'torn', roughness: 1.5 }}
            texture={{ opacity: 0.18, blendMode: 'multiply' }}
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
});
