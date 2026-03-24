import React, { memo, useCallback } from 'react';
import { NodeProps, useNodeId } from 'reactflow';
import { twMerge } from 'tailwind-merge';
import { BaseNode, NODE_EDIT_BUTTON_CLASS } from './BaseNode';
import { getInputClassName } from '@/components/ui/Input';
import type { RenderableChild } from '@/utils/childComposition';
import {
    renderNodeContent,
    resolveBodyEditSession,
    useExplicitBodyEntryAffordance,
} from './renderableContent';
import { useGraphStore } from '@/store/graph';
import type { FontFamilyPreset, FontSizeInput } from '@magam/core';
import {
    resolveFontFamilyCssValue,
} from '@/utils/fontHierarchy';
import { useZoom } from '@/contexts/ZoomContext';
import { resolveTypography } from '@/utils/sizeResolver';

interface TextNodeData {
    label: string;
    fontSize?: FontSizeInput;
    color?: string;
    fontFamily?: FontFamilyPreset;
    bold?: boolean;
    italic?: boolean;
    className?: string;
    children?: RenderableChild[];
}

const TextNode = ({ data, selected }: NodeProps<TextNodeData>) => {
    const nodeId = useNodeId();
    const { isZoomBold } = useZoom();
    const globalFontFamily = useGraphStore((state) => state.globalFontFamily);
    const canvasFontFamily = useGraphStore((state) => state.canvasFontFamily);
    const activeTextEditNodeId = useGraphStore((state) => state.activeTextEditNodeId);
    const textEditDraft = useGraphStore((state) => state.textEditDraft);
    const startTextEditSession = useGraphStore((state) => state.startTextEditSession);
    const updateTextEditDraft = useGraphStore((state) => state.updateTextEditDraft);
    const requestTextEditCommit = useGraphStore((state) => state.requestTextEditCommit);
    const requestTextEditCancel = useGraphStore((state) => state.requestTextEditCancel);
    const explicitBodyEntryEnabled = useExplicitBodyEntryAffordance();
    const resolvedFontFamily = resolveFontFamilyCssValue({
        nodeFontFamily: data.fontFamily,
        canvasFontFamily,
        globalFontFamily,
    });
    const isActiveEditor = Boolean(nodeId && selected && activeTextEditNodeId === nodeId);
    const typography = resolveTypography(data.fontSize, {
        component: 'TextNode',
        inputPath: 'fontSize',
    });
    const bodyEditSession = nodeId ? resolveBodyEditSession({
        id: nodeId,
        type: 'text',
        data,
    }) : null;
    const shouldRenderExplicitBodyEntry = (
        selected
        && !isActiveEditor
        && explicitBodyEntryEnabled
        && Boolean(bodyEditSession)
    );

    const beginEditing = useCallback(() => {
        if (!selected || !bodyEditSession) return;
        startTextEditSession(bodyEditSession);
    }, [bodyEditSession, selected, startTextEditSession]);

    const commitEditing = useCallback(() => {
        if (!nodeId) return;
        requestTextEditCommit(nodeId);
    }, [nodeId, requestTextEditCommit]);

    const cancelEditing = useCallback(() => {
        if (!nodeId) return;
        requestTextEditCancel(nodeId);
    }, [nodeId, requestTextEditCancel]);

    return (
        <BaseNode
            className={twMerge(
                "p-2 min-w-[50px] text-center select-none",
                selected && "rounded-lg bg-primary/8 shadow-[0_0_0_1px_rgb(var(--color-primary)/0.22),0_0_0_10px_rgb(var(--color-primary)/0.08)]",
            )}
            style={{ pointerEvents: 'auto' }}
        >
            {shouldRenderExplicitBodyEntry ? (
                <button
                    type="button"
                    aria-label="Edit content"
                    className={NODE_EDIT_BUTTON_CLASS}
                    onPointerDown={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                    }}
                    onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        beginEditing();
                    }}
                >
                    Edit
                </button>
            ) : null}
            {isActiveEditor ? (
                <textarea
                    autoFocus
                    value={textEditDraft}
                    onChange={(event) => updateTextEditDraft(event.currentTarget.value)}
                    onBlur={commitEditing}
                    onKeyDown={(event) => {
                        if (event.key === 'Escape') {
                            event.preventDefault();
                            cancelEditing();
                            return;
                        }
                        const isCommitShortcut = (event.metaKey || event.ctrlKey) && event.key === 'Enter';
                        if (isCommitShortcut) {
                            event.preventDefault();
                            commitEditing();
                        }
                    }}
                    placeholder="Write markdown..."
                    className={getInputClassName({
                        className: 'w-[220px] min-h-[72px]',
                        multiline: true,
                    })}
                />
            ) : (
                <div
                    className="flex items-center justify-center gap-2 whitespace-pre-wrap leading-tight pointer-events-none"
                    style={{
                        fontSize: typography.fontSizePx,
                        lineHeight: `${typography.lineHeightPx}px`,
                        color: data.color || 'rgb(var(--color-foreground) / 0.82)',
                        fontWeight: (isZoomBold || data.bold) ? 'bold' : 'normal',
                        fontStyle: data.italic ? 'italic' : 'normal',
                        fontFamily: resolvedFontFamily,
                    }}
                >
                    {renderNodeContent({
                        children: data.children,
                        fallbackLabel: data.label || 'Text',
                        iconClassName: 'w-4 h-4 shrink-0',
                        textClassName: 'whitespace-pre-wrap leading-tight',
                    })}
                </div>
            )}
        </BaseNode>
    );
};

export default memo(TextNode);
