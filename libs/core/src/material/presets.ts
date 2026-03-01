export const postit = 'postit';
export const pasteldots = 'pastel-dots';
export const kraftgrid = 'kraft-grid';
export const maskingsolid = 'masking-solid';
export const neonstripe = 'neon-stripe';
export const vintagepaper = 'vintage-paper';
export const linedwarm = 'lined-warm';
export const gridstandard = 'grid-standard';
export const gridfine = 'grid-fine';
export const dotgrid = 'dot-grid';
export const kraftnatural = 'kraft-natural';

const MATERIAL_PRESET_IDS_INTERNAL = [
  postit,
  pasteldots,
  kraftgrid,
  maskingsolid,
  neonstripe,
  vintagepaper,
  linedwarm,
  gridstandard,
  gridfine,
  dotgrid,
  kraftnatural,
] as const;

export const MATERIAL_PRESET_IDS = MATERIAL_PRESET_IDS_INTERNAL;

export type MaterialPresetId = (typeof MATERIAL_PRESET_IDS)[number];

export const MATERIAL_PRESET_REGISTRY = {
  [postit]: {
    label: 'Post-it',
    backgroundColor: '#fce588',
    backgroundImage:
      'linear-gradient(135deg, rgba(255,255,255,0.42) 0%, rgba(255,255,255,0.14) 34%, rgba(255,232,146,0.9) 100%), linear-gradient(180deg, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0) 18%)',
    backgroundSize: '100% 100%',
    textColor: '#5a3e28',
  },
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
  [linedwarm]: {
    label: 'Lined Warm',
    backgroundColor: '#fefcf7',
    backgroundImage:
      'linear-gradient(transparent 27px, rgba(220,208,192,0.95) 28px)',
    backgroundSize: '100% 28px',
    textColor: '#5a3e28',
  },
  [gridstandard]: {
    label: 'Grid Standard',
    backgroundColor: '#fefcf7',
    backgroundImage:
      'linear-gradient(rgba(180,170,155,0.22) 1px, transparent 1px), linear-gradient(90deg, rgba(180,170,155,0.22) 1px, transparent 1px)',
    backgroundSize: '20px 20px',
    textColor: '#5a3e28',
  },
  [gridfine]: {
    label: 'Grid Fine',
    backgroundColor: '#fefcf7',
    backgroundImage:
      'linear-gradient(rgba(180,170,155,0.18) 1px, transparent 1px), linear-gradient(90deg, rgba(180,170,155,0.18) 1px, transparent 1px)',
    backgroundSize: '10px 10px',
    textColor: '#5a3e28',
  },
  [dotgrid]: {
    label: 'Dot Grid',
    backgroundColor: '#fefcf7',
    backgroundImage:
      'radial-gradient(circle 1px at 1px 1px, rgba(160,150,135,0.45) 1px, transparent 1px)',
    backgroundSize: '20px 20px',
    textColor: '#5a3e28',
  },
  [kraftnatural]: {
    label: 'Kraft Natural',
    backgroundColor: '#e8d5a8',
    backgroundImage:
      'linear-gradient(145deg, #e8d5a8 0%, #dcc590 40%, #e8d5a8 70%, #d8c088 100%)',
    textColor: '#5a3e28',
  },
} as const;
