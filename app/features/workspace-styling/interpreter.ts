import {
  classifyTokens,
  getCategoryPriority,
} from './classCategories';
import {
  createMixedInputDiagnostic,
  createOutOfScopeObjectDiagnostic,
  createUnsupportedCategoryDiagnostic,
  createUnsupportedTokenDiagnostic,
  dedupeDiagnostics,
} from './diagnostics';
import type {
  ClassifiedToken,
  EligibleObjectProfile,
  InterpretedStyleResult,
  ResolvedStylePayload,
  StylingDiagnostic,
  WorkspaceStyleCategory,
  WorkspaceStyleInput,
  WorkspaceStyleRuntimeContext,
} from './types';

type StyleAccumulator = {
  style: Record<string, string | number>;
  ringWidth: number;
  ringInset: boolean;
  ringColor: string;
  ringOffsetWidth: number;
  ringOffsetColor: string;
  shadowValue?: string;
  shadowColor?: string;
};

const DEFAULT_RUNTIME_CONTEXT: WorkspaceStyleRuntimeContext = {
  colorScheme: 'light',
  viewportWidth: 0,
};

const COLOR_PALETTES: Record<string, Record<string, string> | string> = {
  white: '#ffffff',
  black: '#000000',
  slate: {
    '50': '#f8fafc',
    '100': '#f1f5f9',
    '200': '#e2e8f0',
    '300': '#cbd5e1',
    '400': '#94a3b8',
    '500': '#64748b',
    '600': '#475569',
    '700': '#334155',
    '800': '#1e293b',
    '900': '#0f172a',
    '950': '#020617',
  },
  amber: {
    '100': '#fef3c7',
    '200': '#fde68a',
    '300': '#fcd34d',
    '400': '#fbbf24',
    '500': '#f59e0b',
    '600': '#d97706',
    '700': '#b45309',
  },
  blue: {
    '100': '#dbeafe',
    '200': '#bfdbfe',
    '300': '#93c5fd',
    '400': '#60a5fa',
    '500': '#3b82f6',
    '600': '#2563eb',
    '700': '#1d4ed8',
  },
  red: {
    '100': '#fee2e2',
    '200': '#fecaca',
    '300': '#fca5a5',
    '400': '#f87171',
    '500': '#ef4444',
    '600': '#dc2626',
    '700': '#b91c1c',
  },
  green: {
    '100': '#dcfce7',
    '200': '#bbf7d0',
    '300': '#86efac',
    '400': '#4ade80',
    '500': '#22c55e',
    '600': '#16a34a',
    '700': '#15803d',
  },
  violet: {
    '100': '#ede9fe',
    '200': '#ddd6fe',
    '300': '#c4b5fd',
    '400': '#a78bfa',
    '500': '#8b5cf6',
    '600': '#7c3aed',
    '700': '#6d28d9',
  },
  cyan: {
    '100': '#cffafe',
    '200': '#a5f3fc',
    '300': '#67e8f9',
    '400': '#22d3ee',
    '500': '#06b6d4',
    '600': '#0891b2',
    '700': '#0e7490',
  },
  yellow: {
    '100': '#fef9c3',
    '200': '#fef08a',
    '300': '#fde047',
    '400': '#facc15',
    '500': '#eab308',
  },
};

function tokenizeClassName(className: string): string[] {
  return className
    .trim()
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
}

function isArbitraryValue(value: string): boolean {
  return value.startsWith('[') && value.endsWith(']');
}

function unwrapArbitraryValue(value: string): string {
  return value.slice(1, -1).replaceAll('_', ' ');
}

function resolveFraction(value: string): string | null {
  const [numerator, denominator] = value.split('/');
  const top = Number(numerator);
  const bottom = Number(denominator);
  if (!Number.isFinite(top) || !Number.isFinite(bottom) || bottom === 0) {
    return null;
  }
  return `${(top / bottom) * 100}%`;
}

function resolveSpacingLikeValue(value: string, axis: 'width' | 'height'): string | null {
  if (isArbitraryValue(value)) {
    return unwrapArbitraryValue(value);
  }
  if (value === 'px') return '1px';
  if (value === 'auto') return 'auto';
  if (value === 'full') return '100%';
  if (value === 'fit') return 'fit-content';
  if (value === 'min') return 'min-content';
  if (value === 'max') return 'max-content';
  if (value === 'screen') return axis === 'width' ? '100vw' : '100vh';
  if (value.includes('/')) {
    return resolveFraction(value);
  }
  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    return `${numeric / 4}rem`;
  }
  return null;
}

