import React, { memo, useCallback } from 'react';
import { NodeProps, useNodeId } from 'reactflow';
import { twMerge } from 'tailwind-merge';
import { BaseNode } from './BaseNode';
import type { RenderableChild } from '@/utils/childComposition';
import {
    renderNodeContent,
    resolveBodyEditSession,
    useExplicitBodyEntryAffordance,
} from './renderableContent';
import { useGraphStore } from '@/store/graph';
import type { FontFamilyPreset, FontSizeInput } from '@magam/core';
import {
    hasExplicitFontFamilyClass,
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
    const shouldApplyHierarchy = !hasExplicitFontFamilyClass(data.className);
    const resolvedFontFamily = shouldApplyHierarchy
        ? resolveFontFamilyCssValue({
            nodeFontFamily: data.fontFamily,
            canvasFontFamily,
            globalFontFamily,
        })
        : undefined;
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
                selected && "ring-1 ring-brand-500/50 rounded bg-brand-50/50",
                data.className
            )}
            style={{ pointerEvents: 'auto' }}
        >
            {shouldRenderExplicitBodyEntry ? (
                <button
                    type="button"
                    aria-label="Edit content"
                    className="pointer-events-auto absolute right-2 top-2 z-10 rounded-full border border-slate-300 bg-white/90 px-2 py-1 text-[11px] font-medium text-slate-700 shadow-sm backdrop-blur"
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
                    className="w-[220px] min-h-[72px] rounded border border-slate-300 px-2 py-1 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
            ) : (
                <div
                    className="flex items-center justify-center gap-2 whitespace-pre-wrap leading-tight pointer-events-none"
                    style={{
                        fontSize: typography.fontSizePx,
                        lineHeight: `${typography.lineHeightPx}px`,
                        color: data.color || '#374151', // text-gray-700
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
