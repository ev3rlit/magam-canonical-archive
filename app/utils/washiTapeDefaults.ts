import type {
  AtDef,
  PatternDef,
  PresetPatternId,
  WashiPresetCatalogItem,
} from '@/types/washiTape';
import { WASHI_PRESET_IDS } from '@/types/washiTape';

const DEFAULT_PRESET_ID: PresetPatternId = 'pastel-dots';
const DEFAULT_LENGTH = 180;
const DEFAULT_THICKNESS = 36;
const DEFAULT_OPACITY = 0.84;

const PRESET_CATALOG: WashiPresetCatalogItem[] = [
  {
    id: 'pastel-dots',
    label: 'Pastel Dots',
    backgroundColor: '#fdf2f8',
    backgroundImage:
      'radial-gradient(circle at 10px 10px, rgba(244,114,182,0.35) 0 2px, transparent 2px)',
    textColor: '#7f1d1d',
  },
  {
    id: 'kraft-grid',
    label: 'Kraft Grid',
    backgroundColor: '#f5deb3',
    backgroundImage:
      'linear-gradient(0deg, rgba(120,53,15,0.13) 1px, transparent 1px), linear-gradient(90deg, rgba(120,53,15,0.13) 1px, transparent 1px)',
    textColor: '#78350f',
  },
  {
    id: 'masking-solid',
    label: 'Masking Solid',
    backgroundColor: '#fde68a',
    textColor: '#713f12',
  },
  {
    id: 'neon-stripe',
    label: 'Neon Stripe',
    backgroundColor: '#d9f99d',
    backgroundImage:
      'repeating-linear-gradient(-45deg, rgba(34,197,94,0.22) 0 8px, rgba(34,197,94,0.08) 8px 16px)',
    textColor: '#14532d',
  },
  {
    id: 'vintage-paper',
    label: 'Vintage Paper',
    backgroundColor: '#f8fafc',
    backgroundImage:
      'linear-gradient(135deg, rgba(100,116,139,0.08) 0%, rgba(100,116,139,0) 70%)',
    textColor: '#1e293b',
  },
];

export interface NormalizedWashiDefaults {
  pattern: PatternDef;
  at: AtDef;
  opacity: number;
  seed: string;
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

export function getPresetPatternCatalog(): WashiPresetCatalogItem[] {
  return PRESET_CATALOG;
}

export function isPresetPatternId(value: unknown): value is PresetPatternId {
  return typeof value === 'string' && (WASHI_PRESET_IDS as readonly string[]).includes(value);
}

export function resolvePresetPatternId(value: unknown): PresetPatternId {
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

  return DEFAULT_PRESET_ID;
}

function resolvePattern(input: Record<string, unknown>): PatternDef {
  const pattern = input?.pattern;
  if (!pattern || typeof pattern !== 'object') {
    return { type: 'preset', id: DEFAULT_PRESET_ID };
  }

  const type = (pattern as { type?: unknown }).type;
  if (type === 'preset') {
    return { type: 'preset', id: resolvePresetPatternId(pattern) };
  }
  if (type === 'solid') {
    const color =
      typeof (pattern as { color?: unknown }).color === 'string'
        ? (pattern as { color: string }).color
        : '#fde68a';
    return { type: 'solid', color };
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

  return { type: 'preset', id: DEFAULT_PRESET_ID };
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

function sanitizeAt(at: unknown, fallback: AtDef): AtDef {
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

  return fallback;
}

export function normalizeWashiDefaults(input: Record<string, unknown>): NormalizedWashiDefaults {
  const fallbackAt = resolveFallbackAt(input);
  const at = sanitizeAt(input?.at, fallbackAt);
  const opacity = clamp(toNumber(input?.opacity) ?? DEFAULT_OPACITY, 0, 1);
  const seedValue = input?.seed ?? input?.id ?? 'washi-default';
  const seed = String(seedValue);

  return {
    pattern: resolvePattern(input),
    at,
    opacity,
    seed,
  };
}
