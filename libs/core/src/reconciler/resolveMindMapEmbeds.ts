import type { FromProp } from '../components/Node';
import type { Container, Instance } from './hostConfig';

const EMBED_SCOPE_PROP = '__mindmapEmbedScope';
const EMBED_MOUNT_FROM_PROP = '__mindmapEmbedMountFrom';
const EMBED_SOURCE_FILE_PROP = '__mindmapEmbedSourceFile';

function stripInternalProps(props: Instance['props']): Instance['props'] {
  const {
    [EMBED_MOUNT_FROM_PROP]: _embedMountFrom,
    [EMBED_SOURCE_FILE_PROP]: _embedSourceFile,
    ...rest
  } = props;

  return rest;
}

function resolveScopedReference(
  reference: string,
  scope: string | undefined,
  nodeIds: Set<string>,
): string {
  if (!scope || !reference) return reference;

  const colonIndex = reference.lastIndexOf(':');
  const nodeId = colonIndex > 0 ? reference.substring(0, colonIndex) : reference;
  const handle = colonIndex > 0 ? reference.substring(colonIndex + 1) : undefined;

  if (nodeId.includes('.')) {
    return reference;
  }

  const scopedReference = `${scope}.${nodeId}`;
  if (!nodeIds.has(scopedReference)) {
    return reference;
  }

  return handle ? `${scopedReference}:${handle}` : scopedReference;
}

function resolveFromValue(
  from: FromProp | undefined,
  scope: string | undefined,
  nodeIds: Set<string>,
): FromProp | undefined {
  if (from === undefined) {
    return from;
  }

  if (typeof from === 'string') {
    return resolveScopedReference(from, scope, nodeIds);
  }

  const resolvedNode = resolveScopedReference(from.node, scope, nodeIds);
  if (resolvedNode === from.node) {
    return from;
  }

  return {
    ...from,
    node: resolvedNode,
  };
}

export function resolveMindMapEmbeds(container: Container): Container {
  const nodeIds = new Set<string>();

  function collectIds(instances: Instance[]) {
    for (const inst of instances) {
      if (typeof inst.props.id === 'string') {
        nodeIds.add(inst.props.id);
      }
      collectIds(inst.children);
    }
  }

  function resolveInstances(instances: Instance[], inMindMap = false): Instance[] {
    return instances.map((inst) => {
      const nextInMindMap = inMindMap || inst.type === 'graph-mindmap';
      const embedScope = typeof inst.props[EMBED_SCOPE_PROP] === 'string'
        ? inst.props[EMBED_SCOPE_PROP] as string
        : undefined;
      const mountFrom = inst.props[EMBED_MOUNT_FROM_PROP] as FromProp | undefined;
      const sourceFile = typeof inst.props[EMBED_SOURCE_FILE_PROP] === 'string'
        ? inst.props[EMBED_SOURCE_FILE_PROP] as string
        : undefined;

      let props = stripInternalProps(inst.props);

      if (nextInMindMap) {
        void sourceFile;

        if (inst.type === 'graph-edge') {
          const resolvedFrom = resolveFromValue(
            typeof props.from === 'string' ? props.from : undefined,
            embedScope,
            nodeIds,
          );
          const resolvedTo = typeof props.to === 'string'
            ? resolveScopedReference(props.to, embedScope, nodeIds)
            : props.to;

          if (resolvedFrom !== props.from || resolvedTo !== props.to) {
            props = {
              ...props,
              from: resolvedFrom,
              to: resolvedTo,
            };
          }
        } else if (props.from === undefined && mountFrom !== undefined) {
          props = {
            ...props,
            from: mountFrom,
          };
        } else {
          const resolvedFrom = resolveFromValue(props.from as FromProp | undefined, embedScope, nodeIds);
          if (resolvedFrom !== props.from) {
            props = {
              ...props,
              from: resolvedFrom,
            };
          }
        }
      }

      return {
        ...inst,
        props,
        children: resolveInstances(inst.children, nextInMindMap),
      };
    });
  }

  collectIds(container.children);

  return {
    ...container,
    children: resolveInstances(container.children),
  };
}
