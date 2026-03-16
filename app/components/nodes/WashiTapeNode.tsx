import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { NodeProps } from 'reactflow';
import { BaseNode, resolveBaseNodeInlineStyle } from './BaseNode';
import { useGraphStore } from '@/store/graph';
import type { RenderableChild } from '@/utils/childComposition';
import type { WashiTapeNodeData } from '@/types/washiTape';
import { normalizeWashiDefaults } from '@/utils/washiTapeDefaults';
import { resolveWashiPattern } from '@/utils/washiTapePattern';
import { getWashiNodePosition, resolveWashiGeometry } from '@/utils/washiTapeGeometry';
import { getWashiShapeSkewAngle } from '@/utils/stickerJitter';

function getNodeText(children: RenderableChild[] | undefined): string {
  if (!Array.isArray(children) || children.length === 0) return '';

  return children
    .map((child) => {
      if (child.type === 'text') return child.text;
      if (child.type === 'graph-markdown') return child.content;
      return '';
    })
    .filter((token) => token.trim().length > 0)
    .join(' ')
    .trim();
}

export function getWashiLabel(
  children: RenderableChild[] | undefined,
  fallbackLabel: string,
): string {
  const text = getNodeText(children);
  return text || fallbackLabel;
}

type WashiTextAlign = 'start' | 'center' | 'end';

const alignMap: Record<WashiTextAlign | 'default', React.CSSProperties['textAlign']> = {
  start: 'left',
  center: 'center',
  end: 'right',
  default: 'center',
};

export function resolveWashiTapeSurfaceStyle(input: {
  baseStyle: React.CSSProperties;
  runtimePayload?: {
    style?: Record<string, string | number>;
    hoverStyle?: Record<string, string | number>;
    focusStyle?: Record<string, string | number>;
    activeStyle?: Record<string, string | number>;
    groupHoverStyle?: Record<string, string | number>;
  };
  isHovered: boolean;
  isFocused: boolean;
  isActive: boolean;
  isGroupHovered: boolean;
}): React.CSSProperties {
  return resolveBaseNodeInlineStyle({
    style: input.baseStyle,
    runtimeStyle: input.runtimePayload?.style,
    hoverStyle: input.runtimePayload?.hoverStyle,
    focusStyle: input.runtimePayload?.focusStyle,
    activeStyle: input.runtimePayload?.activeStyle,
    groupHoverStyle: input.runtimePayload?.groupHoverStyle,
    isHovered: input.isHovered,
    isFocused: input.isFocused,
    isActive: input.isActive,
    isGroupHovered: input.isGroupHovered,
  });
}

