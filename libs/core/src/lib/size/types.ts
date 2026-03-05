export interface SizeTokenRegistry {
  xs: true;
  s: true;
  m: true;
  l: true;
  xl: true;
}

export type SizeToken = keyof SizeTokenRegistry & string;
export type SizeRatio = 'landscape' | 'portrait' | 'square';
export type SizeCategory = 'typography' | 'space' | 'object2d';
export type SizeValue = number | SizeToken;
export type Object2DSizeToken = SizeToken | 'auto';
export type Object2DSizeValue = number | Object2DSizeToken;

export type FontSizeInput = SizeValue;

export type ObjectSizeInput =
  | Object2DSizeToken
  | number
  | { token: Object2DSizeToken; ratio?: SizeRatio }
  | { widthHeight: Object2DSizeValue }
  | { width: SizeValue; height: SizeValue };

export type MarkdownSizeInput =
  | SizeValue
  | { token: Object2DSizeToken; ratio?: SizeRatio }
  | { widthHeight: Object2DSizeValue }
  | { width: SizeValue; height: SizeValue };

export interface TypographyScaleEntry {
  fontSizePx: number;
  lineHeightPx: number;
}

export interface Object2DScaleEntry {
  landscape: {
    widthPx: number;
    heightPx: number;
  };
  square: {
    widthPx: number;
    heightPx: number;
  };
}

export type NormalizedObjectSizeMode = 'auto' | 'token' | 'uniform' | 'explicit';

export interface NormalizedObjectSizeInput {
  mode: NormalizedObjectSizeMode;
  ratio: SizeRatio;
  token: Object2DSizeToken | null;
  primitive: Object2DSizeValue | null;
  width: SizeValue | null;
  height: SizeValue | null;
  source: string;
}

export interface ResolvedTypography {
  fontSizePx: number;
  lineHeightPx: number;
  tokenUsed?: SizeToken;
}

export type ResolvedObject2D =
  | {
    mode: 'auto';
    ratioUsed: SizeRatio;
    tokenUsed: 'auto';
  }
  | {
    mode: 'fixed';
    widthPx: number;
    heightPx: number;
    ratioUsed: SizeRatio;
    tokenUsed?: SizeToken;
  };

export type ResolvedMarkdownSize =
  | { mode: 'typography'; typography: ResolvedTypography }
  | { mode: 'object2d'; object2d: ResolvedObject2D };
