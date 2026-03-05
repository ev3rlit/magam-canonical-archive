import React, { isValidElement, memo, useCallback, useMemo } from 'react';
import { NodeProps, useNodeId } from 'reactflow';
import { twMerge } from 'tailwind-merge';
import { BaseNode } from './BaseNode';
import { CodeBlock } from '../ui/CodeBlock';
import { useNodeNavigation } from '@/contexts/NavigationContext';
import { toAssetApiUrl } from '@/utils/imageSource';
import { useGraphStore } from '@/store/graph';
import { LazyMarkdownRenderer } from '@/components/markdown/LazyMarkdownRenderer';
import type { RenderableChild } from '@/utils/childComposition';
import type { FontFamilyPreset, MarkdownSizeInput } from '@magam/core';
import {
    hasExplicitFontFamilyClass,
    resolveFontFamilyCssValue,
} from '@/utils/fontHierarchy';
import { resolveMarkdownSize } from '@/utils/sizeResolver';

interface MarkdownNodeData {
    label: string;
    /** Enable bubble overlay when zoomed out. Text auto-extracted from label. */
    bubble?: boolean;
    size?: MarkdownSizeInput;
    fontFamily?: FontFamilyPreset;
    className?: string;
    variant?: 'default' | 'minimal';
    children?: RenderableChild[];
}