const WashiTapeNode = ({
  id,
  data,
  selected,
  xPos,
  yPos,
}: NodeProps<WashiTapeNodeData>) => {
  const nodes = useGraphStore((state) => state.nodes);
  const registerGroupHover = useGraphStore((state) => state.registerGroupHover);
  const unregisterGroupHover = useGraphStore((state) => state.unregisterGroupHover);
  const runtimePayload = useGraphStore(
    useCallback((state) => state.workspaceStyleByNodeId[id]?.resolvedStylePayload, [id]),
  );
  const isGroupHovered = useGraphStore(
    useCallback((state) => {
      const groupId = typeof data.groupId === 'string' ? data.groupId : null;
      if (!groupId) return false;
      return (state.hoveredNodeIdsByGroupId[groupId] ?? []).length > 0;
    }, [data.groupId]),
  );
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const raw = (data || {}) as WashiTapeNodeData;
  const normalized = useMemo(
    () => normalizeWashiDefaults(raw as unknown as Record<string, unknown>),
    [raw],
  );

  const geometry = useMemo(
    () =>
      resolveWashiGeometry({
        at: (raw.at as WashiTapeNodeData['at']) ?? normalized.at,
        nodes,
        seed: normalized.seed,
        fallbackPosition:
          raw.resolvedGeometry && typeof raw.resolvedGeometry === 'object'
            ? getWashiNodePosition(raw.resolvedGeometry as WashiTapeNodeData['resolvedGeometry'])
            : undefined,
      }),
    [nodes, normalized.at, normalized.seed, raw.at, raw.resolvedGeometry],
  );

  const pattern = useMemo(
    () => resolveWashiPattern(normalized.pattern),
    [normalized.pattern],
  );
  const desiredPosition = useMemo(
    () => getWashiNodePosition(geometry),
    [geometry],
  );
  const currentPosition = useMemo(
    () => ({
      x: typeof xPos === 'number' ? xPos : 0,
      y: typeof yPos === 'number' ? yPos : 0,
    }),
    [xPos, yPos],
  );
  const offsetX = desiredPosition.x - currentPosition.x;
  const offsetY = desiredPosition.y - currentPosition.y;

  const label = getWashiLabel(
    raw.children,
    (typeof raw.label === 'string') ? raw.label.trim() : '',
  );
  const hasLabel = label.length > 0;

  const length = Math.max(24, Math.round(geometry.length));
  const thickness = Math.max(10, Math.round(geometry.thickness));
  const noiseOpacity = (() => {
    const value = (raw.texture as { opacity?: unknown } | undefined)?.opacity;
    if (typeof value === 'number' && Number.isFinite(value)) {
      return Math.max(0.03, Math.min(0.3, value));
    }
    return 0.08;
  })();

  const textSize = (() => {
    const value = (raw.text as { size?: unknown } | undefined)?.size;
    if (typeof value === 'number' && Number.isFinite(value)) {
      return Math.max(10, Math.min(28, value));
    }
    return 13;
  })();

  const textColor = (() => {
    const value = (raw.text as { color?: unknown } | undefined)?.color;
    if (typeof value === 'string' && value.trim() !== '') return value;
    if (typeof pattern.textColor === 'string' && pattern.textColor.trim() !== '') {
      return pattern.textColor;
    }
    return pattern.kind === 'preset' ? '#1f2937' : '#111827';
  })();

  const textAlign = (() => {
    const value = raw.text?.align;
    if (value === 'start' || value === 'center' || value === 'end') {
      return alignMap[value];
    }
    return alignMap.default;
  })();
  const shapeSkewAngle = useMemo(
    () => getWashiShapeSkewAngle(normalized.seed),
    [normalized.seed],
  );

  const tapeStyle: React.CSSProperties = {
    width: length,
    minWidth: length,
    maxWidth: length,
    height: thickness,
    minHeight: thickness,
    opacity: normalized.opacity,
    borderRadius: 2,
    border: 'none',
    boxShadow: selected
      ? '0 0 0 2px rgba(56, 189, 248, 0.45)'
      : 'none',
    backgroundColor: pattern.backgroundColor ?? '#fde68a',
    backgroundImage: pattern.backgroundImage,
    backgroundRepeat: pattern.backgroundRepeat,
    backgroundSize: pattern.backgroundSize,
    position: 'relative',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: `0 ${Math.max(8, Math.round(thickness * 0.25))}px`,
    transform: `skewX(${shapeSkewAngle}deg)`,
    transformOrigin: 'center center',
  };
  const resolvedTapeStyle = useMemo(() => resolveWashiTapeSurfaceStyle({
    baseStyle: tapeStyle,
    runtimePayload,
    isHovered,
    isFocused,
    isActive,
    isGroupHovered,
  }), [isActive, isFocused, isGroupHovered, isHovered, runtimePayload, tapeStyle]);

  useEffect(() => {
    return () => {
      if (data.groupId) {
        unregisterGroupHover(data.groupId, id);
      }
    };
  }, [data.groupId, id, unregisterGroupHover]);

  return (
    <BaseNode
      selected={selected}
      startHandle
      endHandle
      consumeRuntimePayload={false}
      trackGroupHover={false}
      style={{
        transform:
          `translate(${offsetX}px, ${offsetY}px)` +
          (geometry.angle !== 0 ? ` rotate(${geometry.angle}deg)` : ''),
      }}
    >
      <div
        style={resolvedTapeStyle}
        data-washi-preset={pattern.presetId}
        onMouseEnter={() => {
          setIsHovered(true);
          if (data.groupId) {
            registerGroupHover(data.groupId, id);
          }
        }}
        onMouseLeave={() => {
          setIsHovered(false);
          setIsActive(false);
          if (data.groupId) {
            unregisterGroupHover(data.groupId, id);
          }
        }}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        onMouseDown={() => setIsActive(true)}
        onMouseUp={() => setIsActive(false)}
        tabIndex={runtimePayload?.focusStyle || runtimePayload?.activeStyle ? 0 : undefined}
      >
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            opacity: noiseOpacity,
            mixBlendMode:
              (raw.texture as { blendMode?: 'multiply' | 'overlay' | 'normal' } | undefined)?.blendMode ?? 'multiply',
            backgroundImage:
              'repeating-linear-gradient(-12deg, rgba(15,23,42,0.16) 0 1px, rgba(15,23,42,0.03) 1px 4px)',
          }}
        />
        {hasLabel ? (
          <span
            className="relative z-10 block leading-tight"
            style={{
              color: textColor,
              fontSize: textSize,
              textAlign,
              fontWeight: 600,
              maxWidth: '100%',
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              transform: `skewX(${-shapeSkewAngle}deg)`,
              transformOrigin: 'center center',
            }}
          >
            {label}
          </span>
        ) : null}
      </div>
    </BaseNode>
  );
};

export default memo(WashiTapeNode);
