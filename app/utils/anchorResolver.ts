import { Node } from 'reactflow';
import { MindMapGroup } from '@/store/graph';
import type { AtDef } from '@/types/washiTape';
import { getWashiNodePosition, resolveWashiGeometry } from './washiTapeGeometry';

export type AnchorPosition =
    | 'top' | 'bottom' | 'left' | 'right'
    | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export interface AnchorConfig {
    anchor: string;
    position: AnchorPosition;
    gap?: number;
    align?: 'start' | 'center' | 'end';
}

interface NodeRect {
    x: number;
    y: number;
    width: number;
    height: number;
}

interface MeasuredNode {
    measured?: {
        width?: number;
        height?: number;
    };
}

function getNodeDataSize(node: Node): { width?: number; height?: number } {
    const data = node.data;
    if (!data || typeof data !== 'object') {
        return {};
    }
    const width = (data as { width?: unknown }).width;
    const height = (data as { height?: unknown }).height;
    return {
        width: typeof width === 'number' ? width : undefined,
        height: typeof height === 'number' ? height : undefined,
    };
}

function getNodeSize(node: Node, fallback = { width: 150, height: 50 }): { width: number; height: number } {
    const measured = (node as Node & MeasuredNode).measured;
    const dataSize = getNodeDataSize(node);
    return {
        width: measured?.width ?? node.width ?? dataSize.width ?? fallback.width,
        height: measured?.height ?? node.height ?? dataSize.height ?? fallback.height,
    };
}

function isAttachAt(value: unknown): value is Extract<AtDef, { type: 'attach' }> {
    if (!value || typeof value !== 'object') {
        return false;
    }
    const candidate = value as { type?: unknown; target?: unknown };
    return candidate.type === 'attach' && typeof candidate.target === 'string';
}

/**
 * Calculate the bounding box for a group of nodes
 */
export function calculateGroupBoundingBox(nodes: Node[]): NodeRect {
    if (nodes.length === 0) {
        return { x: 0, y: 0, width: 0, height: 0 };
    }

    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    nodes.forEach(node => {
        const { width: w, height: h } = getNodeSize(node);

        minX = Math.min(minX, node.position.x);
        minY = Math.min(minY, node.position.y);
        maxX = Math.max(maxX, node.position.x + w);
        maxY = Math.max(maxY, node.position.y + h);
    });

    return {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY
    };
}

/**
 * Calculate the position of a node relative to an anchor node
 */
export function calculateAnchoredPosition(
    config: AnchorConfig,
    anchorNode: NodeRect,
    targetSize: { width: number; height: number }
): { x: number; y: number } {
    const gap = config.gap ?? 40;
    const align = config.align ?? 'center';

    let x: number;
    let y: number;

    // Helper functions for alignment
    const alignX = (anchor: NodeRect, targetWidth: number, alignment: string): number => {
        switch (alignment) {
            case 'start':
                return anchor.x;
            case 'end':
                return anchor.x + anchor.width - targetWidth;
            case 'center':
            default:
                return anchor.x + (anchor.width - targetWidth) / 2;
        }
    };

    const alignY = (anchor: NodeRect, targetHeight: number, alignment: string): number => {
        switch (alignment) {
            case 'start':
                return anchor.y;
            case 'end':
                return anchor.y + anchor.height - targetHeight;
            case 'center':
            default:
                return anchor.y + (anchor.height - targetHeight) / 2;
        }
    };

    switch (config.position) {
        case 'right':
            x = anchorNode.x + anchorNode.width + gap;
            y = alignY(anchorNode, targetSize.height, align);
            break;
        case 'left':
            x = anchorNode.x - targetSize.width - gap;
            y = alignY(anchorNode, targetSize.height, align);
            break;
        case 'top':
            x = alignX(anchorNode, targetSize.width, align);
            y = anchorNode.y - targetSize.height - gap;
            break;
        case 'bottom':
            x = alignX(anchorNode, targetSize.width, align);
            y = anchorNode.y + anchorNode.height + gap;
            break;
        case 'top-left':
            x = anchorNode.x - targetSize.width - gap;
            y = anchorNode.y - targetSize.height - gap;
            break;
        case 'top-right':
            x = anchorNode.x + anchorNode.width + gap;
            y = anchorNode.y - targetSize.height - gap;
            break;
        case 'bottom-left':
            x = anchorNode.x - targetSize.width - gap;
            y = anchorNode.y + anchorNode.height + gap;
            break;
        case 'bottom-right':
            x = anchorNode.x + anchorNode.width + gap;
            y = anchorNode.y + anchorNode.height + gap;
            break;
        default:
            x = anchorNode.x + anchorNode.width + gap;
            y = alignY(anchorNode, targetSize.height, align);
    }

    return { x, y };
}

/**
 * Topological sort of MindMap groups based on anchor dependencies
 */
