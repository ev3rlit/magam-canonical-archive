import type { PresetPatternId } from './WashiTape.presets';

export interface Point {
  x: number;
  y: number;
}

export interface SegmentAt {
  type: 'segment';
  from: Point;
  to: Point;
  thickness?: number;
}

export interface PolarAt {
  type: 'polar';
  x: number;
  y: number;
  length: number;
  angle?: number;
  thickness?: number;
}

export interface AttachAt {
  type: 'attach';
  target: string;
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  span?: number;
  align?: number;
  offset?: number;
  from?: [number, number];
  to?: [number, number];
  followRotation?: boolean;
  clipToTarget?: boolean;
  thickness?: number;
}

export type AtDef = SegmentAt | PolarAt | AttachAt;

export interface PresetPatternDef {
  type: 'preset';
  id: PresetPatternId;
}

export interface SolidPatternDef {
  type: 'solid';
  color: string;
}

export interface SvgPatternDef {
  type: 'svg';
  src?: string;
  markup?: string;
}

export interface ImagePatternDef {
  type: 'image';
  src: string;
  scale?: number;
  repeat?: 'repeat-x' | 'repeat' | 'stretch';
}

export type PatternDef =
  | PresetPatternDef
  | SolidPatternDef
  | SvgPatternDef
  | ImagePatternDef;

export type EdgeDef =
  | { variant: 'smooth' }
  | { variant: 'torn'; roughness?: number };

export interface TextureDef {
  opacity?: number;
  blendMode?: 'multiply' | 'overlay' | 'normal';
}

export function segment(
  from: Point,
  to: Point,
  opts?: { thickness?: number },
): SegmentAt {
  const result: SegmentAt = {
    type: 'segment',
    from,
    to,
  };
  if (opts?.thickness !== undefined) {
    result.thickness = opts.thickness;
  }
  return result;
}

export function polar(
  x: number,
  y: number,
  length: number,
  angle?: number,
  opts?: { thickness?: number },
): PolarAt {
  const result: PolarAt = {
    type: 'polar',
    x,
    y,
    length,
  };
  if (angle !== undefined) {
    result.angle = angle;
  }
  if (opts?.thickness !== undefined) {
    result.thickness = opts.thickness;
  }
  return result;
}

export function attach(opts: Omit<AttachAt, 'type'>): AttachAt {
  return {
    type: 'attach',
    ...opts,
  };
}

export function preset(id: PresetPatternId): PresetPatternDef {
  return {
    type: 'preset',
    id,
  };
}

export function solid(color: string): SolidPatternDef {
  return {
    type: 'solid',
    color,
  };
}

export function svg(opts: { src?: string; markup?: string }): SvgPatternDef {
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
    repeat?: 'repeat-x' | 'repeat' | 'stretch';
  },
): ImagePatternDef {
  return {
    type: 'image',
    src,
    scale: opts?.scale,
    repeat: opts?.repeat,
  };
}

export function definePattern<T extends PatternDef>(def: T): T {
  return def;
}

export function smooth(): EdgeDef {
  return { variant: 'smooth' };
}

export function torn(roughness?: number): EdgeDef {
  if (roughness === undefined) {
    return { variant: 'torn' };
  }
  return { variant: 'torn', roughness };
}

export function texture(opts?: TextureDef): TextureDef {
  if (!opts) return {};
  return { ...opts };
}
