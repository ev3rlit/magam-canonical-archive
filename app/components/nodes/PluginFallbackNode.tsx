import React, { memo } from 'react';
import { twMerge } from 'tailwind-merge';
import { BaseNode } from './BaseNode';
import type { PluginNodeRuntimeState } from '@/features/plugin-runtime';

export interface PluginFallbackNodeData {
  label?: string;
  className?: string;
  pluginRuntime?: PluginNodeRuntimeState;
  plugin?: {
    packageName?: string;
    version?: string;
    exportName?: string;
  };
}

interface PluginFallbackNodeProps {
  data: PluginFallbackNodeData;
  selected: boolean;
}

function resolveFallbackTitle(data: PluginFallbackNodeData): string {
  if (typeof data.label === 'string' && data.label.trim().length > 0) {
    return data.label;
  }

  const exportName = data.plugin?.exportName;
  if (typeof exportName === 'string' && exportName.trim().length > 0) {
    return exportName;
  }

  return 'Plugin widget';
}

const PluginFallbackNode = ({ data, selected }: PluginFallbackNodeProps) => {
  const title = resolveFallbackTitle(data);
  const diagnostic = data.pluginRuntime?.diagnostic;
  const packageRef = [
    data.plugin?.packageName,
    data.plugin?.version,
    data.plugin?.exportName,
  ].filter((value): value is string => typeof value === 'string' && value.length > 0).join(' / ');

  return (
    <BaseNode
      className={twMerge(
        'min-w-[260px] max-w-[360px] rounded-xl border-2 border-amber-200 bg-amber-50 p-3 shadow-node',
        selected ? 'ring-2 ring-amber-300' : '',
        data.className,
      )}
      selected={selected}
      bubble={false}
      startHandle={false}
      endHandle={false}
    >
      <div className="space-y-2 text-slate-700">
        <div className="text-sm font-semibold text-amber-700">{title}</div>
        <div className="text-xs text-amber-800/80">
          plugin runtime unavailable
        </div>
        {packageRef.length > 0 ? (
          <div className="rounded border border-amber-200 bg-white px-2 py-1 text-[11px] text-slate-600">
            {packageRef}
          </div>
        ) : null}
        {diagnostic ? (
          <div className="rounded border border-amber-300 bg-white px-2 py-1 text-[11px] text-slate-700">
            <div className="font-semibold">{diagnostic.code}</div>
            <div>{diagnostic.message}</div>
          </div>
        ) : null}
      </div>
    </BaseNode>
  );
};

export default memo(PluginFallbackNode);
