import type { CreatePayload } from './commands';
import { DEFAULT_WASHI_PRESET_ID } from '@/utils/washiTapeDefaults';
import { getDefaultStickerCreateProps } from '@/utils/stickerDefaults';
import {
  getDefaultImageSource,
  getDefaultNodeContent,
  getDefaultNodeIdSeed,
  getDefaultPluginInstanceDisplayName,
} from './defaultContent';

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function createSuggestedNodeId(nodeType: CreatePayload['nodeType'], seed?: string): string {
  const base = slugify(seed || getDefaultNodeIdSeed(nodeType)) || nodeType;
  return `${nodeType}-${base}`;
}

export function createUniqueNodeId(
  nodeType: CreatePayload['nodeType'],
  existingIds: Iterable<string>,
  seed?: string,
): string {
  const taken = new Set(existingIds);
  const base = createSuggestedNodeId(nodeType, seed);
  if (!taken.has(base)) {
    return base;
  }

  let counter = 2;
  while (taken.has(`${base}-${counter}`)) {
    counter += 1;
  }
  return `${base}-${counter}`;
}

export function getCreateDefaults(nodeType: CreatePayload['nodeType']): {
  initialContent?: string;
  initialProps: Record<string, unknown>;
} {
  const stickerDefaults = getDefaultStickerCreateProps();
  switch (nodeType) {
    case 'shape':
      return {
        initialContent: getDefaultNodeContent('shape'),
        initialProps: {
          type: 'rectangle',
          size: {
            token: 'm',
            ratio: 'landscape',
          },
        },
      };
    case 'rectangle':
      return {
        initialProps: {
          type: 'rectangle',
          size: {
            token: 'm',
            ratio: 'landscape',
          },
        },
      };
    case 'ellipse':
      return {
        initialProps: {
          type: 'ellipse',
          size: {
            token: 'm',
            ratio: 'landscape',
          },
        },
      };
    case 'diamond':
      return {
        initialProps: {
          type: 'diamond',
          size: {
            token: 'm',
            ratio: 'square',
          },
        },
      };
    case 'line':
      return {
        initialProps: {
          type: 'line',
          lineDirection: 'down',
          size: {
            width: 180,
            height: 48,
          },
          fill: 'transparent',
          stroke: '#475569',
          strokeWidth: 3,
        },
      };
    case 'text':
      return {
        initialContent: getDefaultNodeContent(nodeType),
        initialProps: {},
      };
    case 'markdown':
      return {
        initialContent: getDefaultNodeContent(nodeType),
        initialProps: {},
      };
    case 'sticker':
      return {
        initialContent: getDefaultNodeContent(nodeType),
        initialProps: {
          outlineColor: stickerDefaults.outlineColor,
          outlineWidth: stickerDefaults.outlineWidth,
          shadow: stickerDefaults.shadow,
          padding: stickerDefaults.padding,
        },
      };
    case 'washi-tape':
      return {
        initialProps: {
          pattern: { type: 'preset', id: DEFAULT_WASHI_PRESET_ID },
          opacity: 0.9,
        },
      };
    case 'image':
      return {
        initialProps: {
          src: getDefaultImageSource(),
          fit: 'cover',
        },
      };
    default:
      return {
        initialContent: getDefaultNodeContent(nodeType),
        initialProps: {},
      };
  }
}

export function isImmediateEditCreateNodeType(
  nodeType: CreatePayload['nodeType'],
): boolean {
  return nodeType === 'text' || nodeType === 'markdown' || nodeType === 'sticky';
}

export function isDragCreateNodeType(
  nodeType: CreatePayload['nodeType'],
): boolean {
  return nodeType === 'rectangle'
    || nodeType === 'ellipse'
    || nodeType === 'diamond'
    || nodeType === 'line'
    || nodeType === 'sticky';
}

export function isDragRequiredCreateNodeType(
  nodeType: CreatePayload['nodeType'],
): boolean {
  return nodeType === 'line';
}

export function createSuggestedPluginInstanceId(pluginExportId: string, seed?: string): string {
  const base = slugify(seed || pluginExportId) || 'plugin-widget';
  return `plugin-${base}`;
}

export function getPluginInstanceCreateDefaults(input: {
  pluginExportId: string;
  displayName?: string;
}): {
  id: string;
  displayName: string;
  initialProps: Record<string, unknown>;
  initialBindingConfig: Record<string, unknown>;
  initialPersistedState: Record<string, unknown>;
} {
  return {
    id: createSuggestedPluginInstanceId(input.pluginExportId, input.displayName),
    displayName: input.displayName?.trim() || getDefaultPluginInstanceDisplayName(),
    initialProps: {},
    initialBindingConfig: {},
    initialPersistedState: {},
  };
}
