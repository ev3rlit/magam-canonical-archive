import type { MATERIAL_PRESET_REGISTRY, MaterialPresetId } from './presets';

export type { MaterialPresetId } from './presets';

export type MaterialRepeat = 'repeat-x' | 'repeat' | 'stretch';

export interface MaterialPresetMeta {
  label: string;
  backgroundColor: string;
  backgroundImage?: string;
  textColor: string;
}

export type MaterialPresetRegistry = typeof MATERIAL_PRESET_REGISTRY;

export interface PresetMaterialDef {
  type: 'preset';
  id: MaterialPresetId;
}

export interface SolidMaterialDef {
  type: 'solid';
  color: string;
}

export interface SvgMaterialDef {
  type: 'svg';
  src?: string;
  markup?: string;
}

export interface ImageMaterialDef {
  type: 'image';
  src: string;
  scale?: number;
  repeat?: MaterialRepeat;
}

export type PaperMaterial =
  | PresetMaterialDef
  | SolidMaterialDef
  | SvgMaterialDef
  | ImageMaterialDef;
