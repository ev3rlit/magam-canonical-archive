import type { ExamplePluginManifest } from '../types';

export const tableExampleManifest: ExamplePluginManifest = {
  packageName: '@magam/example-table',
  version: '1.0.0',
  exportName: 'table.grid',
  displayName: 'Example Table Widget',
  runtime: 'iframe',
  entry: './index.tsx',
  capabilities: ['query:objects', 'instance:update-props', 'resize:request'],
  propSchema: {
    type: 'object',
    required: ['columns', 'rows'],
    properties: {
      columns: {
        type: 'array',
        items: { type: 'string' },
      },
      rows: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: true,
        },
      },
      dense: {
        type: 'boolean',
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
