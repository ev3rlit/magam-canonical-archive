import { useCallback, useRef, useState } from 'react';
import { useReactFlow } from 'reactflow';
import type { MindMapGroup } from '@/store/graph';
import { getLayoutStrategy } from '@/utils/strategies';
import { runElkLayout } from '@/utils/elkUtils';
import { calculateGroupBoundingBox } from '@/utils/layoutUtils';
import {
    buildGroupMetaNodes,
    calculateGlobalGroupLayout,
    applyGlobalOffsets,
} from '@/utils/globalLayoutResolver';
import {
    resolveAnchors,
    calculateAnchoredPosition,
    AnchorConfig,
    AnchorPosition as AnchorPos,
} from '@/utils/anchorResolver';

interface UseLayoutOptions {
    direction?: 'RIGHT' | 'DOWN' | 'LEFT' | 'UP';
    spacing?: number;
    mindMapGroups?: MindMapGroup[];
    fitViewOnComplete?: boolean;
}

export function canStartLayout(inFlight: boolean): boolean {
    return !inFlight;
}

export function useLayout() {
    const { getNodes, getEdges, setNodes, fitView } = useReactFlow();
    const [isLayouting, setIsLayouting] = useState(false);
    const inFlightRef = useRef(false);

    const calculateLayout = useCallback(
        async (options: UseLayoutOptions = {}) => {
            if (!canStartLayout(inFlightRef.current)) {
                return false;
            }
            const nodes = getNodes();
            const edges = getEdges();
            const shouldFitView = options.fitViewOnComplete !== false;

            if (nodes.length === 0) return false;

            inFlightRef.current = true;
            setIsLayouting(true);

            try {
                const groups = options.mindMapGroups || [];

                // ========================================
                // Multi-MindMap Global Layout Pipeline
                // ========================================
                if (groups.length > 0) {
                    console.log(`[ELK Layout] Processing ${groups.length} MindMap group(s)...`);

                    // Phase 1: Calculate internal layout for each group
                    console.log('[ELK Layout] Phase 1: Internal group layouts...');
                    const internalPositions = new Map<string, { x: number; y: number }>();

                    for (const group of groups) {
                        const groupNodes = nodes.filter(n => n.data?.groupId === group.id);
                        const groupNodeIds = new Set(groupNodes.map(n => n.id));
                        const groupEdges = edges.filter(e => groupNodeIds.has(e.source) && groupNodeIds.has(e.target));

                        if (groupNodes.length === 0) continue;

                        console.log(`[ELK Layout]   Group "${group.id}": ${groupNodes.length} nodes, type: ${group.layoutType}`);

                        const strategy = getLayoutStrategy(group.layoutType);
                        const positions = await strategy.layoutGroup({
                            nodes: groupNodes,
                            edges: groupEdges,
                            spacing: group.spacing || 60,
                            density: group.density,
                        });

                        // Store positions (relative to group origin 0,0)
                        positions.forEach((pos, nodeId) => {
                            internalPositions.set(nodeId, pos);
                        });
                    }

                    // Apply internal positions to nodes (temporarily)
                    let nodesWithInternalLayout = nodes.map(node => {
                        const pos = internalPositions.get(node.id);
                        if (pos) {
                            return { ...node, position: { x: pos.x, y: pos.y } };
                        }
                        return node;
                    });

                    // Phase 1.5: Resolve Canvas-level anchors for non-group nodes
                    const nonGroupNodes = nodesWithInternalLayout.filter(n => !n.data?.groupId);
                    if (nonGroupNodes.some(n => n.data?.anchor)) {
                        console.log('[ELK Layout] Phase 1.5: Resolving Canvas-level anchors...');
                        const resolvedNonGroup = resolveAnchors(nonGroupNodes);
                        const resolvedMap = new Map(resolvedNonGroup.map(n => [n.id, n]));
                        nodesWithInternalLayout = nodesWithInternalLayout.map(n =>
                            resolvedMap.get(n.id) ?? n
                        );
                    }

                    // Phase 2: Calculate global group positions
                    console.log('[ELK Layout] Phase 2: Global group positioning...');

                    // Check if any group has anchor
                    const hasAnchors = groups.some(g => g.anchor);

                    if (hasAnchors || groups.length > 1) {
                        // Build metanodes from groups with their bounding boxes
                        const metaNodes = buildGroupMetaNodes(groups, nodesWithInternalLayout);

                        // Calculate global positions for each group
                        const globalPositions = await calculateGlobalGroupLayout(metaNodes, 100);

                        // Phase 3: Apply global offsets
                        console.log('[ELK Layout] Phase 3: Applying global offsets...');
                        nodesWithInternalLayout = applyGlobalOffsets(
                            nodesWithInternalLayout,
                            groups,
                            globalPositions
                        );
                    } else {
                        console.log('[ELK Layout] Single group without anchors, skipping global layout.');
                    }

                    // Phase 4: Position groups anchored to Canvas nodes
                    const groupIdSet = new Set(groups.map(g => g.id));
                    const canvasAnchoredGroups = groups.filter(g => g.anchor && !groupIdSet.has(g.anchor));
                    if (canvasAnchoredGroups.length > 0) {
                        console.log('[ELK Layout] Phase 4: Positioning groups anchored to Canvas nodes...');
                        for (const group of canvasAnchoredGroups) {
                            const anchorNode = nodesWithInternalLayout.find(n => n.id === group.anchor);
                            if (!anchorNode) {
                                console.warn(`[ELK Layout] Canvas anchor "${group.anchor}" not found for group "${group.id}"`);
                                continue;
                            }

                            const groupNodes = nodesWithInternalLayout.filter(n => n.data?.groupId === group.id);
                            const bbox = calculateGroupBoundingBox(groupNodes);

                            const anchorWidth = anchorNode.width ?? (anchorNode.data?.width as number) ?? 150;
                            const anchorHeight = anchorNode.height ?? (anchorNode.data?.height as number) ?? 50;

                            const config: AnchorConfig = {
                                anchor: group.anchor!,
                                position: (group.anchorPosition as AnchorPos) ?? 'right',
                                gap: group.anchorGap ?? 100,
                            };

                            const targetPos = calculateAnchoredPosition(config, {
                                x: anchorNode.position.x,
                                y: anchorNode.position.y,
                                width: anchorWidth,
                                height: anchorHeight,
                            }, { width: bbox.width, height: bbox.height });

                            const dx = targetPos.x - bbox.x;
                            const dy = targetPos.y - bbox.y;

                            nodesWithInternalLayout = nodesWithInternalLayout.map(n => {
                                if (n.data?.groupId === group.id) {
                                    return {
                                        ...n,
                                        position: {
                                            x: n.position.x + dx,
                                            y: n.position.y + dy,
                                        }
                                    };
                                }
                                return n;
                            });

                            console.log(`[ELK Layout] Group "${group.id}" anchored to Canvas node "${group.anchor}", offset: (${dx.toFixed(0)}, ${dy.toFixed(0)})`);
                        }
                    }

                    // Make nodes visible and update
                    const finalNodes = nodesWithInternalLayout.map(node => ({
                        ...node,
                        style: { ...node.style, opacity: 1 }
                    }));

                    setNodes(finalNodes);
                    if (shouldFitView) {
                        window.requestAnimationFrame(() => fitView({ padding: 0.1, duration: 200 }));
                    }
                    console.log('[ELK Layout] Complete.');
                    return true;
                }

                // ========================================
                // Default: Unidirectional Layout
                // ========================================
                console.log('[ELK Layout] Starting unidirectional layout...');

                const positions = await runElkLayout(
                    nodes,
                    edges,
                    options.direction || 'RIGHT',
                    options.spacing || 60
                );

                const newNodes = nodes.map(node => {
                    const pos = positions.get(node.id);
                    if (pos) {
                        return {
                            ...node,
                            position: { x: pos.x, y: pos.y },
                            style: { ...node.style, opacity: 1 },
                        };
                    }
                    return { ...node, style: { ...node.style, opacity: 1 } };
                });

                setNodes(newNodes);
                if (shouldFitView) {
                    window.requestAnimationFrame(() => fitView({ padding: 0.1, duration: 200 }));
                }
                return true;

            } catch (error) {
                console.error('ELK Layout failed:', error);
                const visibleNodes = nodes.map(n => ({ ...n, style: { ...n.style, opacity: 1 } }));
                setNodes(visibleNodes);
                return false;
            } finally {
                inFlightRef.current = false;
                setIsLayouting(false);
            }
        },
        [getNodes, getEdges, setNodes, fitView]
    );

    return { calculateLayout, isLayouting };
}
