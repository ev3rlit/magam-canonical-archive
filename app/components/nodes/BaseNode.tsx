import React, { ReactNode, useMemo, useEffect, useCallback, memo, useState } from 'react';
import { Handle, Position, useNodeId } from 'reactflow';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useBubbleActions } from '@/contexts/BubbleContext';
import { useGraphStore } from '@/store/graph';

/** Maximum length for bubble text before truncation */
const BUBBLE_MAX_LENGTH = 40;

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
    selected,
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
                const groupId = typeof node?.data?.groupId === 'string' ? node.data.groupId : null;
                if (trackGroupHover && nodeId && groupId) {
                    unregisterGroupHover(groupId, nodeId);
                }
            }}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            onMouseDown={() => setIsActive(true)}
            onMouseUp={() => setIsActive(false)}
            onMouseLeaveCapture={() => setIsActive(false)}
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
