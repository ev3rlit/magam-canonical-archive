import React, { isValidElement, memo, useCallback, useMemo } from 'react';
import { NodeProps, useNodeId } from 'reactflow';
import type { Components } from 'react-markdown';
import { twMerge } from 'tailwind-merge';
import { BaseNode, NODE_EDIT_BUTTON_CLASS } from './BaseNode';
import { CodeBlock } from '../ui/CodeBlock';
import { getInputClassName } from '@/components/ui/Input';
import { useNodeNavigation } from '@/contexts/NavigationContext';
import { toAssetApiUrl } from '@/utils/imageSource';
import { useGraphStore } from '@/store/graph';
import { LazyMarkdownRenderer } from '@/components/markdown/LazyMarkdownRenderer';
import type { RenderableChild } from '@/utils/childComposition';
import {
    resolveBodyEditSession,
    useExplicitBodyEntryAffordance,
} from './renderableContent';
import type { FontFamilyPreset, MarkdownSizeInput } from '@magam/core';
import {
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
    const explicitBodyEntryEnabled = useExplicitBodyEntryAffordance();
    const resolvedFontFamily = resolveFontFamilyCssValue({
        nodeFontFamily: data.fontFamily,
        canvasFontFamily,
        globalFontFamily,
    });
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

    const components = useMemo<Components>(() => ({
        pre: ({ children }) => {
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
        a: ({ node, href, children, ...props }) => {
            const nodeHref = node?.properties?.href;
            const actualHref = typeof href === 'string'
                ? href
                : typeof nodeHref === 'string'
                    ? nodeHref
                    : Array.isArray(nodeHref) && typeof nodeHref[0] === 'string'
                        ? nodeHref[0]
                        : '';
            const isNodeLink = actualHref?.startsWith('node:');
            return (
                <a
                    href={actualHref}
                    className={twMerge(
                        "cursor-pointer pointer-events-auto",
                        isNodeLink
                            ? "font-medium text-primary underline decoration-primary/40 hover:decoration-primary"
                            : "text-primary hover:underline"
                    )}
                    onClick={(e) => handleLinkClick(e, actualHref)}
                    {...props}
                >
                    {isNodeLink && <span className="mr-1">→</span>}
                    {children}
                </a>
            );
        },
        code: ({ node, children, ...props }) => {
            void node;
            return (
                <code className="rounded-md bg-muted px-1.5 py-0.5 text-[0.9em] font-mono text-primary shadow-[inset_0_0_0_1px_rgb(var(--color-border)/0.12)]" {...props}>
                    {children}
                </code>
            );
        },
        img: ({ node, src, alt, ...props }) => {
            void node;
            const assetBasePath = useGraphStore.getState().assetBasePath;
            const resolvedSrc = src ? toAssetApiUrl(assetBasePath, src) : '';
            return <img src={resolvedSrc} alt={alt || ''} {...props} />;
        },
    }), [handleLinkClick]);

    const markdownContent = useMemo(() => (
        <div
            className={twMerge(
                "prose prose-sm max-w-none pointer-events-none select-none text-foreground",
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
    const bodyEditSession = nodeId ? resolveBodyEditSession({
        id: nodeId,
        type: 'markdown',
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
            style={{ pointerEvents: 'auto', ...frameStyle }}
            className={twMerge(
                isContentDrivenAuto
                    ? "w-auto h-auto flex flex-col justify-center px-4 py-3 text-left"
                    : "min-w-64 min-h-20 w-auto h-auto flex flex-col justify-center p-6 text-left",
                "rounded-xl bg-card text-foreground shadow-raised shadow-[inset_0_0_0_1px_rgb(var(--color-border)/0.14)] transition-all duration-base",
                !selected && "hover:-translate-y-1 hover:shadow-floating",
                selected && "shadow-[0_0_0_1px_rgb(var(--color-primary)/0.24),0_0_0_12px_rgb(var(--color-primary)/0.08),0_18px_56px_-28px_rgb(var(--shadow-color)/0.42)]"
            )}
            bubble={data.bubble}
            label={data.label}
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
                <div className="w-full space-y-3 pointer-events-auto">
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
                        className={getInputClassName({
                            className: 'w-full min-h-[120px]',
                            multiline: true,
                        })}
                    />
                    <div
                        className="prose prose-sm max-w-none rounded-lg bg-muted p-3 text-foreground shadow-[inset_0_0_0_1px_rgb(var(--color-border)/0.12)]"
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
