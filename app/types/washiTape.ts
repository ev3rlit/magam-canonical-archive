import type { RenderableChild } from '@/utils/childComposition';
import type {
  MaterialPresetMeta as CoreMaterialPresetMeta,
  MaterialPresetId as CoreMaterialPresetId,
  PaperMaterial as CorePaperMaterial,
  PaperTextureParams as CorePaperTextureParams,
} from '@magam/core';

export { MATERIAL_PRESET_IDS } from '@magam/core';
export type MaterialPresetId = CoreMaterialPresetId;
export type PaperMaterial = CorePaperMaterial;
export type MaterialPresetMeta = CoreMaterialPresetMeta;
export type PaperTextureParams = CorePaperTextureParams;

export interface SegmentAt {
  type: 'segment';
  from: { x: number; y: number };
  to: { x: number; y: number };
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

export type AnchorPosition =
  | 'top'
  | 'bottom'
  | 'left'
  | 'right'
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right';

export interface AnchorAt {
  type: 'anchor';
  target: string;
  position?: AnchorPosition;
  gap?: number;
  align?: 'start' | 'center' | 'end';
}

export type AtDef = SegmentAt | PolarAt | AttachAt | AnchorAt;

export interface ResolvedGeometry {
  from: { x: number; y: number };
  to: { x: number; y: number };
  thickness: number;
  angle: number;
  length: number;
  mode: 'segment' | 'polar' | 'attach';
  targetSnapshot?: {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface WashiTextDef {
  align?: 'start' | 'center' | 'end';
  color?: string;
  size?: number;
}

export interface WashiEdgeDef {
  roughness?: number;
  torn?: boolean;
}

export interface WashiTextureDef {
  opacity?: number;
  blendMode?: 'multiply' | 'overlay' | 'normal';
}

export interface WashiSourceMeta {
  sourceId: string;
  kind: 'canvas' | 'mindmap';
  scopeId?: string;
}

export interface WashiTapeNodeData {
  label?: string;
  className?: string;
  pattern?: PaperMaterial;
  edge?: WashiEdgeDef;
  texture?: WashiTextureDef;
  text?: WashiTextDef;
  at: AtDef;
  resolvedGeometry: ResolvedGeometry;
  seed?: string | number;
  opacity?: number;
  groupId?: string;
  children?: RenderableChild[];
  sourceMeta?: WashiSourceMeta;
}

export interface WashiPresetCatalogItem {
  id: MaterialPresetId;
  label: string;
  backgroundColor: string;
  backgroundImage?: string;
  backgroundSize?: string;
  textColor: string;
  texture?: PaperTextureParams;
}
