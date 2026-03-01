import type { MaterialPresetId, PaperMaterial } from '@/types/washiTape';
import {
  DEFAULT_STICKY_PRESET_ID,
  DEFAULT_WASHI_PRESET_ID,
  getPresetPatternCatalog,
  isPresetPatternId,
  resolvePresetPatternId,
} from './washiTapeDefaults';

export interface ResolvedWashiPattern {
  kind: 'preset' | 'solid' | 'svg' | 'image';
  presetId: MaterialPresetId;
  backgroundColor?: string;
  backgroundImage?: string;
  backgroundRepeat?: string;
  backgroundSize?: string;
  textColor?: string;
  fallbackApplied: boolean;
  debugReason?: string;
}

const MAX_INLINE_MARKUP_LENGTH = 16_384;

function encodeSvgDataUri(svg: string): string {
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

function isCssColorLike(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('#')) return true;
  if (trimmed.startsWith('rgb(') || trimmed.startsWith('rgba(')) return true;
  if (trimmed.startsWith('hsl(') || trimmed.startsWith('hsla(')) return true;
  if (trimmed.startsWith('var(')) return true;
  return /^[a-zA-Z]+$/.test(trimmed);
}

export function sanitizeInlineSvgMarkup(markup: string): string | null {
  const trimmed = markup.trim();
  if (!trimmed || trimmed.length > MAX_INLINE_MARKUP_LENGTH) return null;
  if (!trimmed.includes('<svg')) return null;

  const withoutScripts = trimmed
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
    .replace(/<foreignObject[\s\S]*?>[\s\S]*?<\/foreignObject>/gi, '');

  const strippedHandlers = withoutScripts.replace(/\s+on[a-z]+\s*=\s*(['"]).*?\1/gi, '');
  return strippedHandlers;
}

function resolvePresetStyle(
  presetId: MaterialPresetId,
  options?: { fallbackPresetId?: MaterialPresetId },
): ResolvedWashiPattern {
  const fallbackPresetId = options?.fallbackPresetId ?? DEFAULT_WASHI_PRESET_ID;
  const resolvedPresetId = resolvePresetPatternId(presetId, fallbackPresetId);
  const preset = getPresetPatternCatalog().find((item) => item.id === resolvedPresetId);
  return {
    kind: 'preset',
    presetId: resolvedPresetId,
    backgroundColor: preset?.backgroundColor,
    backgroundImage: preset?.backgroundImage,
    backgroundRepeat: preset?.backgroundImage ? 'repeat' : undefined,
    backgroundSize: preset?.backgroundSize,
    textColor: preset?.textColor,
    fallbackApplied: false,
  };
}

export function resolvePaperPattern(
  pattern: PaperMaterial | undefined,
  options?: {
    fallbackPresetId?: MaterialPresetId;
  },
): ResolvedWashiPattern {
  const fallbackPresetId = options?.fallbackPresetId ?? DEFAULT_WASHI_PRESET_ID;

  if (!pattern) {
    return resolvePresetStyle(fallbackPresetId, { fallbackPresetId });
  }

  if (pattern.type === 'preset') {
    const requestedPresetId = (pattern as { id?: unknown; name?: unknown }).id
      ?? (pattern as { id?: unknown; name?: unknown }).name;
    const resolved = resolvePresetStyle(resolvePresetPatternId(pattern, fallbackPresetId), { fallbackPresetId });
    if (
      typeof pattern.color === 'string'
      && pattern.color.trim() !== ''
      && isCssColorLike(pattern.color)
    ) {
      return {
        ...resolved,
        backgroundColor: pattern.color.trim(),
      };
    }

    if (!isPresetPatternId(requestedPresetId)) {
      return {
        ...resolved,
        fallbackApplied: true,
        debugReason: 'unknown-preset-id',
      };
    }

    return resolved;
  }

  if (pattern.type === 'solid') {
    if (typeof pattern.color === 'string' && isCssColorLike(pattern.color)) {
      return {
        kind: 'solid',
        presetId: fallbackPresetId,
        backgroundColor: pattern.color.trim(),
        fallbackApplied: false,
      };
    }
    return {
      ...resolvePresetStyle(fallbackPresetId, { fallbackPresetId }),
      fallbackApplied: true,
      debugReason: 'invalid-solid-color',
    };
  }

  if (pattern.type === 'svg') {
    if (typeof pattern.markup === 'string' && pattern.markup.trim() !== '') {
      const sanitized = sanitizeInlineSvgMarkup(pattern.markup);
      if (sanitized) {
        return {
          kind: 'svg',
          presetId: fallbackPresetId,
          backgroundImage: encodeSvgDataUri(sanitized),
          backgroundRepeat: 'repeat',
          backgroundSize: '24px 24px',
          fallbackApplied: false,
        };
      }
      return {
        ...resolvePresetStyle(fallbackPresetId, { fallbackPresetId }),
        fallbackApplied: true,
        debugReason: 'invalid-inline-svg-markup',
      };
    }

    if (typeof pattern.src === 'string' && pattern.src.trim() !== '') {
      return {
        kind: 'svg',
        presetId: fallbackPresetId,
        backgroundImage: `url("${pattern.src}")`,
        backgroundRepeat: 'repeat',
        backgroundSize: '24px 24px',
        fallbackApplied: false,
      };
    }

    return {
      ...resolvePresetStyle(fallbackPresetId, { fallbackPresetId }),
      fallbackApplied: true,
      debugReason: 'missing-svg-source',
    };
  }

  if (pattern.type === 'image') {
    if (typeof pattern.src === 'string' && pattern.src.trim() !== '') {
      const scale = typeof pattern.scale === 'number' && Number.isFinite(pattern.scale)
        ? Math.max(0.25, Math.min(pattern.scale, 4))
        : 1;

      const repeat = pattern.repeat === 'repeat-x' || pattern.repeat === 'repeat'
        ? pattern.repeat
        : 'no-repeat';

      return {
        kind: 'image',
        presetId: fallbackPresetId,
        backgroundImage: `url("${pattern.src}")`,
        backgroundRepeat: repeat,
        backgroundSize: pattern.repeat === 'stretch' ? '100% 100%' : `${Math.round(64 * scale)}px auto`,
        fallbackApplied: false,
      };
    }

    return {
      ...resolvePresetStyle(fallbackPresetId, { fallbackPresetId }),
      fallbackApplied: true,
      debugReason: 'missing-image-source',
    };
  }

  return {
    ...resolvePresetStyle(fallbackPresetId, { fallbackPresetId }),
    fallbackApplied: true,
    debugReason: 'unsupported-pattern-type',
  };
}

export function resolveWashiPattern(
  pattern: PaperMaterial | undefined,
): ResolvedWashiPattern {
  return resolvePaperPattern(pattern, { fallbackPresetId: DEFAULT_WASHI_PRESET_ID });
}

export function resolveStickyPattern(
  pattern: PaperMaterial | undefined,
): ResolvedWashiPattern {
  return resolvePaperPattern(pattern, { fallbackPresetId: DEFAULT_STICKY_PRESET_ID });
}
