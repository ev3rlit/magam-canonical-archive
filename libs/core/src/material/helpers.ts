import type { MaterialPresetId } from './presets';
import type {
  ImageMaterialDef,
  MaterialRepeat,
  PaperMaterial,
  PresetMaterialDef,
  SolidMaterialDef,
  SvgMaterialDef,
} from './types';

export function preset(id: MaterialPresetId): PresetMaterialDef {
  return {
    type: 'preset',
    id,
  };
}

export function solid(color: string): SolidMaterialDef {
  return {
    type: 'solid',
    color,
  };
}

export function svg(opts: { src?: string; markup?: string }): SvgMaterialDef {
  return {
    type: 'svg',
    src: opts.src,
    markup: opts.markup,
  };
}

export function image(
  src: string,
  opts?: {
    scale?: number;
    repeat?: MaterialRepeat;
  },
): ImageMaterialDef {
  return {
    type: 'image',
    src,
    scale: opts?.scale,
    repeat: opts?.repeat,
  };
}

export function definePattern<T extends PaperMaterial>(def: T): T {
  return def;
}