const MarkdownNode = ({ data, selected }: NodeProps<MarkdownNodeData>) => {
    const { navigateToNode } = useNodeNavigation();
    const nodeId = useNodeId();
    const globalFontFamily = useGraphStore((state) => state.globalFontFamily);
    const canvasFontFamily = useGraphStore((state) => state.canvasFontFamily);
    const activeTextEditNodeId = useGraphStore((state) => state.activeTextEditNodeId);
    const textEditDraft = useGraphStore((state) => state.textEditDraft);
    const startTextEditSession = useGraphStore((state) => state.startTextEditSession);
    const updateTextEditDraft = useGraphStore((state) => state.updateTextEditDraft);
    const requestTextEditCommit = useGraphStore((state) => state.requestTextEditCommit);
    const requestTextEditCancel = useGraphStore((state) => state.requestTextEditCancel);
    const shouldApplyHierarchy = !hasExplicitFontFamilyClass(data.className);
    const resolvedFontFamily = shouldApplyHierarchy
        ? resolveFontFamilyCssValue({
            nodeFontFamily: data.fontFamily,
            canvasFontFamily,
            globalFontFamily,
        })
        : undefined;
    const resolvedSize = resolveMarkdownSize(data.size, {
        component: 'MarkdownNode',
        inputPath: 'size',
    });
    const typographyStyle = resolvedSize.mode === 'typography'
        ? {
            fontSize: `${resolvedSize.typography.fontSizePx}px`,
            lineHeight: `${resolvedSize.typography.lineHeightPx}px`,
        }
        : undefined;
    const frameStyle = resolvedSize.mode === 'object2d'
        && resolvedSize.object2d.mode === 'fixed'
        ? {
            width: resolvedSize.object2d.widthPx,
            height: resolvedSize.object2d.heightPx,
            minWidth: resolvedSize.object2d.widthPx,
            minHeight: resolvedSize.object2d.heightPx,
        }
        : undefined;
    const isContentDrivenAuto = resolvedSize.mode === 'object2d'
        && resolvedSize.object2d.mode === 'auto';

    const handleLinkClick = useCallback((e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
        e.preventDefault();
        e.stopPropagation();

        if (href.startsWith('node:')) {
            const path = href.slice(5);
            navigateToNode(path);
        } else {
            window.open(href, '_blank', 'noopener,noreferrer');
        }
    }, [navigateToNode]);

    const components = useMemo(() => ({
        pre: ({ children }: any) => {
            const codeChild = Array.isArray(children) ? children[0] : children;
            if (!isValidElement(codeChild)) {
                return <>{children}</>;
            }

            const codeProps = (codeChild as React.ReactElement<{ className?: string; children?: React.ReactNode }>).props;
            const className = codeProps?.className ?? '';
            const match = /language-(\w+)/.exec(className);
            const value = React.Children.toArray(codeProps?.children).join('').replace(/\n$/, '');

            return (
                <CodeBlock
                    language={match?.[1] ?? ''}
                    value={value}
                    className="not-prose"
                />
            );
        },
        a: ({ node, href, children, ...props }: any) => {
            const actualHref = href || (node as any)?.properties?.href || '';
            const isNodeLink = actualHref?.startsWith('node:');
            return (
                <a
                    href={actualHref}
                    className={twMerge(
                        "cursor-pointer pointer-events-auto",
                        isNodeLink
                            ? "text-indigo-600 hover:text-indigo-800 font-medium underline decoration-indigo-300 hover:decoration-indigo-500"
                            : "text-blue-500 hover:underline"
                    )}
                    onClick={(e) => handleLinkClick(e, actualHref)}
                    {...props}
                >
                    {isNodeLink && <span className="mr-1">→</span>}
                    {children}
                </a>
            );
        },
        code: ({ children, ...props }: any) => {
            return (
                <code className="bg-slate-100 rounded px-1.5 py-0.5 text-[0.9em] font-mono text-pink-600 border border-slate-200" {...props}>
                    {children}
                </code>
            );
        },
        img: ({ node, src, alt, ...props }: any) => {
            const currentFile = useGraphStore.getState().currentFile;
            const resolvedSrc = src ? toAssetApiUrl(currentFile, src) : '';
            return <img src={resolvedSrc} alt={alt || ''} {...props} />;
        },
    }), [handleLinkClick]);

    const markdownContent = useMemo(() => (
        <div
            className={twMerge(
                "prose prose-sm prose-slate max-w-none pointer-events-none select-none",
                isContentDrivenAuto
                    && "prose-headings:my-1.5 prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5"
            )}
            style={{ fontFamily: resolvedFontFamily, ...typographyStyle }}
        >
            <LazyMarkdownRenderer
                content={data.label}
                urlTransform={(url) => url}
                components={components}
            />
        </div>
    ), [data.label, components, isContentDrivenAuto, resolvedFontFamily]);

    const isActiveEditor = Boolean(nodeId && selected && activeTextEditNodeId === nodeId);

    const beginEditing = useCallback(() => {
        if (!selected || !nodeId) return;
        startTextEditSession({
            nodeId,
            initialDraft: data.label || '',
            mode: 'markdown-wysiwyg',
        });
    }, [data.label, nodeId, selected, startTextEditSession]);

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
            style={{ pointerEvents: 'auto', ...frameStyle }}
            className={twMerge(
                isContentDrivenAuto
                    ? "w-auto h-auto flex flex-col justify-center px-4 py-3 text-left"
                    : "min-w-64 min-h-20 w-auto h-auto flex flex-col justify-center p-6 text-left",
                "bg-white border-2 border-slate-200 text-slate-800 transition-all duration-300",
                "shadow-lg rounded-xl",
                !selected && "hover:border-indigo-300 hover:shadow-xl hover:-translate-y-1",
                selected && "border-brand-500 ring-2 ring-brand-500/20 shadow-xl",
                data.className
            )}
            bubble={data.bubble}
            label={data.label}
            onDoubleClick={beginEditing}
        >
            {isActiveEditor ? (
                <div className="w-full space-y-3 pointer-events-auto">
                    <textarea
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
                        className="w-full min-h-[120px] rounded border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                    <div
                        className="prose prose-sm prose-slate max-w-none rounded border border-dashed border-slate-300 bg-slate-50 p-3"
                        style={{ fontFamily: resolvedFontFamily, ...typographyStyle }}
                    >
                        <LazyMarkdownRenderer
                            content={textEditDraft}
                            urlTransform={(url) => url}
                            components={components}
                        />
                    </div>
                </div>
            ) : markdownContent}
        </BaseNode>
    );
};

export default memo(MarkdownNode);
