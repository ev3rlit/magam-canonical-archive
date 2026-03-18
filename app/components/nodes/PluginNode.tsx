import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { type NodeProps, useNodeId } from 'reactflow';
import { twMerge } from 'tailwind-merge';
import { BaseNode } from './BaseNode';
import PluginFallbackNode from './PluginFallbackNode';
import { useGraphStore } from '@/store/graph';
import {
  hydratePluginInstance,
  toPluginRuntimeState,
  usePluginIframeRuntime,
  usePluginRuntimeRegistry,
  type PluginHydrationResult,
  type PluginNodeInstanceInput,
  type PluginNodeRuntimeState,
  type PluginRuntimeDiagnostic,
} from '@/features/plugin-runtime';

export interface PluginNodeData {
  label?: string;
  className?: string;
  plugin?: PluginNodeInstanceInput;
  pluginRuntime?: PluginNodeRuntimeState;
}

function areDiagnosticsEquivalent(
  current: PluginRuntimeDiagnostic | undefined,
  next: PluginRuntimeDiagnostic | undefined,
): boolean {
  if (!current && !next) {
    return true;
  }
  if (!current || !next) {
    return false;
  }
  return (
    current.code === next.code
    && current.stage === next.stage
    && current.message === next.message
  );
}

function areRuntimeStatesEquivalent(
  current: PluginNodeRuntimeState | undefined,
  next: PluginNodeRuntimeState,
): boolean {
  return current?.status === next.status && areDiagnosticsEquivalent(current?.diagnostic, next.diagnostic);
}

interface ReadyPluginNodeFrameProps {
  nodeId: string;
  data: PluginNodeData;
  selected: boolean;
  hydration: Extract<PluginHydrationResult, { ok: true }>;
  commitRuntimeState: (state: PluginNodeRuntimeState) => void;
}

function ReadyPluginNodeFrame({
  nodeId,
  data,
  selected,
  hydration,
  commitRuntimeState,
}: ReadyPluginNodeFrameProps) {
  const updateNodeData = useGraphStore((state) => state.updateNodeData);

  const runtime = usePluginIframeRuntime({
    nodeId,
    descriptor: hydration.descriptor,
    instance: hydration.instance,
    onDiagnostic: (diagnostic) => {
      commitRuntimeState(toPluginRuntimeState({
        status: diagnostic.code === 'PLUGIN_RUNTIME_CRASH' ? 'crashed' : 'invalid',
        diagnostic,
      }));
    },
    onPatchInstanceProps: (patch) => {
      const latestNode = useGraphStore.getState().nodes.find((node) => node.id === nodeId);
      const latestData = latestNode?.data as PluginNodeData | undefined;
      const latestPlugin = latestData?.plugin;
      if (!latestPlugin) {
        return;
      }

      const latestProps = (
        typeof latestPlugin.props === 'object'
        && latestPlugin.props !== null
        && !Array.isArray(latestPlugin.props)
      ) ? latestPlugin.props as Record<string, unknown> : {};

      updateNodeData(nodeId, {
        plugin: {
          ...latestPlugin,
          props: {
            ...latestProps,
            ...patch,
          },
        },
      });
    },
    getHostObjects: () => {
      const nodes = useGraphStore.getState().nodes;
      return nodes.map((node) => {
        const nodeData = (node.data || {}) as Record<string, unknown>;
        const label = typeof nodeData.label === 'string' ? nodeData.label : node.id;
        return {
          id: node.id,
          type: node.type,
          label,
        };
      });
    },
    getHostObjectById: (id) => {
      const node = useGraphStore.getState().nodes.find((candidate) => candidate.id === id);
      if (!node) {
        return null;
      }
      return {
        id: node.id,
        type: node.type,
        position: node.position,
        data: node.data,
      };
    },
    getSelection: () => useGraphStore.getState().selectedNodeIds,
  });

  useEffect(() => {
    commitRuntimeState(runtime.runtimeState);
  }, [commitRuntimeState, runtime.runtimeState]);

  const label = hydration.instance.displayName
    || data.label
    || hydration.instance.exportName;

  return (
    <BaseNode
      className={twMerge(
        'min-w-[280px] rounded-xl border-2 border-slate-200 bg-white p-2 shadow-node',
        selected ? 'ring-2 ring-brand-500/25 border-brand-400' : '',
        data.className,
      )}
      selected={selected}
      bubble={false}
      startHandle={false}
      endHandle={false}
    >
      <div className="flex flex-col gap-2">
        <div className="px-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          {label}
        </div>
        <iframe
          ref={runtime.iframeRef}
          title={label}
          srcDoc={runtime.srcDoc}
          sandbox="allow-scripts"
          className="w-full rounded-lg border border-slate-200 bg-white"
          style={{ height: `${runtime.iframeHeight}px` }}
        />
      </div>
    </BaseNode>
  );
}

