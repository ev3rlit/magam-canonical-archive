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
        'min-w-[260px] max-w-[360px] rounded-xl bg-danger/10 p-3 shadow-raised shadow-[inset_0_0_0_1px_rgb(var(--color-danger)/0.18)]',
        selected ? 'shadow-[0_0_0_1px_rgb(var(--color-danger)/0.24),0_0_0_12px_rgb(var(--color-danger)/0.08)]' : '',
      )}
      selected={selected}
      bubble={false}
      startHandle={false}
      endHandle={false}
    >
      <div className="space-y-2 text-foreground/82">
        <div className="text-sm font-semibold text-danger">{title}</div>
        <div className="text-xs text-danger/80">
          plugin runtime unavailable
        </div>
        {packageRef.length > 0 ? (
          <div className="rounded bg-card px-2 py-1 text-[11px] text-foreground/58 shadow-[inset_0_0_0_1px_rgb(var(--color-border)/0.12)]">
            {packageRef}
          </div>
        ) : null}
        {diagnostic ? (
          <div className="rounded bg-card px-2 py-1 text-[11px] text-foreground/72 shadow-[inset_0_0_0_1px_rgb(var(--color-danger)/0.18)]">
            <div className="font-semibold">{diagnostic.code}</div>
            <div>{diagnostic.message}</div>
          </div>
        ) : null}
      </div>
    </BaseNode>
  );
};

export default memo(PluginFallbackNode);
