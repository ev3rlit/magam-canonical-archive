import { useMindMapEmbed } from '../context/MindMapEmbedContext';
import { useInMindMap } from '../context/MindMapContext';
import type { FromProp } from '../components/Node';
import { useEmbedScope } from '../context/EmbedScopeContext';
import { useNodeId } from './useNodeId';

type EmbedMetaProps = {
  __magamScope?: string;
  __mindmapEmbedScope?: string;
  __mindmapEmbedMountFrom?: FromProp;
  __mindmapEmbedSourceFile?: string;
};

export function useMindMapScopedId(id: string | undefined): string | undefined {
  const inMindMap = useInMindMap();
  const mindMapEmbed = useMindMapEmbed();
  const scopedCanvasId = useNodeId(id);

  if (!id) return id;
  if (id.includes('.')) return id;
  if (inMindMap) {
    if (mindMapEmbed?.scope) {
      return `${mindMapEmbed.scope}.${id}`;
    }
    return id;
  }
  return scopedCanvasId;
}

export function useMindMapScopedReference(reference: string | undefined): string | undefined {
  const inMindMap = useInMindMap();
  const scopedCanvasReference = useNodeId(reference);

  if (!reference) return reference;
  if (reference.includes('.')) return reference;
  if (inMindMap) return reference;
  return scopedCanvasReference;
}

export function useMindMapEmbedMeta(from?: FromProp): EmbedMetaProps {
  const inMindMap = useInMindMap();
  const mindMapEmbed = useMindMapEmbed();
  const embedScope = useEmbedScope();
  const magamScope = inMindMap ? mindMapEmbed?.scope : embedScope;

  if (!inMindMap) {
    return magamScope ? { __magamScope: magamScope } : {};
  }

  if (!mindMapEmbed) {
    return {};
  }

  return {
    ...(magamScope ? { __magamScope: magamScope } : {}),
    __mindmapEmbedScope: mindMapEmbed.scope,
    ...(from === undefined && mindMapEmbed.from !== undefined
      ? { __mindmapEmbedMountFrom: mindMapEmbed.from }
      : {}),
    ...(mindMapEmbed.sourceFile
      ? { __mindmapEmbedSourceFile: mindMapEmbed.sourceFile }
      : {}),
  };
}