function resolveRadiusValue(token: string): string | null {
  if (token === 'rounded') return '0.25rem';
  const suffix = token.slice('rounded-'.length);
  if (isArbitraryValue(suffix)) {
    return unwrapArbitraryValue(suffix);
  }
  const radiusBySuffix: Record<string, string> = {
    none: '0px',
    sm: '0.125rem',
    md: '0.375rem',
    lg: '0.5rem',
    xl: '0.75rem',
    '2xl': '1rem',
    '3xl': '1.5rem',
    full: '9999px',
  };
  return radiusBySuffix[suffix] ?? null;
}

function resolveArbitraryTextValue(value: string): { kind: 'fontSize' | 'color'; value: string } {
  const unwrapped = unwrapArbitraryValue(value);
  const looksLikeFontSize = /^-?\d*\.?\d+(?:px|rem|em|%|vh|vw|vmin|vmax|ch|ex|pt|pc|cm|mm|in)$/.test(unwrapped)
    || /^(?:calc|min|max|clamp)\(/.test(unwrapped);

  return {
    kind: looksLikeFontSize ? 'fontSize' : 'color',
    value: unwrapped,
  };
}

function resolveOpacityValue(token: string): number | null {
  const value = token.slice('opacity-'.length);
  if (isArbitraryValue(value)) {
    const parsed = Number(unwrapArbitraryValue(value));
    return Number.isFinite(parsed) ? parsed : null;
  }
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return Math.max(0, Math.min(1, numeric / 100));
}

function resolveWidthValue(token: string): { property: string; value: string } | null {
  const mappings: Array<[prefix: string, property: string, axis: 'width' | 'height']> = [
    ['min-w-', 'minWidth', 'width'],
    ['max-w-', 'maxWidth', 'width'],
    ['min-h-', 'minHeight', 'height'],
    ['max-h-', 'maxHeight', 'height'],
    ['w-', 'width', 'width'],
    ['h-', 'height', 'height'],
  ];

  for (const [prefix, property, axis] of mappings) {
    if (!token.startsWith(prefix)) continue;
    const rawValue = token.slice(prefix.length);
    const resolved = resolveSpacingLikeValue(rawValue, axis);
    if (!resolved) return null;
    return { property, value: resolved };
  }

  return null;
}

function resolveColorValue(rawToken: string): string | null {
  const [baseToken, alphaToken] = rawToken.split('/');
  if (isArbitraryValue(rawToken)) {
    return unwrapArbitraryValue(rawToken);
  }
  if (baseToken === 'white' || baseToken === 'black' || baseToken === 'transparent' || baseToken === 'current') {
    if (!alphaToken) {
      return baseToken;
    }
    const named = baseToken === 'white' ? '#ffffff' : baseToken === 'black' ? '#000000' : null;
    if (!named) return baseToken;
    const alpha = Number(alphaToken);
    if (!Number.isFinite(alpha)) return named;
    const normalizedAlpha = Math.max(0, Math.min(1, alpha / 100));
    return `rgba(${baseToken === 'white' ? '255, 255, 255' : '0, 0, 0'}, ${normalizedAlpha})`;
  }

  const segments = baseToken.split('-');
  const paletteName = segments[0];
  const shade = segments.slice(1).join('-');
  const palette = COLOR_PALETTES[paletteName];

  if (typeof palette === 'string' && shade.length === 0) {
    if (!alphaToken) {
      return palette;
    }
    const alpha = Number(alphaToken);
    if (!Number.isFinite(alpha) || !palette.startsWith('#')) {
      return palette;
    }
    const normalizedAlpha = Math.max(0, Math.min(1, alpha / 100));
    const r = parseInt(palette.slice(1, 3), 16);
    const g = parseInt(palette.slice(3, 5), 16);
    const b = parseInt(palette.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${normalizedAlpha})`;
  }

  if (palette && typeof palette === 'object') {
    const candidate = (palette as Record<string, string>)[shade];
    if (typeof candidate === 'string') {
      if (!alphaToken) {
        return candidate;
      }
      const alpha = Number(alphaToken);
      if (!Number.isFinite(alpha) || !candidate.startsWith('#')) {
        return candidate;
      }
      const normalizedAlpha = Math.max(0, Math.min(1, alpha / 100));
      const r = parseInt(candidate.slice(1, 3), 16);
      const g = parseInt(candidate.slice(3, 5), 16);
      const b = parseInt(candidate.slice(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, ${normalizedAlpha})`;
    }
  }

  return null;
}

