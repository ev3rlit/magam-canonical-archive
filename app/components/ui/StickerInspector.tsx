import React, { useMemo } from 'react';
import type { Node } from 'reactflow';
import { useGraphStore } from '@/store/graph';

function coerceNumber(value: string, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function coerceOutlineWidth(value: string, fallback: number) {
  return Math.max(1, Math.min(14, Math.round(coerceNumber(value, fallback))));
}

interface StickerInspectorProps {
  onApplyStylePatch?: (payload: {
    nodeId: string;
    patch: Record<string, unknown>;
  }) => Promise<void> | void;
}

export function StickerInspector({ onApplyStylePatch }: StickerInspectorProps) {
  const nodes = useGraphStore((state) => state.nodes);
  const selectedNodeIds = useGraphStore((state) => state.selectedNodeIds);

  const selectedSticker = useMemo(() => {
    const selectedSet = new Set(selectedNodeIds);
    return nodes.find((node) => selectedSet.has(node.id) && node.type === 'sticker') as Node | undefined;
  }, [nodes, selectedNodeIds]);

  if (!selectedSticker) {
    return null;
  }

  const data = (selectedSticker.data || {}) as Record<string, unknown>;
  const outlineColor = typeof data.outlineColor === 'string' ? data.outlineColor : '#ffffff';
  const outlineWidth = typeof data.outlineWidth === 'number' ? data.outlineWidth : 4;
  const padding = typeof data.padding === 'number' ? data.padding : 8;
  const rotation = typeof data.rotation === 'number' ? data.rotation : 0;
  const shadow = data.shadow === 'none' || data.shadow === 'sm' || data.shadow === 'md' || data.shadow === 'lg'
    ? data.shadow
    : 'md';
  const applyStylePatch = (patch: Record<string, unknown>) => {
    Promise.resolve(onApplyStylePatch?.({
      nodeId: selectedSticker.id,
      patch,
    })).catch(() => undefined);
  };

  const applyRealStickerPreset = () => {
    applyStylePatch({
      outlineColor: '#ffffff',
      outlineWidth: 10,
      shadow: 'lg',
      padding: 10,
      rotation,
    });
  };

  return (
    <aside className="absolute right-3 top-3 z-40 w-80 max-h-[calc(100%-1.5rem)] overflow-auto rounded-xl border border-slate-200 bg-white/95 backdrop-blur p-3 shadow-xl">
      <h3 className="text-sm font-semibold text-slate-800 mb-2">Sticker Inspector</h3>

      <div className="space-y-2 text-xs">
        <button
          type="button"
          className="w-full rounded border border-slate-300 bg-slate-50 px-2 py-1 text-left text-slate-700 hover:bg-slate-100"
          onClick={applyRealStickerPreset}
        >
          Apply real sticker preset
        </button>

        <label className="block">
          <span className="text-slate-500">outlineColor</span>
          <input
            className="mt-1 w-full rounded border px-2 py-1"
            value={outlineColor}
            onChange={(e) => applyStylePatch({ outlineColor: e.target.value })}
          />
        </label>

        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="text-slate-500">outlineWidth</span>
            <input
              type="number"
              className="mt-1 w-full rounded border px-2 py-1"
              value={outlineWidth}
              min={1}
              max={14}
              onChange={(e) =>
                applyStylePatch({
                  outlineWidth: coerceOutlineWidth(e.target.value, outlineWidth),
                })
              }
            />
          </label>

          <label className="block">
            <span className="text-slate-500">padding</span>
            <input
              type="number"
              className="mt-1 w-full rounded border px-2 py-1"
              value={padding}
              min={0}
              onChange={(e) =>
                applyStylePatch({
                  padding: Math.max(0, coerceNumber(e.target.value, padding)),
                })
              }
            />
          </label>

          <label className="block">
            <span className="text-slate-500">rotation</span>
            <input
              type="number"
              className="mt-1 w-full rounded border px-2 py-1"
              value={rotation}
              onChange={(e) =>
                applyStylePatch({
                  rotation: coerceNumber(e.target.value, rotation),
                })
              }
            />
          </label>

          <label className="block">
            <span className="text-slate-500">shadow</span>
            <select
              className="mt-1 w-full rounded border px-2 py-1"
              value={shadow}
              onChange={(e) =>
                applyStylePatch({ shadow: e.target.value })
              }
            >
              <option value="none">none</option>
              <option value="sm">sm</option>
              <option value="md">md</option>
              <option value="lg">lg</option>
            </select>
          </label>
        </div>
      </div>
    </aside>
  );
}
