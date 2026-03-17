import type { Node } from 'reactflow';
import type {
  EligibleObjectCapabilities,
  EligibleObjectProfile,
} from './types';

export type IneligibleReason =
  | 'MISSING_CLASSNAME_SURFACE'
  | 'NO_STYLE_OR_SIZE_CAPABILITY';

export function resolveEligibleObjectProfile(input: {
  objectId: string;
  capabilities: EligibleObjectCapabilities;
}): EligibleObjectProfile {
  const { objectId, capabilities } = input;
  const hasClassNameSurface = Boolean(capabilities.hasClassNameSurface);
  const supportsStylingProps = Boolean(capabilities.supportsStylingProps);
  const supportsSizeProps = Boolean(capabilities.supportsSizeProps);

  if (!hasClassNameSurface) {
    return {
      objectId,
      hasClassNameSurface,
      supportsStylingProps,
      supportsSizeProps,
      isEligible: false,
      reasonIfIneligible: 'MISSING_CLASSNAME_SURFACE',
    };
  }

  if (!supportsStylingProps && !supportsSizeProps && !hasClassNameSurface) {
    return {
      objectId,
      hasClassNameSurface,
      supportsStylingProps,
      supportsSizeProps,
      isEligible: false,
      reasonIfIneligible: 'NO_STYLE_OR_SIZE_CAPABILITY',
    };
  }

  return {
    objectId,
    hasClassNameSurface,
    supportsStylingProps,
    supportsSizeProps,
    isEligible: true,
  };
}

const STYLE_CAPABILITY_KEYS = [
  'color',
  'labelColor',
  'outlineColor',
  'outlineWidth',
  'pattern',
  'shadow',
  'fontFamily',
  'bold',
  'italic',
  'opacity',
  'radius',
];

const SIZE_CAPABILITY_KEYS = [
  'size',
  'width',
  'height',
  'minWidth',
  'minHeight',
  'maxWidth',
  'maxHeight',
  'thickness',
];

function hasAnyKey(data: Record<string, unknown>, keys: readonly string[]): boolean {
  return keys.some((key) => key in data && data[key] !== undefined && data[key] !== null);
}

export function resolveEligibleCapabilitiesFromNode(
  node: Pick<Node, 'data'>,
): EligibleObjectCapabilities {
  const data = ((node.data || {}) as Record<string, unknown>);
  const hasClassNameSurface = typeof data.className === 'string';
  const supportsStylingProps = hasClassNameSurface || hasAnyKey(data, STYLE_CAPABILITY_KEYS);
  const supportsSizeProps = hasAnyKey(data, SIZE_CAPABILITY_KEYS);

  return {
    hasClassNameSurface,
    supportsStylingProps,
    supportsSizeProps,
  };
}

export function resolveEligibleObjectProfileForNode(
  node: Pick<Node, 'id' | 'data'>,
): EligibleObjectProfile {
  return resolveEligibleObjectProfile({
    objectId: node.id,
    capabilities: resolveEligibleCapabilitiesFromNode(node),
  });
}