function resolveBorderWidthValue(token: string): string | null {
  if (token === 'border') return '1px';
  const suffix = token.slice('border-'.length);
  if (isArbitraryValue(suffix)) {
    return unwrapArbitraryValue(suffix);
  }
  if (suffix === 'px') return '1px';
  const numeric = Number(suffix);
  if (Number.isFinite(numeric)) {
    return `${numeric}px`;
  }
  return null;
}

function resolveDirectionalBorderWidth(token: string): { property: string; value: string } | null {
  const mappings: Array<[prefix: string, property: string]> = [
    ['border-l-', 'borderLeftWidth'],
    ['border-r-', 'borderRightWidth'],
    ['border-t-', 'borderTopWidth'],
    ['border-b-', 'borderBottomWidth'],
  ];
  for (const [prefix, property] of mappings) {
    if (!token.startsWith(prefix)) continue;
    const suffix = token.slice(prefix.length);
    if (isArbitraryValue(suffix)) {
      return { property, value: unwrapArbitraryValue(suffix) };
    }
    const numeric = Number(suffix);
    if (Number.isFinite(numeric)) {
      return { property, value: `${numeric}px` };
    }
  }
  return null;
}

function resolveOutlineWidthValue(token: string): string | null {
  if (token === 'outline') return '1px';
  const suffix = token.slice('outline-'.length);
  if (isArbitraryValue(suffix)) {
    return unwrapArbitraryValue(suffix);
  }
  const numeric = Number(suffix);
  if (Number.isFinite(numeric)) {
    return `${numeric}px`;
  }
  return null;
}

function resolveRingWidthValue(token: string): number | null {
  if (token === 'ring') return 3;
  const suffix = token.slice('ring-'.length);
  if (isArbitraryValue(suffix)) {
    const numeric = Number(unwrapArbitraryValue(suffix).replace('px', ''));
    return Number.isFinite(numeric) ? numeric : null;
  }
  const numeric = Number(suffix);
  return Number.isFinite(numeric) ? numeric : null;
}

function resolveRingOffsetValue(token: string): number | null {
  const suffix = token.slice('ring-offset-'.length);
  if (isArbitraryValue(suffix)) {
    const numeric = Number(unwrapArbitraryValue(suffix).replace('px', ''));
    return Number.isFinite(numeric) ? numeric : null;
  }
  const numeric = Number(suffix);
  return Number.isFinite(numeric) ? numeric : null;
}

function resolveOutlineOffsetValue(token: string): string | null {
  const suffix = token.slice('outline-offset-'.length);
  if (isArbitraryValue(suffix)) {
    return unwrapArbitraryValue(suffix);
  }
  const numeric = Number(suffix);
  return Number.isFinite(numeric) ? `${numeric}px` : null;
}

function resolveShadowValue(token: string): string | undefined {
  const shadowByToken: Record<string, string | undefined> = {
    shadow: '0 1px 3px 0 rgba(15, 23, 42, 0.12), 0 1px 2px -1px rgba(15, 23, 42, 0.12)',
    'shadow-sm': '0 1px 2px 0 rgba(15, 23, 42, 0.08)',
    'shadow-md': '0 4px 6px -1px rgba(15, 23, 42, 0.12), 0 2px 4px -2px rgba(15, 23, 42, 0.12)',
    'shadow-lg': '0 10px 15px -3px rgba(15, 23, 42, 0.14), 0 4px 6px -4px rgba(15, 23, 42, 0.14)',
    'shadow-xl': '0 20px 25px -5px rgba(15, 23, 42, 0.16), 0 8px 10px -6px rgba(15, 23, 42, 0.16)',
    'shadow-2xl': '0 25px 50px -12px rgba(15, 23, 42, 0.25)',
    'shadow-inner': 'inset 0 2px 4px 0 rgba(15, 23, 42, 0.08)',
    'shadow-none': 'none',
  };

  if (token.startsWith('shadow-[') && token.endsWith(']')) {
    return unwrapArbitraryValue(token.slice('shadow-'.length));
  }

  return shadowByToken[token];
}

