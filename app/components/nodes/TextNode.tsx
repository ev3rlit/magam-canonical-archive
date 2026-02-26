import React, { memo } from 'react';
import { NodeProps } from 'reactflow';
import { twMerge } from 'tailwind-merge';
import { BaseNode } from './BaseNode';
import type { RenderableChild } from '@/utils/childComposition';
import { renderNodeContent } from './renderableContent';
import { useGraphStore } from '@/store/graph';
import type { FontFamilyPreset } from '@magam/core';
import {
    hasExplicitFontFamilyClass,
    resolveFontFamilyCssValue,
} from '@/utils/fontHierarchy';

interface TextNodeData {
    label: string;
    fontSize?: number;
    color?: string;
    fontFamily?: FontFamilyPreset;
    bold?: boolean;
    italic?: boolean;
    className?: string;
    children?: RenderableChild[];
}

const TextNode = ({ data, selected }: NodeProps<TextNodeData>) => {
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

    return (
        <BaseNode
            className={twMerge(
                "p-2 min-w-[50px] text-center pointer-events-none select-none",
                selected && "ring-1 ring-brand-500/50 rounded bg-brand-50/50",
                data.className
            )}
        >
            <div
                className="flex items-center justify-center gap-2 whitespace-pre-wrap leading-tight"
                style={{
                    fontSize: data.fontSize || 16,
                    color: data.color || '#374151', // text-gray-700
                    fontWeight: data.bold ? 'bold' : 'normal',
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
        </BaseNode>
    );
};

export default memo(TextNode);
