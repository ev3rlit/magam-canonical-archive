import type {
  AnchorAt,
  AtDef,
  MaterialPresetId,
  PaperMaterial,
  WashiPresetCatalogItem,
} from '@/types/washiTape';
import {
  MATERIAL_PRESET_IDS,
  MATERIAL_PRESET_REGISTRY,
  kraftgrid,
  maskingsolid,
  neonstripe,
  pasteldots,
  postit,
  vintagepaper,
} from '@magam/core';

export const DEFAULT_WASHI_PRESET_ID: MaterialPresetId = pasteldots;
export const DEFAULT_STICKY_PRESET_ID: MaterialPresetId = postit;

export const WASHI_PRESET_IDS: readonly MaterialPresetId[] = [
  pasteldots,
  kraftgrid,
  maskingsolid,
  neonstripe,
  vintagepaper,
];

const DEFAULT_LENGTH = 180;
const DEFAULT_THICKNESS = 36;
const DEFAULT_OPACITY = 0.84;

export interface NormalizedWashiDefaults {
  pattern: PaperMaterial;
  at: AtDef;
  opacity: number;
  seed: string;
}

export interface NormalizedStickyDefaults {
  pattern: PaperMaterial;
  at?: AtDef;
  shape: 'rectangle' | 'heart' | 'cloud' | 'speech';
  width?: number;
  height?: number;
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
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

function buildPresetCatalog(presetIds: readonly MaterialPresetId[]): WashiPresetCatalogItem[] {
  return presetIds.map((id) => {
    const entry = MATERIAL_PRESET_REGISTRY[id] as Record<string, unknown>;
    return {
      id,
      label: entry.label as string,
      backgroundColor: entry.backgroundColor as string,
      backgroundImage: entry.backgroundImage as string | undefined,
      backgroundSize: entry.backgroundSize as string | undefined,
      textColor: entry.textColor as string,
      texture: entry.texture as WashiPresetCatalogItem['texture'],
    };
  });
}

export function getPresetPatternCatalog(
  presetIds: readonly MaterialPresetId[] = MATERIAL_PRESET_IDS,
): WashiPresetCatalogItem[] {
  return buildPresetCatalog(presetIds);
}

export function getWashiPresetPatternCatalog(): WashiPresetCatalogItem[] {
  return buildPresetCatalog(WASHI_PRESET_IDS);
}

export function isPresetPatternId(value: unknown): value is MaterialPresetId {
  return typeof value === 'string'
    && (MATERIAL_PRESET_IDS as readonly string[]).includes(value);
}

export function resolvePresetPatternId(
  value: unknown,
  defaultPresetId: MaterialPresetId = DEFAULT_WASHI_PRESET_ID,
): MaterialPresetId {
  if (isPresetPatternId(value)) return value;

  if (
    value &&
    typeof value === 'object' &&
    'type' in value &&
    (value as { type?: unknown }).type === 'preset'
  ) {
    const maybeId = (value as { id?: unknown; name?: unknown }).id
      ?? (value as { id?: unknown; name?: unknown }).name;
    if (isPresetPatternId(maybeId)) return maybeId;
  }

  return defaultPresetId;
}

export function resolveMaterialPattern(
  input: Record<string, unknown>,
  opts?: {
    defaultPresetId?: MaterialPresetId;
    legacyColor?: unknown;
  },
): PaperMaterial {
  const defaultPresetId = opts?.defaultPresetId ?? DEFAULT_WASHI_PRESET_ID;
  const pattern = input?.pattern;

  if (!pattern || typeof pattern !== 'object') {
    if (typeof opts?.legacyColor === 'string' && isCssColorLike(opts.legacyColor)) {
      return {
        type: 'solid',
        color: opts.legacyColor.trim(),
      };
    }
    return { type: 'preset', id: defaultPresetId };
  }

  const type = (pattern as { type?: unknown }).type;
  if (type === 'preset') {
    const presetValue = (pattern as { id?: unknown; name?: unknown }).id
      ?? (pattern as { id?: unknown; name?: unknown }).name;
    const result: PaperMaterial = {
      type: 'preset',
      id:
        typeof presetValue === 'string' && presetValue.trim() !== ''
          ? (presetValue as MaterialPresetId)
          : resolvePresetPatternId(pattern, defaultPresetId),
    };
    const presetColor = (pattern as { color?: unknown }).color;
    if (
      typeof presetColor === 'string'
      && presetColor.trim() !== ''
      && isCssColorLike(presetColor)
    ) {
      (result as Extract<PaperMaterial, { type: 'preset' }>).color = presetColor.trim();
    }
    return result;
  }

  if (type === 'solid') {
    const colorValue = (pattern as { color?: unknown }).color;
    const color = typeof colorValue === 'string' ? colorValue : '';
    return { type: 'solid', color: color.trim() };
  }

  if (type === 'svg') {
    const src =
      typeof (pattern as { src?: unknown }).src === 'string'
        ? (pattern as { src: string }).src
        : undefined;
    const markup =
      typeof (pattern as { markup?: unknown }).markup === 'string'
        ? (pattern as { markup: string }).markup
        : undefined;
    return { type: 'svg', src, markup };
  }

  if (type === 'image') {
    const src =
      typeof (pattern as { src?: unknown }).src === 'string'
        ? (pattern as { src: string }).src
        : '';
    return {
      type: 'image',
      src,
      scale: toNumber((pattern as { scale?: unknown }).scale) ?? 1,
      repeat:
        (pattern as { repeat?: unknown }).repeat === 'repeat-x'
        || (pattern as { repeat?: unknown }).repeat === 'repeat'
        || (pattern as { repeat?: unknown }).repeat === 'stretch'
          ? (pattern as { repeat: 'repeat-x' | 'repeat' | 'stretch' }).repeat
          : 'repeat',
    };
  }

  return { type: 'preset', id: defaultPresetId };
}

function resolveFallbackAt(input: Record<string, unknown>): AtDef {
  const x = toNumber(input?.x) ?? 0;
  const y = toNumber(input?.y) ?? 0;
  const length = Math.max(24, toNumber(input?.width) ?? DEFAULT_LENGTH);
  const thickness = Math.max(8, toNumber(input?.height) ?? DEFAULT_THICKNESS);
  return {
    type: 'polar',
    x,
    y,
    length,
    thickness,
  };
}

function normalizeLegacyAnchorAt(input: Record<string, unknown>): AnchorAt | null {
  const target = input?.anchor;
  if (typeof target !== 'string' || target.trim() === '') return null;

  const positionRaw = input?.position;
  const position = (
    positionRaw === 'top'
    || positionRaw === 'bottom'
    || positionRaw === 'left'
    || positionRaw === 'right'
    || positionRaw === 'top-left'
    || positionRaw === 'top-right'
    || positionRaw === 'bottom-left'
    || positionRaw === 'bottom-right'
  )
    ? positionRaw
    : 'bottom';

  const gap = toNumber(input?.gap);
  const alignRaw = input?.align;
  const align = (
    alignRaw === 'start'
    || alignRaw === 'center'
    || alignRaw === 'end'
  )
    ? alignRaw
    : undefined;

  return {
    type: 'anchor',
    target,
    position,
    ...(gap !== null ? { gap } : {}),
    ...(align ? { align } : {}),
  };
}

function sanitizeAt(at: unknown, fallback?: AtDef): AtDef | undefined {
  if (!at || typeof at !== 'object') return fallback;

  const type = (at as { type?: unknown }).type;
  if (type === 'segment') {
    const from = (at as { from?: { x?: unknown; y?: unknown } }).from;
    const to = (at as { to?: { x?: unknown; y?: unknown } }).to;
    if (!from || !to) return fallback;

    const fromX = toNumber(from.x);
    const fromY = toNumber(from.y);
    const toX = toNumber(to.x);
    const toY = toNumber(to.y);
    if (fromX === null || fromY === null || toX === null || toY === null) return fallback;

    return {
      type: 'segment',
      from: { x: fromX, y: fromY },
      to: { x: toX, y: toY },
      thickness: Math.max(8, toNumber((at as { thickness?: unknown }).thickness) ?? DEFAULT_THICKNESS),
    };
  }

  if (type === 'polar') {
    const x = toNumber((at as { x?: unknown }).x);
    const y = toNumber((at as { y?: unknown }).y);
    const length = toNumber((at as { length?: unknown }).length);
    if (x === null || y === null || length === null) return fallback;

    const angle = toNumber((at as { angle?: unknown }).angle);
    return {
      type: 'polar',
      x,
      y,
      length: Math.max(24, length),
      angle: angle === null ? undefined : angle,
      thickness: Math.max(8, toNumber((at as { thickness?: unknown }).thickness) ?? DEFAULT_THICKNESS),
    };
  }

  if (type === 'attach') {
    const target = (at as { target?: unknown }).target;
    if (typeof target !== 'string' || target.trim() === '') return fallback;

    const span = clamp(toNumber((at as { span?: unknown }).span) ?? 0.75, 0.1, 1);
    const align = clamp(toNumber((at as { align?: unknown }).align) ?? 0.5, 0, 1);
    return {
      type: 'attach',
      target,
      placement:
        (at as { placement?: unknown }).placement === 'top'
        || (at as { placement?: unknown }).placement === 'bottom'
        || (at as { placement?: unknown }).placement === 'left'
        || (at as { placement?: unknown }).placement === 'right'
        || (at as { placement?: unknown }).placement === 'center'
          ? (at as { placement: 'top' | 'bottom' | 'left' | 'right' | 'center' }).placement
          : 'center',
      span,
      align,
      offset: toNumber((at as { offset?: unknown }).offset) ?? 0,
      thickness: Math.max(8, toNumber((at as { thickness?: unknown }).thickness) ?? DEFAULT_THICKNESS),
      followRotation: Boolean((at as { followRotation?: unknown }).followRotation),
      clipToTarget: Boolean((at as { clipToTarget?: unknown }).clipToTarget),
      from: Array.isArray((at as { from?: unknown }).from) ? (at as { from: [number, number] }).from : undefined,
      to: Array.isArray((at as { to?: unknown }).to) ? (at as { to: [number, number] }).to : undefined,
    };
  }

  if (type === 'anchor') {
    const target = (at as { target?: unknown }).target;
    if (typeof target !== 'string' || target.trim() === '') return fallback;

    const positionRaw = (at as { position?: unknown }).position;
    const position = (
      positionRaw === 'top'
      || positionRaw === 'bottom'
      || positionRaw === 'left'
      || positionRaw === 'right'
      || positionRaw === 'top-left'
      || positionRaw === 'top-right'
      || positionRaw === 'bottom-left'
      || positionRaw === 'bottom-right'
    )
      ? positionRaw
      : 'bottom';

    const alignRaw = (at as { align?: unknown }).align;
    const align = (
      alignRaw === 'start'
      || alignRaw === 'center'
      || alignRaw === 'end'
    )
      ? alignRaw
      : 'center';

    return {
      type: 'anchor',
      target,
      position,
      gap: toNumber((at as { gap?: unknown }).gap) ?? 40,
      align,
    };
  }

  return fallback;
}

function normalizeStickyShape(input: Record<string, unknown>): 'rectangle' | 'heart' | 'cloud' | 'speech' {
  const rawShape = input?.shape ?? input?.type;
  if (rawShape === 'heart' || rawShape === 'cloud' || rawShape === 'speech') {
    return rawShape;
  }
  return 'rectangle';
}

export function normalizeWashiDefaults(input: Record<string, unknown>): NormalizedWashiDefaults {
  const fallbackAt = resolveFallbackAt(input);
  const at = sanitizeAt(input?.at, fallbackAt) ?? fallbackAt;
  const opacity = clamp(toNumber(input?.opacity) ?? DEFAULT_OPACITY, 0, 1);
  const seedValue = input?.seed ?? input?.id ?? 'washi-default';
  const seed = String(seedValue);

  return {
    pattern: resolveMaterialPattern(input, {
      defaultPresetId: DEFAULT_WASHI_PRESET_ID,
    }),
    at,
    opacity,
    seed,
  };
}

export function normalizeStickyDefaults(input: Record<string, unknown>): NormalizedStickyDefaults {
  const parsedAt = sanitizeAt(input?.at);
  const legacyAnchorAt = normalizeLegacyAnchorAt(input);
  const width = toNumber(input?.width);
  const height = toNumber(input?.height);

  return {
    pattern: resolveMaterialPattern(input, {
      defaultPresetId: DEFAULT_STICKY_PRESET_ID,
      legacyColor: input?.color,
    }),
    at: parsedAt ?? legacyAnchorAt ?? undefined,
    shape: normalizeStickyShape(input),
    ...(width !== null && width > 0 ? { width } : {}),
    ...(height !== null && height > 0 ? { height } : {}),
  };
}