function topologicalSortGroups(groups: MindMapGroup[]): MindMapGroup[] {
    const groupMap = new Map<string, MindMapGroup>();
    const dependsOn = new Map<string, string>();
    const inDegree = new Map<string, number>();

    groups.forEach((group) => {
        groupMap.set(group.id, group);
        inDegree.set(group.id, 0);

        if (group.anchor) {
            dependsOn.set(group.id, group.anchor);
        }
    });

    dependsOn.forEach((anchorId, groupId) => {
        if (groupMap.has(anchorId)) {
            inDegree.set(groupId, (inDegree.get(groupId) ?? 0) + 1);
        }
    });

    const queue: MindMapGroup[] = [];
    const result: MindMapGroup[] = [];

    inDegree.forEach((degree, groupId) => {
        if (degree === 0) {
            const group = groupMap.get(groupId);
            if (group) queue.push(group);
        }
    });

    while (queue.length > 0) {
        const current = queue.shift()!;
        result.push(current);

        dependsOn.forEach((anchorId, groupId) => {
            if (anchorId === current.id) {
                const newDegree = (inDegree.get(groupId) ?? 1) - 1;
                inDegree.set(groupId, newDegree);

                if (newDegree === 0) {
                    const group = groupMap.get(groupId);
                    if (group) queue.push(group);
                }
            }
        });
    }

    if (result.length !== groups.length) {
        const unprocessed = groups.filter((g) => !result.includes(g));
        console.error('[AnchorResolver] Circular reference detected in groups:', unprocessed.map((g) => g.id));
        return [...result, ...unprocessed];
    }

    return result;
}

/**
 * Resolve group-level anchors for MindMap groups
 * This should be called AFTER ELK layout has positioned nodes within each group
 */
export function resolveGroupAnchors(
    nodes: Node[],
    mindMapGroups: MindMapGroup[]
): Node[] {
    if (mindMapGroups.length === 0) {
        return nodes;
    }

    // Check if any group has anchor
    const hasAnchoredGroups = mindMapGroups.some(g => g.anchor);
    if (!hasAnchoredGroups) {
        console.log('[AnchorResolver] No anchored groups found, skipping group anchor resolution');
        return nodes;
    }

    console.log('[AnchorResolver] Resolving group anchors...');

    // Sort groups by dependency order
    const sortedGroups = topologicalSortGroups(mindMapGroups);

    // Build map: groupId -> nodes in that group
    const groupNodesMap = new Map<string, Node[]>();
    nodes.forEach(node => {
        const groupId = node.data?.groupId as string | undefined;
        if (groupId) {
            const existing = groupNodesMap.get(groupId) ?? [];
            existing.push(node);
            groupNodesMap.set(groupId, existing);
        }
    });

    // Map to store resolved group bounding boxes
    const groupBoundingBoxes = new Map<string, NodeRect>();

    // Track offsets to apply to each group
    const groupOffsets = new Map<string, { dx: number; dy: number }>();

    // Process groups in dependency order
    sortedGroups.forEach(group => {
        const groupNodes = groupNodesMap.get(group.id) ?? [];
        if (groupNodes.length === 0) return;

        // Calculate current bounding box of this group
        const currentBBox = calculateGroupBoundingBox(groupNodes);

        if (group.anchor && group.anchorPosition) {
            // This group has an anchor
            const anchorBBox = groupBoundingBoxes.get(group.anchor);

            if (anchorBBox) {
                const config: AnchorConfig = {
                    anchor: group.anchor,
                    position: group.anchorPosition as AnchorPosition,
                    gap: group.anchorGap ?? 100,
                };

                // Calculate where this group should be positioned
                const targetPos = calculateAnchoredPosition(
                    config,
                    anchorBBox,
                    { width: currentBBox.width, height: currentBBox.height }
                );

                // Calculate offset from current position
                const dx = targetPos.x - currentBBox.x;
                const dy = targetPos.y - currentBBox.y;

                groupOffsets.set(group.id, { dx, dy });

                // Store the new bounding box position
                groupBoundingBoxes.set(group.id, {
                    x: targetPos.x,
                    y: targetPos.y,
                    width: currentBBox.width,
                    height: currentBBox.height
                });

                console.log(`[AnchorResolver] Group "${group.id}" anchored to "${group.anchor}", offset: (${dx.toFixed(0)}, ${dy.toFixed(0)})`);
            } else {
                console.warn(`[AnchorResolver] Anchor group "${group.anchor}" not found for group "${group.id}"`);
                // Store current position as-is
                groupBoundingBoxes.set(group.id, currentBBox);
            }
        } else {
            // No anchor - store current bounding box
            groupBoundingBoxes.set(group.id, currentBBox);
        }
    });

    // Apply offsets to all nodes
    if (groupOffsets.size === 0) {
        return nodes;
    }

    return nodes.map(node => {
        const groupId = node.data?.groupId as string | undefined;
        if (groupId) {
            const offset = groupOffsets.get(groupId);
            if (offset) {
                return {
                    ...node,
                    position: {
                        x: node.position.x + offset.dx,
                        y: node.position.y + offset.dy
                    }
                };
            }
        }
        return node;
    });
}

/**
 * Topological sort of nodes based on anchor dependencies
 * Returns nodes in order that respects dependencies
 * Throws error if circular reference detected
 */