function applyShadowColor(shadowValue: string, color: string): string {
  return shadowValue.replace(/rgba\([^)]+\)/g, color);
}

function areConditionalVariantsActive(
  variants: string[],
  runtimeContext: WorkspaceStyleRuntimeContext,
): boolean {
  return variants.every((variant) => {
    if (variant === 'dark') {
      return runtimeContext.colorScheme === 'dark';
    }
    if (variant === 'md') {
      return runtimeContext.viewportWidth >= 768;
    }
    if (variant === 'lg') {
      return runtimeContext.viewportWidth >= 1024;
    }
    if (variant === 'xl') {
      return runtimeContext.viewportWidth >= 1280;
    }
    if (variant === '2xl') {
      return runtimeContext.viewportWidth >= 1536;
    }
    return false;
  });
}

function resolveInteractionLayer(variants: string[]): 'base' | 'hover' | 'focus' | 'active' | 'group-hover' | 'unsupported' {
  const hasHoverVariant = variants.includes('hover');
  const hasFocusVariant = variants.includes('focus');
  const hasActiveVariant = variants.includes('active');
  const hasGroupHoverVariant = variants.includes('group-hover');
  const interactionCount = [hasHoverVariant, hasFocusVariant, hasActiveVariant, hasGroupHoverVariant].filter(Boolean).length;

  if (interactionCount > 1) {
    return 'unsupported';
  }
  if (hasHoverVariant) {
    return 'hover';
  }
  if (hasFocusVariant) {
    return 'focus';
  }
  if (hasActiveVariant) {
    return 'active';
  }
  if (hasGroupHoverVariant) {
    return 'group-hover';
  }
  return 'base';
}

function collectActiveTokensByCategory(
  classified: ClassifiedToken[],
  runtimeContext: WorkspaceStyleRuntimeContext,
  interaction: 'base' | 'hover' | 'focus' | 'active' | 'group-hover',
): Map<WorkspaceStyleCategory, string[]> {
  const activeTokensByCategory = new Map<WorkspaceStyleCategory, string[]>();

  classified.forEach((item) => {
    if (!item.supported || !item.category) {
      return;
    }
    if (resolveInteractionLayer(item.variants) !== interaction) {
      return;
    }

    const conditionalVariants = item.variants.filter((variant) => variant !== 'hover' && variant !== 'focus' && variant !== 'active' && variant !== 'group-hover');
    if (!areConditionalVariantsActive(conditionalVariants, runtimeContext)) {
      return;
    }
    const current = activeTokensByCategory.get(item.category) ?? [];
    current.push(item.baseToken);
    activeTokensByCategory.set(item.category, current);
  });

  return activeTokensByCategory;
}

function ensureBorderStyle(style: Record<string, string | number>): void {
  if (!('borderStyle' in style)) {
    style.borderStyle = 'solid';
  }
  if (!('borderWidth' in style)) {
    style.borderWidth = '1px';
  }
}

function applySizeToken(accumulator: StyleAccumulator, token: string): void {
  const resolved = resolveWidthValue(token);
  if (!resolved) return;
  accumulator.style[resolved.property] = resolved.value;
}

