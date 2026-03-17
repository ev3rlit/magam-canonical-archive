import React, { ReactNode, useMemo, useEffect, useCallback, memo, useState } from 'react';
import { Handle, Position, useNodeId } from 'reactflow';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useBubbleActions } from '@/contexts/BubbleContext';
import { useGraphStore } from '@/store/graph';
import { resolvePaperPattern } from '@/utils/washiTapePattern';
import type {
    MaterialPresetId,
    PaperMaterial,
    PaperTextureParams,
} from '@/types/washiTape';

/** Maximum length for bubble text before truncation */
const BUBBLE_MAX_LENGTH = 40;
const NOISE_SVG = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.4'/%3E%3C/svg%3E")`;

type StickyLikeShape = 'rectangle' | 'heart' | 'cloud' | 'speech';

interface PaperTextureResult {
    backgroundImage?: string;
    backgroundSize?: string;
    boxShadow: string;
}

export interface PaperSurfaceState {
    surfaceStyle: React.CSSProperties;
    noiseOpacity: number;
    textColor?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeTextureInput(
    texture: unknown,
): PaperTextureParams | undefined {
    if (!isRecord(texture)) {
        return undefined;
    }

    if (isRecord(texture.texture)) {
        return texture.texture as PaperTextureParams;
    }

    return texture as PaperTextureParams;
}

function buildPaperTextureStyle(
    texture: PaperTextureParams | undefined,
    baseBackgroundImage: string | undefined,
    baseBackgroundSize: string | undefined,
    selected: boolean,
): PaperTextureResult {
    if (!texture) {
        return {
            boxShadow: selected
                ? '0 0 0 2px rgba(56, 189, 248, 0.45), 0 10px 24px rgba(15, 23, 42, 0.2)'
                : '0 8px 20px rgba(15, 23, 42, 0.16)',
        };
    }

    const {
        glossOpacity = 0,
        insetShadowOpacity = 0,
        shadowWarmth = 0,
    } = texture;

    const glossLayer = glossOpacity > 0
        ? `linear-gradient(180deg, rgba(255,255,255,${glossOpacity}), transparent 30%)`
        : null;

    let backgroundImage: string | undefined;
    let backgroundSize: string | undefined;
    if (glossLayer) {
        backgroundImage = baseBackgroundImage
            ? `${glossLayer}, ${baseBackgroundImage}`
            : glossLayer;
        backgroundSize = baseBackgroundSize
            ? `100% 100%, ${baseBackgroundSize}`
            : '100% 100%';
    }

    const r = Math.round(15 + ((90 - 15) * shadowWarmth));
    const g = Math.round(23 + ((62 - 23) * shadowWarmth));
    const b = Math.round(42 + ((40 - 42) * shadowWarmth));

    const insetPart = insetShadowOpacity > 0
        ? `inset 0 -2px 4px rgba(0,0,0,${insetShadowOpacity})`
        : null;

    const outerShadow = selected
        ? `0 0 0 2px rgba(56, 189, 248, 0.45), 0 10px 24px rgba(${r},${g},${b},0.2)`
        : `0 8px 20px rgba(${r},${g},${b},0.16)`;

    const boxShadow = insetPart ? `${outerShadow}, ${insetPart}` : outerShadow;

    return {
        ...(backgroundImage ? { backgroundImage, backgroundSize } : {}),
        boxShadow,
    };
}

export function resolvePaperSurface(input: {
    pattern?: PaperMaterial;
    texture?: unknown;
    selected?: boolean;
    fallbackPresetId: MaterialPresetId;
    applyFallbackSurface?: boolean;
}): PaperSurfaceState {
    const hasPattern = input.pattern !== undefined;
    const resolvedPattern = hasPattern || input.applyFallbackSurface
        ? resolvePaperPattern(input.pattern, { fallbackPresetId: input.fallbackPresetId })
        : null;
    const resolvedTexture = {
        ...(resolvedPattern?.texture ?? {}),
        ...(normalizeTextureInput(input.texture) ?? {}),
    };
    const textureStyle = buildPaperTextureStyle(
        Object.keys(resolvedTexture).length > 0 ? resolvedTexture : undefined,
        resolvedPattern?.backgroundImage,
        resolvedPattern?.backgroundSize,
        Boolean(input.selected),
    );

    return {
        surfaceStyle: {
            ...(resolvedPattern?.backgroundColor ? { backgroundColor: resolvedPattern.backgroundColor } : {}),
            ...(resolvedPattern?.backgroundImage ? { backgroundImage: resolvedPattern.backgroundImage } : {}),
            ...(resolvedPattern?.backgroundRepeat ? { backgroundRepeat: resolvedPattern.backgroundRepeat } : {}),
            ...(resolvedPattern?.backgroundSize ? { backgroundSize: resolvedPattern.backgroundSize } : {}),
            ...textureStyle,
        },
        noiseOpacity: resolvedTexture.noiseOpacity ?? 0,
        textColor: resolvedPattern?.textColor,
    };
}

export function resolveStickyLikeShapeStyle(shape: StickyLikeShape): React.CSSProperties {
    const getMaskStyle = (svgContent: string): React.CSSProperties => {
        const encoded = `url("data:image/svg+xml;utf8,${encodeURIComponent(svgContent)}")`;
        return {
            WebkitMaskImage: encoded,
            WebkitMaskSize: '100% 100%',
            WebkitMaskRepeat: 'no-repeat',
            WebkitMaskPosition: 'center',
            maskImage: encoded,
            maskSize: '100% 100%',
            maskRepeat: 'no-repeat',
            maskPosition: 'center',
            borderRadius: 0,
        };
    };

    if (shape === 'heart') {
        return getMaskStyle(`
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M50 95 C 20 70 0 45 0 25 C 0 10 12 0 25 0 C 37 0 45 10 50 18 C 55 10 63 0 75 0 C 88 0 100 10 100 25 C 100 45 80 70 50 95 Z" />
      </svg>
    `);
    }
    if (shape === 'cloud') {
        return getMaskStyle(`
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M25 90 c-13.8 0-25-11.2-25-25 c0-11.8 8.1-21.7 19.2-24.3 C22 25 33.7 12 48 12 c16 0 29.3 11.4 32.5 26.5 C92 40 100 49.8 100 61.5 c0 13-10.5 23.5-23.5 23.5 H25 z" />
      </svg>
    `);
    }
    if (shape === 'speech') {
        return getMaskStyle(`
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M5 10 C5 0 15 0 15 0 L85 0 C95 0 95 10 95 10 L95 70 C95 80 85 80 85 80 L40 80 L15 100 L20 80 L15 80 C5 80 5 70 5 70 Z" />
      </svg>
    `);
    }
    return {
        borderRadius: 6,
    };
}

export function NoiseOverlay({ opacity }: { opacity: number }) {
    if (opacity <= 0) return null;
    return (
        <div
            style={{
                position: 'absolute',
                inset: 0,
                borderRadius: 'inherit',
                background: NOISE_SVG,
                backgroundSize: '256px 256px',
                opacity,
                mixBlendMode: 'multiply',
                pointerEvents: 'none',
            }}
        />
    );
}

/**
 * Extract first line from text, removing markdown syntax.
 */
function extractFirstLine(text: string): string {
    const lines = text.split('\n').filter(line => line.trim());
    const firstLine = lines[0] || '';

    // Clean markdown syntax
    return firstLine
        .replace(/^#+\s*/, '')      // Remove heading markers
        .replace(/\*\*|__/g, '')    // Remove bold
        .replace(/\*|_/g, '')       // Remove italic
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Extract link text
        .replace(/```[\s\S]*?```/g, '') // Remove code blocks
        .trim();
}

interface BaseNodeProps {
    children: ReactNode;
    className?: string;
    handleColor?: string;
    selected?: boolean;
    startHandle?: boolean;
    endHandle?: boolean;
    /** 
     * Enable bubble overlay when zoomed out.
     * Text is auto-extracted from `label` prop.
     */
    bubble?: boolean;
    /**
     * Label text used for bubble display.
     * First line is extracted and shown when bubble=true and zoomed out.
    */
    label?: string;
    style?: React.CSSProperties;
    onDoubleClick?: React.MouseEventHandler<HTMLDivElement>;
    consumeRuntimePayload?: boolean;
    trackGroupHover?: boolean;
}

export function resolveBaseNodeInlineStyle(input: {
    style?: React.CSSProperties;
    runtimeStyle?: Record<string, string | number>;
    hoverStyle?: Record<string, string | number>;
    focusStyle?: Record<string, string | number>;
    activeStyle?: Record<string, string | number>;
    groupHoverStyle?: Record<string, string | number>;
    isHovered: boolean;
    isFocused: boolean;
    isActive: boolean;
    isGroupHovered: boolean;
}): React.CSSProperties {
    return {
        ...(input.style || {}),
        ...(input.runtimeStyle || {}),
        ...(input.isHovered ? (input.hoverStyle || {}) : {}),
        ...(input.isFocused ? (input.focusStyle || {}) : {}),
        ...(input.isActive ? (input.activeStyle || {}) : {}),
        ...(input.isGroupHovered ? (input.groupHoverStyle || {}) : {}),
    };
}

export const BaseNodeComponent = ({
    children,
    className,
    handleColor,
    selected: _selected,
    startHandle = true,
    endHandle = true,
    bubble = false,
    label,
    style,
    onDoubleClick,
    consumeRuntimePayload = true,
    trackGroupHover = true,
}: BaseNodeProps) => {
    const { registerBubble, unregisterBubble } = useBubbleActions();
    const nodeId = useNodeId();
    const [isHovered, setIsHovered] = useState(false);
    const [isFocused, setIsFocused] = useState(false);
    const [isActive, setIsActive] = useState(false);
    // Optimization: Only subscribe to this specific node's data
    // This prevents re-renders when other nodes are updated (e.g. selection drag)
    const node = useGraphStore(
        useCallback((state) => state.nodes.find((n) => n.id === nodeId), [nodeId])
    );
    const runtimePayload = useGraphStore(
        useCallback((state) => {
            if (!nodeId || !consumeRuntimePayload) return undefined;
            return state.workspaceStyleByNodeId[nodeId]?.resolvedStylePayload;
        }, [consumeRuntimePayload, nodeId]),
    );
    const registerGroupHover = useGraphStore((state) => state.registerGroupHover);
    const unregisterGroupHover = useGraphStore((state) => state.unregisterGroupHover);
    const isGroupHovered = useGraphStore(
        useCallback((state) => {
            const groupId = typeof node?.data?.groupId === 'string' ? node.data.groupId : null;
            if (!groupId) return false;
            return (state.hoveredNodeIdsByGroupId[groupId] ?? []).length > 0;
        }, [node]),
    );
    const resolvedInlineStyle = useMemo(() => resolveBaseNodeInlineStyle({
        style,
        runtimeStyle: runtimePayload?.style,
        hoverStyle: runtimePayload?.hoverStyle,
        focusStyle: runtimePayload?.focusStyle,
        activeStyle: runtimePayload?.activeStyle,
        groupHoverStyle: runtimePayload?.groupHoverStyle,
        isHovered,
        isFocused,
        isActive,
        isGroupHovered,
    }), [isActive, isFocused, isGroupHovered, isHovered, runtimePayload?.activeStyle, runtimePayload?.focusStyle, runtimePayload?.groupHoverStyle, runtimePayload?.hoverStyle, runtimePayload?.style, style]);

    const handleClasses = clsx(
        '!w-3 !h-3 !border-0 transition-opacity duration-200',
        '!bg-transparent !opacity-0',
        handleColor && `!bg-[${handleColor}]`
    );

    // Extract and truncate bubble text
    const bubbleText = useMemo(() => {
        if (!label) return '';
        const text = extractFirstLine(label);
        if (text.length > BUBBLE_MAX_LENGTH) {
            return text.slice(0, BUBBLE_MAX_LENGTH) + '...';
        }
        return text;
    }, [label]);

    // Register bubble to overlay layer (not rendered here)
    useEffect(() => {
        if (!bubble || !nodeId || !bubbleText) return;

        // Node is already verified by selector, but check existence
        if (!node) return;

        // Get center position of node
        const x = (node.position?.x ?? 0) + (node.width ?? 0) / 2;
        const y = (node.position?.y ?? 0) + (node.height ?? 0) / 2;

        registerBubble({
            nodeId,
            text: bubbleText,
            x,
            y,
        });

        return () => {
            unregisterBubble(nodeId);
        };
    }, [bubble, nodeId, bubbleText, node, registerBubble, unregisterBubble]);

    useEffect(() => {
        return () => {
            const groupId = typeof node?.data?.groupId === 'string' ? node.data.groupId : null;
            if (trackGroupHover && nodeId && groupId) {
                unregisterGroupHover(groupId, nodeId);
            }
        };
    }, [node, nodeId, trackGroupHover, unregisterGroupHover]);

    // Bubble is now rendered in BubbleOverlay, not here

    return (
        <div
            className={twMerge("relative group", className)}
            style={resolvedInlineStyle}
            onDoubleClick={onDoubleClick}
            onMouseEnter={() => {
                setIsHovered(true);
                const groupId = typeof node?.data?.groupId === 'string' ? node.data.groupId : null;
                if (trackGroupHover && nodeId && groupId) {
                    registerGroupHover(groupId, nodeId);
                }
            }}
            onMouseLeave={() => {
                setIsHovered(false);
                setIsActive(false);
                const groupId = typeof node?.data?.groupId === 'string' ? node.data.groupId : null;
                if (trackGroupHover && nodeId && groupId) {
                    unregisterGroupHover(groupId, nodeId);
                }
            }}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            onMouseDown={() => setIsActive(true)}
            onMouseUp={() => setIsActive(false)}
            tabIndex={runtimePayload?.focusStyle || runtimePayload?.activeStyle ? 0 : undefined}
        >
            {/* Target handle */}
            {endHandle && (
                <Handle
                    type="target"
                    position={Position.Left}
                    id="center-target"
                    className={handleClasses}
                    style={{ opacity: 0 }}
                />
            )}

            {/* Original node content - always rendered */}
            {/* Bubble is now rendered in BubbleOverlay component */}
            {children}

            {/* Source handle */}
            {startHandle && (
                <Handle
                    type="source"
                    position={Position.Right}
                    id="center-source"
                    className={handleClasses}
                    style={{ opacity: 0 }}
                />
            )}
        </div>
    );
};

export const BaseNode = memo(BaseNodeComponent);