export function topologicalSort(nodes: Node[]): Node[] {
    const nodeMap = new Map<string, Node>();
    const dependsOn = new Map<string, string>(); // nodeId -> anchorId
    const inDegree = new Map<string, number>();

    // Build maps
    nodes.forEach((node) => {
        nodeMap.set(node.id, node);
        inDegree.set(node.id, 0);

        // Check if this node has an anchor dependency
        const anchor = node.data?.anchor;
        if (anchor) {
            dependsOn.set(node.id, anchor);
        }
    });

    // Calculate in-degrees
    dependsOn.forEach((anchorId, nodeId) => {
        if (nodeMap.has(anchorId)) {
            inDegree.set(nodeId, (inDegree.get(nodeId) ?? 0) + 1);
        }
    });

    // Kahn's algorithm
    const queue: Node[] = [];
    const result: Node[] = [];

    // Start with nodes that have no dependencies (in-degree 0)
    inDegree.forEach((degree, nodeId) => {
        if (degree === 0) {
            const node = nodeMap.get(nodeId);
            if (node) queue.push(node);
        }
    });

    while (queue.length > 0) {
        const current = queue.shift()!;
        result.push(current);

        // Find nodes that depend on current
        dependsOn.forEach((anchorId, nodeId) => {
            if (anchorId === current.id) {
                const newDegree = (inDegree.get(nodeId) ?? 1) - 1;
                inDegree.set(nodeId, newDegree);

                if (newDegree === 0) {
                    const node = nodeMap.get(nodeId);
                    if (node) queue.push(node);
                }
            }
        });
    }

    // Check for circular references
    if (result.length !== nodes.length) {
        const unprocessed = nodes.filter((n) => !result.includes(n));
        console.error('[AnchorResolver] Circular reference detected in:', unprocessed.map((n) => n.id));
        // Return original order for unprocessed nodes, appended at end
        return [...result, ...unprocessed];
    }

    return result;
}

/**
 * Resolve all anchor-based positions in the node array
 * Returns a new array with updated positions
 * Used for Canvas-mode nodes with anchor/position props
 */
export function resolveAnchors(nodes: Node[]): Node[] {
    // First, topologically sort the nodes
    const sortedNodes = topologicalSort(nodes);

    // Map to store resolved positions
    const resolvedPositions = new Map<string, NodeRect>();

    // Process nodes in dependency order
    return sortedNodes.map((node) => {
        const anchor = node.data?.anchor as string | undefined;
        const position = node.data?.position as AnchorPosition | undefined;
        const at = (node.data as { at?: unknown } | undefined)?.at;
        const { width, height } = getNodeSize(node);

        if (
            node.type === 'washi-tape'
            && isAttachAt(at)
        ) {
            const runtimeNodes = sortedNodes.map((candidate) => {
                const resolved = resolvedPositions.get(candidate.id);
                if (!resolved) {
                    return candidate;
                }
                return {
                    ...candidate,
                    position: { x: resolved.x, y: resolved.y },
                    width: resolved.width,
                    height: resolved.height,
                };
            });
            const geometry = resolveWashiGeometry({
                at,
                nodes: runtimeNodes,
                seed: (node.data as { seed?: string | number } | undefined)?.seed,
                fallbackPosition: node.position,
            });
            const attachedPosition = getWashiNodePosition(geometry);
            const resolvedWidth = Math.max(width, geometry.length);
            const resolvedHeight = Math.max(height, geometry.thickness);

            resolvedPositions.set(node.id, {
                x: attachedPosition.x,
                y: attachedPosition.y,
                width: resolvedWidth,
                height: resolvedHeight,
            });

            return {
                ...node,
                position: attachedPosition,
                data: {
                    ...(node.data || {}),
                    resolvedGeometry: geometry,
                },
            };
        }

        // Case 1: No anchor - store position as-is (even if 0,0)
        if (!anchor) {
            resolvedPositions.set(node.id, {
                x: node.position.x,
                y: node.position.y,
                width,
                height,
            });
            return node;
        }

        // If anchor is specified, always derive the position from current anchor geometry.
        // This keeps relative placement stable when the anchor target moves between layouts.
        if (anchor && position) {
            const anchorRect = resolvedPositions.get(anchor);

            if (anchorRect) {
                const config: AnchorConfig = {
                    anchor,
                    position,
                    gap: node.data?.gap,
                    align: node.data?.align,
                };

                const newPos = calculateAnchoredPosition(config, anchorRect, { width, height });

                // Store the resolved position
                resolvedPositions.set(node.id, {
                    x: newPos.x,
                    y: newPos.y,
                    width,
                    height,
                });

                // Return node with updated position
                return {
                    ...node,
                    position: newPos,
                };
            } else {
                console.warn(`[AnchorResolver] Anchor node "${anchor}" not found for node "${node.id}"`);
            }
        }

        // No anchor or missing anchor node - keep original position
        resolvedPositions.set(node.id, {
            x: node.position.x,
            y: node.position.y,
            width,
            height,
        });

        return node;
    });
}