function applyBasicVisualToken(accumulator: StyleAccumulator, token: string): void {
  if (token.startsWith('bg-')) {
    const color = resolveColorValue(token.slice('bg-'.length));
    if (color) accumulator.style.backgroundColor = color;
    return;
  }

  if (token.startsWith('text-')) {
    const sizeToken = token.slice('text-'.length);
    const fontSizeByToken: Record<string, string> = {
      xs: '0.75rem',
      sm: '0.875rem',
      base: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.875rem',
    };
    if (fontSizeByToken[sizeToken]) {
      accumulator.style.fontSize = fontSizeByToken[sizeToken];
      return;
    }
    if (isArbitraryValue(sizeToken)) {
      const resolved = resolveArbitraryTextValue(sizeToken);
      if (resolved.kind === 'fontSize') {
        accumulator.style.fontSize = resolved.value;
      } else {
        accumulator.style.color = resolved.value;
      }
      return;
    }
    const color = resolveColorValue(token.slice('text-'.length));
    if (color) accumulator.style.color = color;
    return;
  }

  if (token.startsWith('font-')) {
    const weight = token.slice('font-'.length);
    const fontWeightByToken: Record<string, string | number> = {
      thin: 100,
      extralight: 200,
      light: 300,
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
      extrabold: 800,
      black: 900,
      mono: 'monospace',
      serif: 'serif',
      sans: 'sans-serif',
    };
    const resolved = fontWeightByToken[weight];
    if (resolved !== undefined) {
      if (typeof resolved === 'number') {
        accumulator.style.fontWeight = resolved;
      } else {
        accumulator.style.fontFamily = resolved;
      }
    }
    return;
  }

  if (token === 'italic' || token === 'not-italic') {
    accumulator.style.fontStyle = token === 'italic' ? 'italic' : 'normal';
    return;
  }

  if (token.startsWith('tracking-')) {
    const trackingToken = token.slice('tracking-'.length);
    const trackingByToken: Record<string, string> = {
      tighter: '-0.05em',
      tight: '-0.025em',
      normal: '0em',
      wide: '0.025em',
      wider: '0.05em',
      widest: '0.1em',
    };
    const resolved = isArbitraryValue(trackingToken)
      ? unwrapArbitraryValue(trackingToken)
      : trackingByToken[trackingToken];
    if (resolved) {
      accumulator.style.letterSpacing = resolved;
    }
    return;
  }

  if (token.startsWith('gap-')) {
    const gap = resolveSpacingLikeValue(token.slice('gap-'.length), 'width');
    if (gap) accumulator.style.gap = gap;
    return;
  }

  if (token.startsWith('select-')) {
    const selectionMode = token.slice('select-'.length);
    const userSelectByToken: Record<string, string> = {
      none: 'none',
      text: 'text',
      all: 'all',
      auto: 'auto',
    };
    const resolved = userSelectByToken[selectionMode];
    if (resolved) {
      accumulator.style.userSelect = resolved;
    }
    return;
  }

  const directionalSpacingMappings: Array<[prefix: string, properties: string[]]> = [
    ['px-', ['paddingLeft', 'paddingRight']],
    ['py-', ['paddingTop', 'paddingBottom']],
    ['pt-', ['paddingTop']],
    ['pr-', ['paddingRight']],
    ['pb-', ['paddingBottom']],
    ['pl-', ['paddingLeft']],
    ['p-', ['padding']],
    ['mx-', ['marginLeft', 'marginRight']],
    ['my-', ['marginTop', 'marginBottom']],
    ['mt-', ['marginTop']],
    ['mr-', ['marginRight']],
    ['mb-', ['marginBottom']],
    ['ml-', ['marginLeft']],
    ['m-', ['margin']],
  ];
  for (const [prefix, properties] of directionalSpacingMappings) {
    if (!token.startsWith(prefix)) continue;
    const resolved = resolveSpacingLikeValue(token.slice(prefix.length), 'width');
    if (!resolved) return;
    properties.forEach((property) => {
      accumulator.style[property] = resolved;
    });
    return;
  }

  if (token.startsWith('border')) {
    const directional = resolveDirectionalBorderWidth(token);
    if (directional) {
      accumulator.style[directional.property] = directional.value;
      accumulator.style.borderStyle = 'solid';
      return;
    }
    if (token === 'border-dashed' || token === 'border-solid' || token === 'border-dotted') {
      accumulator.style.borderStyle = token.slice('border-'.length);
      if (!('borderWidth' in accumulator.style)) {
        accumulator.style.borderWidth = '1px';
      }
      return;
    }
    const borderWidth = resolveBorderWidthValue(token);
    if (borderWidth) {
      accumulator.style.borderWidth = borderWidth;
      ensureBorderStyle(accumulator.style);
      return;
    }

    const color = token === 'border' ? null : resolveColorValue(token.slice('border-'.length));
    if (color) {
      accumulator.style.borderColor = color;
      ensureBorderStyle(accumulator.style);
    }
    return;
  }

  if (token.startsWith('rounded')) {
    const radius = resolveRadiusValue(token);
    if (radius) accumulator.style.borderRadius = radius;
    return;
  }

  if (token.startsWith('opacity-')) {
    const opacity = resolveOpacityValue(token);
    if (opacity !== null) accumulator.style.opacity = opacity;
  }
}

function applyShadowToken(accumulator: StyleAccumulator, token: string): void {
  if (token.startsWith('shadow-')) {
    const color = resolveColorValue(token.slice('shadow-'.length));
    if (color) {
      accumulator.shadowColor = color;
      return;
    }
  }
  const shadowValue = resolveShadowValue(token);
  if (shadowValue !== undefined) {
    accumulator.shadowValue = shadowValue;
  }
}