const PluginNode = ({ data, selected }: NodeProps<PluginNodeData>) => {
  const runtimeNodeId = useNodeId();
  const nodeId = runtimeNodeId || (typeof data.plugin?.instanceId === 'string' ? data.plugin.instanceId : null);
  const registry = usePluginRuntimeRegistry();
  const updateNodeData = useGraphStore((state) => state.updateNodeData);
  const [hydration, setHydration] = useState<PluginHydrationResult | null>(null);

  const commitRuntimeState = useCallback((nextState: PluginNodeRuntimeState) => {
    if (!nodeId) {
      return;
    }
    const currentNode = useGraphStore.getState().nodes.find((candidate) => candidate.id === nodeId);
    const currentRuntime = (currentNode?.data as PluginNodeData | undefined)?.pluginRuntime;
    if (areRuntimeStatesEquivalent(currentRuntime, nextState)) {
      return;
    }
    updateNodeData(nodeId, {
      pluginRuntime: nextState,
    });
  }, [nodeId, updateNodeData]);

  useEffect(() => {
    let active = true;
    if (!nodeId) {
      const invalidResult: PluginHydrationResult = {
        ok: false,
        diagnostic: {
          code: 'PLUGIN_INSTANCE_INVALID',
          stage: 'hydration',
          message: 'Plugin node is missing runtime id.',
          timestamp: Date.now(),
        },
      };
      setHydration(invalidResult);
      return () => {
        active = false;
      };
    }

    setHydration(null);
    hydratePluginInstance({
      nodeId,
      plugin: data.plugin,
      registry,
    }).then((result) => {
      if (!active) {
        return;
      }
      setHydration(result);
    });

    return () => {
      active = false;
    };
  }, [data.plugin, nodeId, registry]);

  useEffect(() => {
    if (!hydration || !nodeId) {
      return;
    }

    if (!hydration.ok) {
      commitRuntimeState(toPluginRuntimeState({
        status: hydration.diagnostic.code === 'PLUGIN_INSTANCE_INVALID' ? 'invalid' : 'missing',
        diagnostic: hydration.diagnostic,
      }));
      return;
    }

    commitRuntimeState(toPluginRuntimeState({
      status: 'loading',
    }));
  }, [commitRuntimeState, hydration, nodeId]);

  const fallbackData = useMemo(() => ({
    label: data.label,
    className: data.className,
    pluginRuntime: hydration && !hydration.ok
      ? toPluginRuntimeState({
        status: hydration.diagnostic.code === 'PLUGIN_INSTANCE_INVALID' ? 'invalid' : 'missing',
        diagnostic: hydration.diagnostic,
      })
      : data.pluginRuntime,
    plugin: {
      packageName: typeof data.plugin?.packageName === 'string' ? data.plugin.packageName : undefined,
      version: typeof data.plugin?.version === 'string' ? data.plugin.version : undefined,
      exportName: typeof data.plugin?.exportName === 'string' ? data.plugin.exportName : undefined,
    },
  }), [data.className, data.label, data.plugin?.exportName, data.plugin?.packageName, data.plugin?.version, data.pluginRuntime, hydration]);

  if (!hydration) {
    return (
      <BaseNode
        className={twMerge(
          'min-w-[280px] rounded-xl border-2 border-slate-200 bg-white p-3 shadow-node',
          data.className,
        )}
        selected={selected}
        bubble={false}
        startHandle={false}
        endHandle={false}
      >
        <div className="text-xs text-slate-500">Loading plugin runtime...</div>
      </BaseNode>
    );
  }

  if (!hydration.ok || !nodeId) {
    return (
      <PluginFallbackNode
        id={nodeId ?? 'plugin-fallback'}
        data={fallbackData}
        selected={selected}
      />
    );
  }

  return (
    <ReadyPluginNodeFrame
      nodeId={nodeId}
      data={data}
      selected={selected}
      hydration={hydration}
      commitRuntimeState={commitRuntimeState}
    />
  );
};

export default memo(PluginNode);

