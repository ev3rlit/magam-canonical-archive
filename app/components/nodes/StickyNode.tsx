import React, { memo } from 'react';
import { NodeProps } from 'reactflow';
import { clsx } from 'clsx';
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

interface StickyNodeData {
  label: string;
  color?: string;
  fontFamily?: FontFamilyPreset;
  className?: string; // Support custom Tailwind classes
  children?: RenderableChild[];
}

const StickyNode = ({ data, selected }: NodeProps<StickyNodeData>) => {
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
        clsx(
          'w-40 h-40 p-6 flex flex-col justify-center items-center transition-all duration-300',
          'bg-node-sticky text-node-text',
          'shadow-node rounded-lg',
          // Only apply hover effects if NOT selected
          !selected && 'hover:shadow-node-hover hover:-translate-y-1',
          {
            'shadow-node-selected scale-105': selected,
          },
          data.color,
          data.className
        ),
      )}
    >
      <div className="w-full h-full flex items-center justify-center text-center break-words overflow-hidden pointer-events-none select-none">
        <div className="flex items-center gap-2">
          {renderNodeContent({
            children: data.children,
            fallbackLabel: data.label,
            iconClassName: 'w-4 h-4 text-slate-600 shrink-0',
            textClassName: 'text-base leading-relaxed font-medium text-slate-800',
            textStyle: { fontFamily: resolvedFontFamily },
          })}
        </div>
      </div>
    </BaseNode>
  );
};

export default memo(StickyNode);
