// @ts-nocheck
import * as React from 'react';
import { renderToGraph } from '../renderer';
import { Sticker } from '../components/Sticker';

describe('Sticker component', () => {
  it('renders graph-sticker host node', async () => {
    const element = (
      <canvas>
        <Sticker id="s1" x={10} y={20}>
          TODO
        </Sticker>
      </canvas>
    );

    const result = await renderToGraph(element);
    expect(result.isOk()).toBe(true);

    result.map((graph) => {
      const canvas = graph.children[0];
      const sticker = canvas?.children?.[0];
      expect(sticker?.type).toBe('graph-sticker');
      expect(sticker?.props?.id).toBe('s1');
      expect(sticker?.children).toHaveLength(1);
      expect(sticker?.children?.[0]).toMatchObject({
        type: 'text',
        props: { text: 'TODO' },
      });
      return graph;
    });
  });

  it('returns error when id is missing', async () => {
    const element = (
      <canvas>
        <Sticker x={10} y={20}>
          TODO
        </Sticker>
      </canvas>
    );

    const result = await renderToGraph(element);
    expect(result.isErr()).toBe(true);
  });

  it('allows anchor positioning without x/y', async () => {
    const element = (
      <canvas>
        <Sticker id="s2" anchor="node-a" position="right">
          🔥
        </Sticker>
      </canvas>
    );

    const result = await renderToGraph(element);
    expect(result.isOk()).toBe(true);
  });

  it('preserves sticker style fields for PNG/JPG/SVG/PDF export pipelines', async () => {
    const exportTargets = ['png', 'jpg', 'svg', 'pdf'];

    for (const exportTarget of exportTargets) {
      const element = (
        <canvas>
          <Sticker
            id={`svg-1-${exportTarget}`}
            dataExportTarget={exportTarget}
            x={0}
            y={0}
            outlineWidth={8}
            outlineColor="#fff"
            shadow="lg"
            padding={12}
          >
            ./assets/logo.svg
          </Sticker>
        </canvas>
      );

      const result = await renderToGraph(element);
      expect(result.isOk()).toBe(true);

      result.map((graph) => {
        const canvas = graph.children[0];
        const sticker = canvas?.children?.[0];
        expect(sticker?.props?.outlineWidth).toBe(8);
        expect(sticker?.props?.outlineColor).toBe('#fff');
        expect(sticker?.props?.shadow).toBe('lg');
        expect(sticker?.props?.padding).toBe(12);
        expect(sticker?.props?.dataExportTarget).toBe(exportTarget);
        return graph;
      });
    }
  });
});
