const WASHI_PRESET_IDS_INTERNAL = [
  'pastel-dots',
  'kraft-grid',
  'masking-solid',
  'neon-stripe',
  'vintage-paper',
] as const;

export const WASHI_PRESET_IDS = WASHI_PRESET_IDS_INTERNAL;

export const [
  pasteldots,
  kraftgrid,
  maskingsolid,
  neonstripe,
  vintagepaper,
] = WASHI_PRESET_IDS;

export type PresetPatternId = (typeof WASHI_PRESET_IDS)[number];