function applyOutlineToken(accumulator: StyleAccumulator, token: string): void {
  if (token === 'outline-none') {
    accumulator.style.outlineStyle = 'none';
    accumulator.style.outlineWidth = '0px';
    return;
  }

  if (token === 'outline-dashed' || token === 'outline-solid' || token === 'outline-dotted') {
    accumulator.style.outlineStyle = token.slice('outline-'.length);
    if (!('outlineWidth' in accumulator.style)) {
      accumulator.style.outlineWidth = '1px';
    }
    return;
  }

  if (token.startsWith('outline-offset-')) {
    const offset = resolveOutlineOffsetValue(token);
    if (offset) {
      accumulator.style.outlineOffset = offset;
    }
    return;
  }

  if (token.startsWith('outline')) {
    const outlineWidth = resolveOutlineWidthValue(token);
    if (outlineWidth) {
      accumulator.style.outlineStyle = 'solid';
      accumulator.style.outlineWidth = outlineWidth;
      return;
    }

    const color = token === 'outline' ? null : resolveColorValue(token.slice('outline-'.length));
    if (color) {
      accumulator.style.outlineStyle = 'solid';
      accumulator.style.outlineColor = color;
    }
    return;
  }

  if (token.startsWith('ring-offset-')) {
    const offsetWidth = resolveRingOffsetValue(token);
    if (offsetWidth !== null) {
      accumulator.ringOffsetWidth = offsetWidth;
      return;
    }

    const color = resolveColorValue(token.slice('ring-offset-'.length));
    if (color) {
      accumulator.ringOffsetColor = color;
    }
    return;
  }

  if (token.startsWith('ring')) {
    if (token === 'ring-inset') {
      accumulator.ringInset = true;
      return;
    }
    const ringWidth = resolveRingWidthValue(token);
    if (ringWidth !== null) {
      accumulator.ringWidth = ringWidth;
      return;
    }

    const color = token === 'ring' ? null : resolveColorValue(token.slice('ring-'.length));
    if (color) {
      accumulator.ringColor = color;
    }
  }
}

function finalizeStyle(accumulator: StyleAccumulator): Record<string, string | number> {
  const boxShadows: string[] = [];
  if (accumulator.ringOffsetWidth > 0) {
    boxShadows.push(`0 0 0 ${accumulator.ringOffsetWidth}px ${accumulator.ringOffsetColor}`);
  }
  if (accumulator.ringWidth > 0) {
    const ringPrefix = accumulator.ringInset ? 'inset ' : '';
    boxShadows.push(
      `${ringPrefix}0 0 0 ${accumulator.ringOffsetWidth + accumulator.ringWidth}px ${accumulator.ringColor}`,
    );
  }
  if (accumulator.shadowValue && accumulator.shadowValue !== 'none') {
    boxShadows.push(
      accumulator.shadowColor
        ? applyShadowColor(accumulator.shadowValue, accumulator.shadowColor)
        : accumulator.shadowValue,
    );
  }
  if (accumulator.shadowValue === 'none' && boxShadows.length === 0) {
    accumulator.style.boxShadow = 'none';
  } else if (boxShadows.length > 0) {
    accumulator.style.boxShadow = boxShadows.join(', ');
  }
  return accumulator.style;
}

