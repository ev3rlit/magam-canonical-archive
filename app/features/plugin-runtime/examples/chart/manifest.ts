import type { ExamplePluginManifest } from '../types';

export const chartExampleManifest: ExamplePluginManifest = {
  packageName: '@magam/example-chart',
  version: '1.0.0',
  exportName: 'chart.bar',
  displayName: 'Example Chart Widget',
  runtime: 'iframe',
  entry: './index.tsx',
  capabilities: ['query:objects', 'instance:update-props', 'resize:request'],
  propSchema: {
    type: 'object',
    required: ['title', 'series'],
    properties: {
      title: { type: 'string' },
      series: {
        type: 'array',
        items: {
          type: 'object',
          required: ['label', 'value'],
          properties: {
            label: { type: 'string' },
            value: { type: 'number' },
          },
        },
      },
      palette: {
        type: 'array',
        items: { type: 'string' },
      },
    },
  },
  bindingSchema: {
    type: 'object',
    properties: {
      sourceRef: { type: 'object' },
      mapping: { type: 'object' },
    },
  },
};
