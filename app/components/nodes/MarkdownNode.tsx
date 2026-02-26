import React, { isValidElement, memo, useCallback, useMemo } from 'react';
import { NodeProps } from 'reactflow';
import ReactMarkdown from 'react-markdown';
import { twMerge } from 'tailwind-merge';
import { BaseNode } from './BaseNode';
import remarkGfm from 'remark-gfm';
import { CodeBlock } from '../ui/CodeBlock';
import { useNodeNavigation } from '@/contexts/NavigationContext';
import { toAssetApiUrl } from '@/utils/imageSource';
import { useGraphStore } from '@/store/graph';
import type { RenderableChild } from '@/utils/childComposition';
import type { FontFamilyPreset } from '@magam/core';
import {
    hasExplicitFontFamilyClass,
    resolveFontFamilyCssValue,
} from '@/utils/fontHierarchy';

interface MarkdownNodeData {
    label: string;
    /** Enable bubble overlay when zoomed out. Text auto-extracted from label. */
    bubble?: boolean;
    fontFamily?: FontFamilyPreset;
    className?: string;
    variant?: 'default' | 'minimal';
    children?: RenderableChild[];
}

const MarkdownNode = ({ data, selected }: NodeProps<MarkdownNodeData>) => {
    const { navigateToNode } = useNodeNavigation();
    const globalFontFamily = useGraphStore((state) => state.globalFontFamily);
    const canvasFontFamily = useGraphStore((state) => state.canvasFontFamily);
    const shouldApplyHierarchy = !hasExplicitFontFamilyClass(data.className);
    const resolvedFontFamily = shouldApplyHierarchy
        ? resolveFontFamilyCssValue({
            nodeFontFamily: data.fontFamily,
            canvasFontFamily,
            globalFontFamily,
        })
        : undefined;

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
            className="prose prose-sm prose-slate max-w-none pointer-events-none select-none"
            style={{ fontFamily: resolvedFontFamily }}
        >
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                urlTransform={(url) => url}
                components={components}
            >
                {data.label}
            </ReactMarkdown>
        </div>
    ), [data.label, components, resolvedFontFamily]);

    return (
        <BaseNode
            className={twMerge(
                "min-w-64 min-h-20 w-auto h-auto flex flex-col justify-center p-6 text-left",
                "bg-white border-2 border-slate-200 text-slate-800 transition-all duration-300",
                "shadow-lg rounded-xl",
                !selected && "hover:border-indigo-300 hover:shadow-xl hover:-translate-y-1",
                selected && "border-brand-500 ring-2 ring-brand-500/20 shadow-xl",
                data.className
            )}
            bubble={data.bubble}
            label={data.label}
        >
            {markdownContent}
        </BaseNode>
    );
};

export default memo(MarkdownNode);