function buildStyleFromTokensByCategory(
  appliedTokensByCategory: Map<WorkspaceStyleCategory, string[]>,
): {
  categories: WorkspaceStyleCategory[];
  tokensByCategory: Partial<Record<WorkspaceStyleCategory, string[]>>;
  style: Record<string, string | number>;
} {
  const categories = [...appliedTokensByCategory.keys()].sort(
    (left, right) => getCategoryPriority(left) - getCategoryPriority(right),
  );

  const tokensByCategory: Partial<Record<WorkspaceStyleCategory, string[]>> = {};
  categories.forEach((category) => {
    tokensByCategory[category] = [...(appliedTokensByCategory.get(category) ?? [])];
  });

  const orderedTokens = categories.flatMap((category) => tokensByCategory[category] ?? []);
  const accumulator: StyleAccumulator = {
    style: {},
    ringWidth: 0,
    ringInset: false,
    ringColor: '#6366f1',
    ringOffsetWidth: 0,
    ringOffsetColor: '#ffffff',
  };

  orderedTokens.forEach((token) => {
    if (
      token.startsWith('w-')
      || token.startsWith('h-')
      || token.startsWith('min-w-')
      || token.startsWith('min-h-')
      || token.startsWith('max-w-')
      || token.startsWith('max-h-')
    ) {
      applySizeToken(accumulator, token);
      return;
    }
    if (
      token.startsWith('bg-')
      || token.startsWith('text-')
      || token.startsWith('font-')
      || token === 'italic'
      || token === 'not-italic'
      || token.startsWith('tracking-')
      || token.startsWith('gap-')
      || token.startsWith('select-')
      || token.startsWith('p-')
      || token.startsWith('px-')
      || token.startsWith('py-')
      || token.startsWith('pt-')
      || token.startsWith('pr-')
      || token.startsWith('pb-')
      || token.startsWith('pl-')
      || token.startsWith('m-')
      || token.startsWith('mx-')
      || token.startsWith('my-')
      || token.startsWith('mt-')
      || token.startsWith('mr-')
      || token.startsWith('mb-')
      || token.startsWith('ml-')
      || token.startsWith('border')
      || token.startsWith('rounded')
      || token.startsWith('opacity-')
    ) {
      applyBasicVisualToken(accumulator, token);
      return;
    }
    if (token.startsWith('shadow')) {
      applyShadowToken(accumulator, token);
      return;
    }
    if (token.startsWith('outline') || token.startsWith('ring')) {
      applyOutlineToken(accumulator, token);
    }
  });

  return {
    categories,
    tokensByCategory,
    style: finalizeStyle(accumulator),
  };
}

function buildPayload(input: {
  baseTokensByCategory: Map<WorkspaceStyleCategory, string[]>;
  hoverTokensByCategory: Map<WorkspaceStyleCategory, string[]>;
  focusTokensByCategory: Map<WorkspaceStyleCategory, string[]>;
  activeTokensByCategory: Map<WorkspaceStyleCategory, string[]>;
  groupHoverTokensByCategory: Map<WorkspaceStyleCategory, string[]>;
}): ResolvedStylePayload {
  const base = buildStyleFromTokensByCategory(input.baseTokensByCategory);
  const hover = buildStyleFromTokensByCategory(input.hoverTokensByCategory);
  const focus = buildStyleFromTokensByCategory(input.focusTokensByCategory);
  const active = buildStyleFromTokensByCategory(input.activeTokensByCategory);
  const groupHover = buildStyleFromTokensByCategory(input.groupHoverTokensByCategory);
  const categories = Array.from(new Set([...base.categories, ...hover.categories, ...focus.categories, ...active.categories, ...groupHover.categories])).sort(
    (left, right) => getCategoryPriority(left) - getCategoryPriority(right),
  );
  const tokensByCategory: Partial<Record<WorkspaceStyleCategory, string[]>> = {};
  categories.forEach((category) => {
    const combined = [
      ...(base.tokensByCategory[category] ?? []),
      ...(hover.tokensByCategory[category] ?? []),
      ...(focus.tokensByCategory[category] ?? []),
      ...(active.tokensByCategory[category] ?? []),
      ...(groupHover.tokensByCategory[category] ?? []),
    ];
    if (combined.length > 0) {
      tokensByCategory[category] = combined;
    }
  });

  return {
    className: categories.flatMap((category) => tokensByCategory[category] ?? []).join(' '),
    categories,
    tokensByCategory,
    style: base.style,
    ...(Object.keys(hover.style).length > 0 ? { hoverStyle: hover.style } : {}),
    ...(Object.keys(focus.style).length > 0 ? { focusStyle: focus.style } : {}),
    ...(Object.keys(active.style).length > 0 ? { activeStyle: active.style } : {}),
    ...(Object.keys(groupHover.style).length > 0 ? { groupHoverStyle: groupHover.style } : {}),
  };
}

function createUnsupportedResult(objectId: string): InterpretedStyleResult {
  return {
    objectId,
    status: 'unsupported',
    appliedCategories: [],
    appliedTokens: [],
    ignoredTokens: [],
  };
}

