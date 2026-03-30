import type { EditorFillPreset, EditorOutlinePreset, EditorShapeVariant } from './editor-types';

export const FILL_PRESET_ORDER: EditorFillPreset[] = [
  'iris',
  'sky',
  'mint',
  'amber',
  'blush',
  'slate',
  'peach',
  'sage',
  'lavender',
  'sand',
];

export const FILL_PRESET_LABELS: Record<EditorFillPreset, string> = {
  iris: 'Iris',
  sky: 'Sky',
  mint: 'Mint',
  amber: 'Amber',
  blush: 'Blush',
  slate: 'Slate',
  peach: 'Peach',
  sage: 'Sage',
  lavender: 'Lavender',
  sand: 'Sand',
};

export const FILL_PRESET_TOKENS: Record<EditorFillPreset, { fill: string; text: string; border: string }> = {
  iris: {
    fill: '#ecebff',
    text: '#231d74',
    border: '#5851ff',
  },
  sky: {
    fill: '#eaf6ff',
    text: '#19415c',
    border: '#4f8eca',
  },
  mint: {
    fill: '#e6f7ee',
    text: '#1e5141',
    border: '#357a67',
  },
  amber: {
    fill: '#ffe95a',
    text: '#5d4710',
    border: '#c49a1b',
  },
  blush: {
    fill: '#ffe6ee',
    text: '#6f3550',
    border: '#d1628e',
  },
  slate: {
    fill: '#f3f5fb',
    text: '#26314b',
    border: '#586e9b',
  },
  peach: {
    fill: '#ffe8de',
    text: '#6f3f2f',
    border: '#d98d6a',
  },
  sage: {
    fill: '#e8f1df',
    text: '#36503b',
    border: '#6d8a60',
  },
  lavender: {
    fill: '#f2eaff',
    text: '#4a3d73',
    border: '#8d78c9',
  },
  sand: {
    fill: '#f4ecdc',
    text: '#5b4730',
    border: '#b59558',
  },
};

export const OUTLINE_PRESET_LABELS: Record<EditorOutlinePreset, string> = {
  none: '없음',
  thin: '얇게',
  medium: '보통',
  dashed: '점선',
};

export const OUTLINE_PRESET_TOKENS: Record<EditorOutlinePreset, { width: string; style: 'solid' | 'dashed' }> = {
  none: { width: '0px', style: 'solid' },
  thin: { width: '1px', style: 'solid' },
  medium: { width: '2px', style: 'solid' },
  dashed: { width: '2px', style: 'dashed' },
};

export const SHAPE_VARIANT_OPTIONS: Array<{ value: EditorShapeVariant; label: string }> = [
  { value: 'rectangle', label: '사각형' },
  { value: 'rounded', label: '둥근 사각형' },
  { value: 'pill', label: '캡슐' },
  { value: 'diamond', label: '다이아몬드' },
];

function normalizeHex(input: string) {
  const value = input.trim();
  if (!/^#?[0-9a-fA-F]{6}$/.test(value)) {
    return null;
  }
  return value.startsWith('#') ? value.toLowerCase() : `#${value.toLowerCase()}`;
}

export function resolveFillColor(fillPreset: EditorFillPreset) {
  return FILL_PRESET_TOKENS[fillPreset].fill;
}

export function resolveOutlineColor(fillPreset: EditorFillPreset) {
  return FILL_PRESET_TOKENS[fillPreset].border;
}

export function parseColorInput(input: string, fallback: string) {
  return normalizeHex(input) ?? fallback;
}

function hexToRgb(color: string) {
  const normalized = normalizeHex(color);
  if (!normalized) {
    return null;
  }

  return {
    r: Number.parseInt(normalized.slice(1, 3), 16),
    g: Number.parseInt(normalized.slice(3, 5), 16),
    b: Number.parseInt(normalized.slice(5, 7), 16),
  };
}

export function resolveReadableTextColor(fillColor: string, fallbackPreset: EditorFillPreset) {
  const rgb = hexToRgb(fillColor);
  if (!rgb) {
    return FILL_PRESET_TOKENS[fallbackPreset].text;
  }

  const luminance = (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255;
  return luminance < 0.56 ? '#f7f8fd' : '#1d2438';
}
