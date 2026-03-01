const MATERIAL_PRESET_IDS_INTERNAL = [
  'pastel-dots',
  'kraft-grid',
  'masking-solid',
  'neon-stripe',
  'vintage-paper',
] as const;

export const MATERIAL_PRESET_IDS = MATERIAL_PRESET_IDS_INTERNAL;

export type MaterialPresetId = (typeof MATERIAL_PRESET_IDS)[number];

export const [
  pasteldots,
  kraftgrid,
  maskingsolid,
  neonstripe,
  vintagepaper,
] = MATERIAL_PRESET_IDS;

export const MATERIAL_PRESET_REGISTRY = {
  [pasteldots]: {
    label: 'Pastel Dots',
    backgroundColor: '#fdf2f8',
    backgroundImage:
      'radial-gradient(circle at 10px 10px, rgba(244,114,182,0.35) 0 2px, transparent 2px)',
    textColor: '#7f1d1d',
  },
  [kraftgrid]: {
    label: 'Kraft Grid',
    backgroundColor: '#f5deb3',
    backgroundImage:
      'linear-gradient(0deg, rgba(120,53,15,0.13) 1px, transparent 1px), linear-gradient(90deg, rgba(120,53,15,0.13) 1px, transparent 1px)',
    textColor: '#78350f',
  },
  [maskingsolid]: {
    label: 'Masking Solid',
    backgroundColor: '#fde68a',
    backgroundImage: undefined,
    textColor: '#713f12',
  },
  [neonstripe]: {
    label: 'Neon Stripe',
    backgroundColor: '#d9f99d',
    backgroundImage:
      'repeating-linear-gradient(-45deg, rgba(34,197,94,0.22) 0 8px, rgba(34,197,94,0.08) 8px 16px)',
    textColor: '#14532d',
  },
  [vintagepaper]: {
    label: 'Vintage Paper',
    backgroundColor: '#f8fafc',
    backgroundImage:
      'linear-gradient(135deg, rgba(100,116,139,0.08) 0%, rgba(100,116,139,0) 70%)',
    textColor: '#1e293b',
  },
} as const;