export function interpretWorkspaceStyle(input: {
  styleInput: WorkspaceStyleInput;
  eligibleProfile: EligibleObjectProfile;
  runtimeContext?: WorkspaceStyleRuntimeContext;
}): { result: InterpretedStyleResult; diagnostics: StylingDiagnostic[] } {
  const { styleInput, eligibleProfile } = input;
  const runtimeContext = input.runtimeContext ?? DEFAULT_RUNTIME_CONTEXT;
  const diagnostics: StylingDiagnostic[] = [];

  if (!eligibleProfile.isEligible) {
    diagnostics.push(createOutOfScopeObjectDiagnostic({
      objectId: styleInput.objectId,
      revision: styleInput.sourceRevision,
      reason: eligibleProfile.reasonIfIneligible,
    }));
    return {
      result: createUnsupportedResult(styleInput.objectId),
      diagnostics,
    };
  }

  const tokens = tokenizeClassName(styleInput.className);
  if (tokens.length === 0) {
    return {
      result: {
        objectId: styleInput.objectId,
        status: 'reset',
        appliedCategories: [],
        appliedTokens: [],
        ignoredTokens: [],
      },
      diagnostics: [],
    };
  }

  const classified = classifyTokens(tokens);
  const ignoredTokens: string[] = [];

  classified.forEach((item) => {
    if (!item.supported || !item.category) {
      ignoredTokens.push(item.token);
      if (item.category) {
        diagnostics.push(createUnsupportedTokenDiagnostic({
          objectId: styleInput.objectId,
          revision: styleInput.sourceRevision,
          category: item.category,
          token: item.token,
        }));
      } else {
        diagnostics.push(createUnsupportedCategoryDiagnostic({
          objectId: styleInput.objectId,
          revision: styleInput.sourceRevision,
          token: item.token,
        }));
      }
      return;
    }
    if (resolveInteractionLayer(item.variants) === 'group-hover' && !styleInput.groupId) {
      ignoredTokens.push(item.token);
      diagnostics.push(createUnsupportedTokenDiagnostic({
        objectId: styleInput.objectId,
        revision: styleInput.sourceRevision,
        category: item.category,
        token: item.token,
      }));
      return;
    }
    if (resolveInteractionLayer(item.variants) === 'unsupported') {
      ignoredTokens.push(item.token);
      diagnostics.push(createUnsupportedTokenDiagnostic({
        objectId: styleInput.objectId,
        revision: styleInput.sourceRevision,
        category: item.category,
        token: item.token,
      }));
      return;
    }
  });

  const acceptedTokens = classified
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => {
      if (!item.supported || !item.category) return false;
      const interactionLayer = resolveInteractionLayer(item.variants);
      if (interactionLayer === 'unsupported') return false;
      if (interactionLayer === 'group-hover' && !styleInput.groupId) return false;
      return true;
    })
    .sort((left, right) => {
      const leftCategory = left.item.category as WorkspaceStyleCategory;
      const rightCategory = right.item.category as WorkspaceStyleCategory;
      const priorityDelta = getCategoryPriority(leftCategory) - getCategoryPriority(rightCategory);
      return priorityDelta !== 0 ? priorityDelta : left.index - right.index;
    })
    .map(({ item }) => item.token);

  const payload = buildPayload({
    baseTokensByCategory: collectActiveTokensByCategory(classified, runtimeContext, 'base'),
    hoverTokensByCategory: collectActiveTokensByCategory(classified, runtimeContext, 'hover'),
    focusTokensByCategory: collectActiveTokensByCategory(classified, runtimeContext, 'focus'),
    activeTokensByCategory: collectActiveTokensByCategory(classified, runtimeContext, 'active'),
    groupHoverTokensByCategory: collectActiveTokensByCategory(classified, runtimeContext, 'group-hover'),
  });
  const hasAccepted = acceptedTokens.length > 0;
  const hasIgnored = ignoredTokens.length > 0;

  if (hasAccepted && hasIgnored) {
    diagnostics.push(createMixedInputDiagnostic({
      objectId: styleInput.objectId,
      revision: styleInput.sourceRevision,
      ignoredTokenCount: ignoredTokens.length,
    }));
  }

  const status: InterpretedStyleResult['status'] = hasAccepted
    ? (hasIgnored ? 'partial' : 'applied')
    : 'unsupported';

  return {
    result: {
      objectId: styleInput.objectId,
      status,
      appliedCategories: payload.categories,
      appliedTokens: acceptedTokens,
      ignoredTokens,
      ...(hasAccepted ? { resolvedStylePayload: payload } : {}),
    },
    diagnostics: dedupeDiagnostics(diagnostics),
  };
}
