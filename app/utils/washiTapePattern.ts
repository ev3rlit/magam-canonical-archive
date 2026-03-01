import type { MaterialPresetId, PaperMaterial } from '@/types/washiTape';
import { getPresetPatternCatalog, resolvePresetPatternId } from './washiTapeDefaults';

export interface ResolvedWashiPattern {
  kind: 'preset' | 'solid' | 'svg' | 'image';
  presetId: MaterialPresetId;
  backgroundColor?: string;
  backgroundImage?: string;
  backgroundRepeat?: string;
  backgroundSize?: string;
  fallbackApplied: boolean;
  debugReason?: string;
}

const MAX_INLINE_MARKUP_LENGTH = 16_384;

function encodeSvgDataUri(svg: string): string {
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
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

function resolvePresetStyle(presetId: MaterialPresetId): ResolvedWashiPattern {
  const preset = getPresetPatternCatalog().find((item) => item.id === presetId);
  return {
    kind: 'preset',
    presetId,
    backgroundColor: preset?.backgroundColor,
    backgroundImage: preset?.backgroundImage,
    backgroundRepeat: preset?.backgroundImage ? 'repeat' : undefined,
    backgroundSize: preset?.backgroundImage ? '20px 20px' : undefined,
    fallbackApplied: false,
  };
}

export function resolveWashiPattern(
  pattern: PaperMaterial | undefined,
): ResolvedWashiPattern {
  const fallbackPresetId = resolvePresetPatternId(undefined);

  if (!pattern) {
    return resolvePresetStyle(fallbackPresetId);
  }

  if (pattern.type === 'preset') {
    return resolvePresetStyle(resolvePresetPatternId(pattern));
  }

  if (pattern.type === 'solid') {
    if (typeof pattern.color === 'string' && pattern.color.trim() !== '') {
      return {
        kind: 'solid',
        presetId: fallbackPresetId,
        backgroundColor: pattern.color,
        fallbackApplied: false,
      };
    }
    return {
      ...resolvePresetStyle(fallbackPresetId),
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
        ...resolvePresetStyle(fallbackPresetId),
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
      ...resolvePresetStyle(fallbackPresetId),
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
      ...resolvePresetStyle(fallbackPresetId),
      fallbackApplied: true,
      debugReason: 'missing-image-source',
    };
  }

  return {
    ...resolvePresetStyle(fallbackPresetId),
    fallbackApplied: true,
    debugReason: 'unsupported-pattern-type',
  };
}
