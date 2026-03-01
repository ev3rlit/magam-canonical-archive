import { Container, Instance } from './hostConfig';

function resolveScopedReference(
    selfId: string,
    reference: string,
    nodeIds: Set<string>,
): string {
    if (!reference || reference.includes('.')) return reference;

    const dotIdx = selfId.lastIndexOf('.');
    const scope = dotIdx > -1 ? selfId.substring(0, dotIdx) : '';
    if (!scope) return reference;

    const scopedReference = `${scope}.${reference}`;
    return nodeIds.has(scopedReference) ? scopedReference : reference;
}

export function resolveTreeAnchors(container: Container): Container {
    const nodeIds = new Set<string>();

    // Phase 1: collect all node IDs from the tree
    function collectIds(instances: Instance[]) {
        for (const inst of instances) {
            if (inst.props['id']) nodeIds.add(inst.props['id']);
            collectIds(inst.children);
        }
    }
    collectIds(container.children);

    // Phase 2: resolve anchor props to scoped IDs
    function resolveInstances(instances: Instance[]): Instance[] {
        return instances.map(inst => {
            let props = inst.props;

            const selfId = typeof props['id'] === 'string' ? props['id'] as string : null;
            if (selfId) {
                if (typeof props['anchor'] === 'string') {
                    const resolvedAnchor = resolveScopedReference(selfId, props['anchor'] as string, nodeIds);
                    if (resolvedAnchor !== props['anchor']) {
                        props = { ...props, anchor: resolvedAnchor };
                    }
                }

                const at = props['at'];
                if (at && typeof at === 'object') {
                    const currentAt = at as Record<string, unknown>;
                    let nextAt: Record<string, unknown> | null = null;

                    if (typeof currentAt.target === 'string') {
                        const resolvedTarget = resolveScopedReference(selfId, currentAt.target, nodeIds);
                        if (resolvedTarget !== currentAt.target) {
                            nextAt = { ...(nextAt ?? currentAt), target: resolvedTarget };
                        }
                    }

                    if (typeof currentAt.anchor === 'string') {
                        const resolvedAtAnchor = resolveScopedReference(selfId, currentAt.anchor, nodeIds);
                        if (resolvedAtAnchor !== currentAt.anchor) {
                            nextAt = { ...(nextAt ?? currentAt), anchor: resolvedAtAnchor };
                        }
                    }

                    if (nextAt) {
                        props = { ...props, at: nextAt };
                    }
                }
            }

            return {
                ...inst,
                props,
                children: resolveInstances(inst.children),
            };
        });
    }

    return { ...container, children: resolveInstances(container.children) };
}
