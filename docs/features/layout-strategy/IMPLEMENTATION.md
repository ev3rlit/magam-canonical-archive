# Layout Strategy 리팩토링 구현 계획서

## 개요

`useElkLayout.ts` (327줄) 모놀리식 훅을 Strategy 패턴으로 분리합니다.
**동작 변경 없이** 구조만 개선하여, 향후 treemap/compact 등 새 레이아웃 추가를 용이하게 합니다.

## 현재 아키텍처 분석

### 파일별 현황

#### `app/hooks/useElkLayout.ts` (327줄)

```
L1-23:    imports
L25-30:   UseElkLayoutOptions 인터페이스
L35-103:  layoutBidirectionalGroup() 인라인 함수
L105-326: useElkLayout() 훅
  L109:     calculateLayout 콜백
  L118-258:   if (groups.length > 0) — Multi-MindMap 파이프라인
    L128-152:   Phase 1: 그룹 내부 레이아웃 (if/else bidirectional 분기)
    L154-161:   내부 포지션 적용
    L163-172:   Phase 1.5: Canvas 앵커 해결
    L174-196:   Phase 2-3: 글로벌 그룹 배치 + 오프셋 적용
    L198-247:   Phase 4: Canvas 노드에 앵커된 그룹 배치
    L249-258:   최종 노드 업데이트 + fitView
  L264-285:   단일 bidirectional fallback
  L290-312:   단일 unidirectional fallback
  L314-320:   에러 핸들링 + setIsLayouting(false)
```

#### `app/utils/layoutUtils.ts` (164줄)

```
L1-4:     imports (ELK 포함)
L7-14:    DEFAULT_LAYOUT_OPTIONS (ELK 전용)
L19-22:   findRootNode() — 범용
L27-52:   collectDescendants() — 범용
L57-63:   getNodeDimensions() — 범용
L68-91:   calculateGroupBoundingBox() — 범용
L97-139:  runElkLayout() — ELK 전용
L144-163: getYBounds() — 범용
```

#### `app/utils/globalLayoutResolver.ts` (239줄)

```
L1-6:     imports (layoutUtils에서 DEFAULT_LAYOUT_OPTIONS import)
L8-19:    타입 정의 (AnchorPosition, GroupMetaNode)
L25-42:   getAnchorDirection() — 헬퍼
L48-65:   createMetaEdges() — 헬퍼
L71-140:  calculateGlobalGroupLayout() — Phase 2
L146-174: buildGroupMetaNodes() — Phase 2 준비
L180-238: applyGlobalOffsets() — Phase 3
```

#### `app/components/GraphCanvas.tsx` (useElkLayout 참조 3곳)

```
L22:      import { useElkLayout } from '../hooks/useElkLayout';
L99:      const { calculateLayout, isLayouting } = useElkLayout();
L285-289: await calculateLayout({
            direction: 'RIGHT',
            bidirectional: layoutType === 'bidirectional',
            mindMapGroups,
          });
```

### 타입 캐스케이드

```
libs/core/src/components/MindMap.tsx
  MindMapProps.layout: 'tree' | 'bidirectional' | 'radial'  (L17)
    ↓ reconciler → graph AST → page.tsx 파싱
app/store/graph.ts
  MindMapGroup.layoutType: 'tree' | 'bidirectional' | 'radial'  (L41)
  GraphState.layoutType: 'tree' | 'bidirectional' | 'radial'  (L109)
    ↓ Zustand store → GraphCanvas
app/components/GraphCanvas.tsx
  calculateLayout({ bidirectional: layoutType === 'bidirectional' })  (L287)
    ↓
app/hooks/useElkLayout.ts
  if (group.layoutType === 'bidirectional') → layoutBidirectionalGroup()
  else → runElkLayout()
```

### 유일한 소비자

`useElkLayout`을 import하는 파일은 `GraphCanvas.tsx` **단 1곳**입니다.
테스트 파일은 없습니다 (`libs/core/src/layout/elk.spec.ts`는 서버사이드 deprecated 코드).

---

## 목표 구조

```
app/
├── hooks/
│   ├── useLayout.ts              ← NEW (useElkLayout 대체)
│   └── useElkLayout.ts           ← DELETE
├── utils/
│   ├── elkUtils.ts               ← NEW (ELK 전용 코드)
│   ├── layoutUtils.ts            ← MODIFY (범용 유틸만 남김)
│   ├── globalLayoutResolver.ts   ← MODIFY (import 경로 1줄)
│   ├── anchorResolver.ts         ← 변경 없음
│   └── strategies/
│       ├── types.ts              ← NEW
│       ├── treeStrategy.ts       ← NEW
│       ├── bidirectionalStrategy.ts ← NEW
│       ├── registry.ts           ← NEW
│       └── index.ts              ← NEW
└── components/
    └── GraphCanvas.tsx           ← MODIFY (3줄)
```

---

## 상세 인터페이스 정의

### `app/utils/strategies/types.ts`

```typescript
import { Node, Edge } from 'reactflow';

/**
 * 레이아웃 전략에 전달되는 입력 컨텍스트.
 * 하나의 MindMap 그룹에 속한 노드/엣지와 설정을 포함합니다.
 */
export interface LayoutContext {
  nodes: Node[];
  edges: Edge[];
  spacing: number;
}

/**
 * 모든 레이아웃 알고리즘이 구현해야 하는 계약.
 * 그룹 내부 노드의 상대 좌표를 계산하여 반환합니다.
 * 반환되는 좌표는 그룹 원점(0,0) 기준입니다.
 */
export interface LayoutStrategy {
  layoutGroup(context: LayoutContext): Promise<Map<string, { x: number; y: number }>>;
}
```

### `app/utils/strategies/treeStrategy.ts`

```typescript
import type { LayoutStrategy, LayoutContext } from './types';
import { runElkLayout } from '../elkUtils';

export class TreeStrategy implements LayoutStrategy {
  constructor(private direction: 'RIGHT' | 'DOWN' | 'LEFT' | 'UP' = 'RIGHT') {}

  async layoutGroup(context: LayoutContext): Promise<Map<string, { x: number; y: number }>> {
    return runElkLayout(context.nodes, context.edges, this.direction, context.spacing);
  }
}
```

기존 `useElkLayout.ts` L144-146의 `else` 분기를 그대로 래핑합니다.

### `app/utils/strategies/bidirectionalStrategy.ts`

```typescript
import type { LayoutStrategy, LayoutContext } from './types';
import { findRootNode, collectDescendants, getYBounds } from '../layoutUtils';
import { runElkLayout } from '../elkUtils';
import type { Node, Edge } from 'reactflow';

export class BidirectionalStrategy implements LayoutStrategy {
  async layoutGroup(context: LayoutContext): Promise<Map<string, { x: number; y: number }>> {
    const { nodes, edges, spacing } = context;
    const rootNode = findRootNode(nodes, edges);

    if (!rootNode) {
      // 루트를 찾지 못하면 단방향 fallback
      return runElkLayout(nodes, edges, 'RIGHT', spacing);
    }

    const rootChildren = edges
      .filter(e => e.source === rootNode.id)
      .map(e => e.target);

    if (rootChildren.length < 2) {
      // 자식이 2개 미만이면 양방향이 불필요
      return runElkLayout(nodes, edges, 'RIGHT', spacing);
    }

    // 자식을 좌/우로 분배
    const midpoint = Math.ceil(rootChildren.length / 2);
    const leftChildIds = rootChildren.slice(0, midpoint);
    const rightChildIds = rootChildren.slice(midpoint);

    // BFS로 서브트리 수집
    const leftNodeIds = collectDescendants(leftChildIds, edges);
    const rightNodeIds = collectDescendants(rightChildIds, edges);
    leftNodeIds.add(rootNode.id);
    rightNodeIds.add(rootNode.id);

    // 각 서브트리 노드/엣지 필터링
    const leftNodes = nodes.filter(n => leftNodeIds.has(n.id));
    const rightNodes = nodes.filter(n => rightNodeIds.has(n.id));
    const leftEdges = edges.filter(
      e => leftNodeIds.has(e.source) && leftNodeIds.has(e.target)
    );
    const rightEdges = edges.filter(
      e => rightNodeIds.has(e.source) && rightNodeIds.has(e.target)
    );

    // 좌/우 동시 ELK 레이아웃
    const [leftPos, rightPos] = await Promise.all([
      runElkLayout(leftNodes, leftEdges, 'LEFT', spacing),
      runElkLayout(rightNodes, rightEdges, 'RIGHT', spacing),
    ]);

    // 루트 중심 Y 정렬 및 머지
    const positions = new Map<string, { x: number; y: number }>();
    positions.set(rootNode.id, { x: 0, y: 0 });

    const leftRootPos = leftPos.get(rootNode.id);
    const rightRootPos = rightPos.get(rootNode.id);
    const leftYOffset = -getYBounds(leftPos, rootNode.id).center;
    const rightYOffset = -getYBounds(rightPos, rootNode.id).center;

    leftPos.forEach((p, id) => {
      if (id !== rootNode.id) {
        positions.set(id, {
          x: p.x - (leftRootPos?.x || 0),
          y: p.y + leftYOffset,
        });
      }
    });

    rightPos.forEach((p, id) => {
      if (id !== rootNode.id) {
        positions.set(id, {
          x: p.x - (rightRootPos?.x || 0),
          y: p.y + rightYOffset,
        });
      }
    });

    return positions;
  }
}
```

`useElkLayout.ts` L35-103의 `layoutBidirectionalGroup()` 함수를 **그대로** 클래스 메서드로 이동합니다.
입력 `(groupNodes, groupEdges, spacing)` → `LayoutContext`, 출력 `Map<string, {x, y}>` 동일.

### `app/utils/strategies/registry.ts`

```typescript
import type { LayoutStrategy } from './types';
import { TreeStrategy } from './treeStrategy';
import { BidirectionalStrategy } from './bidirectionalStrategy';

const strategies: Record<string, LayoutStrategy> = {
  tree: new TreeStrategy('RIGHT'),
  bidirectional: new BidirectionalStrategy(),
  // 향후 추가:
  // treemap: new TreemapStrategy(),
  // compact: new CompactStrategy(),
};

/**
 * layoutType 문자열에 대응하는 레이아웃 전략을 반환합니다.
 * 일치하는 전략이 없으면 tree를 fallback으로 사용합니다.
 * (현재 'radial'은 전용 구현이 없어 tree로 fallback됩니다.)
 */
export function getLayoutStrategy(layoutType: string): LayoutStrategy {
  return strategies[layoutType] ?? strategies.tree;
}
```

### `app/utils/strategies/index.ts`

```typescript
export type { LayoutStrategy, LayoutContext } from './types';
export { getLayoutStrategy } from './registry';
export { TreeStrategy } from './treeStrategy';
export { BidirectionalStrategy } from './bidirectionalStrategy';
```

---

## ELK 코드 분리 상세

### `app/utils/elkUtils.ts` (신규)

`layoutUtils.ts`에서 ELK 전용 코드를 추출합니다.

```typescript
import { Node, Edge } from 'reactflow';
// @ts-ignore
import ELK from 'elkjs/lib/elk.bundled';
import { ElkNode, ElkExtendedEdge } from 'elkjs/lib/elk-api';
import { getNodeDimensions } from './layoutUtils';

// Default options for ELK layout
export const DEFAULT_LAYOUT_OPTIONS = {
  'elk.algorithm': 'layered',
  'elk.direction': 'RIGHT',
  'elk.spacing.nodeNode': '20',
  'elk.layered.spacing.nodeNodeBetweenLayers': '40',
  'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
};

/**
 * Run ELK layout on a subgraph
 * @returns Map of node IDs to their calculated positions
 */
export async function runElkLayout(
  nodes: Node[],
  edges: Edge[],
  direction: 'LEFT' | 'RIGHT' | 'UP' | 'DOWN',
  spacing: number,
  additionalOptions: Record<string, string> = {}
): Promise<Map<string, { x: number; y: number }>> {
  const elk = new ELK();

  const elkNodes: ElkNode[] = nodes.map(node => {
    const { width, height } = getNodeDimensions(node);
    return { id: node.id, width, height };
  });

  const elkEdges: ElkExtendedEdge[] = edges.map(edge => ({
    id: edge.id,
    sources: [edge.source],
    targets: [edge.target],
  }));

  const layoutOptions = {
    ...DEFAULT_LAYOUT_OPTIONS,
    'elk.direction': direction,
    'elk.spacing.nodeNode': String(spacing),
    ...additionalOptions,
  };

  const graph: ElkNode = {
    id: 'root',
    layoutOptions,
    children: elkNodes,
    edges: elkEdges,
  };

  const layoutedGraph = await elk.layout(graph);

  const positions = new Map<string, { x: number; y: number }>();
  layoutedGraph.children?.forEach(n => {
    positions.set(n.id, { x: n.x!, y: n.y! });
  });

  return positions;
}
```

### `app/utils/layoutUtils.ts` (수정 후)

ELK 관련 코드를 제거하고 범용 유틸만 남깁니다.

```typescript
import { Node, Edge } from 'reactflow';

/**
 * Find the root node (node with no incoming edges)
 */
export function findRootNode(nodes: Node[], edges: Edge[]): Node | null {
  const targetIds = new Set(edges.map(e => e.target));
  return nodes.find(n => !targetIds.has(n.id)) || null;
}

/**
 * Collect all descendant node IDs of given root IDs (BFS)
 */
export function collectDescendants(
  rootIds: string[],
  edges: Edge[]
): Set<string> {
  const descendants = new Set<string>(rootIds);
  const childrenMap = new Map<string, string[]>();

  edges.forEach(e => {
    if (!childrenMap.has(e.source)) childrenMap.set(e.source, []);
    childrenMap.get(e.source)!.push(e.target);
  });

  const queue = [...rootIds];
  while (queue.length > 0) {
    const current = queue.shift()!;
    const children = childrenMap.get(current) || [];
    children.forEach(child => {
      if (!descendants.has(child)) {
        descendants.add(child);
        queue.push(child);
      }
    });
  }

  return descendants;
}

/**
 * Get node dimensions from React Flow node
 */
export function getNodeDimensions(node: Node): { width: number; height: number } {
  // @ts-ignore
  const w = node.measured?.width ?? node.width ?? node.data?.width ?? 150;
  // @ts-ignore
  const h = node.measured?.height ?? node.height ?? node.data?.height ?? 50;
  return { width: w, height: h };
}

/**
 * Calculate the bounding box for a group of nodes
 */
export function calculateGroupBoundingBox(
  nodes: Node[]
): { x: number; y: number; width: number; height: number } {
  if (nodes.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  let minX = Infinity, minY = Infinity;
  let maxX = -Infinity, maxY = -Infinity;

  nodes.forEach(node => {
    const { width, height } = getNodeDimensions(node);
    minX = Math.min(minX, node.position.x);
    minY = Math.min(minY, node.position.y);
    maxX = Math.max(maxX, node.position.x + width);
    maxY = Math.max(maxY, node.position.y + height);
  });

  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/**
 * Calculate Y bounding box for positions, excluding a specific ID
 */
export function getYBounds(
  positions: Map<string, { x: number; y: number }>,
  excludeId: string
): { min: number; max: number; center: number } {
  let minY = Infinity;
  let maxY = -Infinity;

  positions.forEach((pos, nodeId) => {
    if (nodeId !== excludeId) {
      minY = Math.min(minY, pos.y);
      maxY = Math.max(maxY, pos.y);
    }
  });

  return { min: minY, max: maxY, center: (minY + maxY) / 2 };
}
```

### `app/utils/globalLayoutResolver.ts` (import 변경 1줄)

```typescript
// Before (L6):
import { calculateGroupBoundingBox, DEFAULT_LAYOUT_OPTIONS } from './layoutUtils';

// After:
import { calculateGroupBoundingBox } from './layoutUtils';
import { DEFAULT_LAYOUT_OPTIONS } from './elkUtils';
```

나머지 로직은 변경 없음.

---

## useLayout.ts 상세

### `app/hooks/useLayout.ts` (useElkLayout 대체)

```typescript
import { useCallback, useState } from 'react';
import { useReactFlow, Node, Edge } from 'reactflow';
import type { MindMapGroup } from '@/store/graph';
import { getLayoutStrategy } from '@/utils/strategies';
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
import { calculateGroupBoundingBox } from '@/utils/layoutUtils';

interface UseLayoutOptions {
  direction?: 'RIGHT' | 'DOWN' | 'LEFT' | 'UP';
  spacing?: number;
  mindMapGroups?: MindMapGroup[];
}

export function useLayout() {
  const { getNodes, getEdges, setNodes, fitView } = useReactFlow();
  const [isLayouting, setIsLayouting] = useState(false);

  const calculateLayout = useCallback(
    async (options: UseLayoutOptions = {}) => {
      const nodes = getNodes();
      const edges = getEdges();

      if (nodes.length === 0) return;

      setIsLayouting(true);

      try {
        const groups = options.mindMapGroups || [];

        // ========================================
        // Multi-MindMap Global Layout Pipeline
        // ========================================
        if (groups.length > 0) {
          console.log(`[Layout] Processing ${groups.length} MindMap group(s)...`);

          // Phase 1: 각 그룹 내부 레이아웃 (Strategy dispatch)
          console.log('[Layout] Phase 1: Internal group layouts...');
          const internalPositions = new Map<string, { x: number; y: number }>();

          for (const group of groups) {
            const groupNodes = nodes.filter(n => n.data?.groupId === group.id);
            const groupNodeIds = new Set(groupNodes.map(n => n.id));
            const groupEdges = edges.filter(
              e => groupNodeIds.has(e.source) && groupNodeIds.has(e.target)
            );

            if (groupNodes.length === 0) continue;

            console.log(
              `[Layout]   Group "${group.id}": ${groupNodes.length} nodes, type: ${group.layoutType}`
            );

            // ★ 핵심 변경: if/else 대신 registry dispatch
            const strategy = getLayoutStrategy(group.layoutType);
            const positions = await strategy.layoutGroup({
              nodes: groupNodes,
              edges: groupEdges,
              spacing: group.spacing || 60,
            });

            positions.forEach((pos, nodeId) => {
              internalPositions.set(nodeId, pos);
            });
          }

          // 내부 포지션 적용
          let nodesWithInternalLayout = nodes.map(node => {
            const pos = internalPositions.get(node.id);
            if (pos) {
              return { ...node, position: { x: pos.x, y: pos.y } };
            }
            return node;
          });

          // Phase 1.5: Canvas 앵커 해결 (변경 없음)
          const nonGroupNodes = nodesWithInternalLayout.filter(n => !n.data?.groupId);
          if (nonGroupNodes.some(n => n.data?.anchor)) {
            console.log('[Layout] Phase 1.5: Resolving Canvas-level anchors...');
            const resolvedNonGroup = resolveAnchors(nonGroupNodes);
            const resolvedMap = new Map(resolvedNonGroup.map(n => [n.id, n]));
            nodesWithInternalLayout = nodesWithInternalLayout.map(
              n => resolvedMap.get(n.id) ?? n
            );
          }

          // Phase 2: 글로벌 그룹 배치 (변경 없음)
          console.log('[Layout] Phase 2: Global group positioning...');
          const hasAnchors = groups.some(g => g.anchor);

          if (hasAnchors || groups.length > 1) {
            const metaNodes = buildGroupMetaNodes(groups, nodesWithInternalLayout);
            const globalPositions = await calculateGlobalGroupLayout(metaNodes, 100);

            // Phase 3: 글로벌 오프셋 적용 (변경 없음)
            console.log('[Layout] Phase 3: Applying global offsets...');
            nodesWithInternalLayout = applyGlobalOffsets(
              nodesWithInternalLayout,
              groups,
              globalPositions
            );
          } else {
            console.log('[Layout] Single group without anchors, skipping global layout.');
          }

          // Phase 4: Canvas 노드에 앵커된 그룹 배치 (변경 없음)
          const groupIdSet = new Set(groups.map(g => g.id));
          const canvasAnchoredGroups = groups.filter(
            g => g.anchor && !groupIdSet.has(g.anchor)
          );
          if (canvasAnchoredGroups.length > 0) {
            console.log('[Layout] Phase 4: Positioning groups anchored to Canvas nodes...');
            for (const group of canvasAnchoredGroups) {
              const anchorNode = nodesWithInternalLayout.find(n => n.id === group.anchor);
              if (!anchorNode) {
                console.warn(
                  `[Layout] Canvas anchor "${group.anchor}" not found for group "${group.id}"`
                );
                continue;
              }

              const groupNodes = nodesWithInternalLayout.filter(
                n => n.data?.groupId === group.id
              );
              const bbox = calculateGroupBoundingBox(groupNodes);

              const anchorWidth =
                anchorNode.width ?? (anchorNode.data?.width as number) ?? 150;
              const anchorHeight =
                anchorNode.height ?? (anchorNode.data?.height as number) ?? 50;

              const config: AnchorConfig = {
                anchor: group.anchor!,
                position: (group.anchorPosition as AnchorPos) ?? 'right',
                gap: group.anchorGap ?? 100,
              };

              const targetPos = calculateAnchoredPosition(
                config,
                {
                  x: anchorNode.position.x,
                  y: anchorNode.position.y,
                  width: anchorWidth,
                  height: anchorHeight,
                },
                { width: bbox.width, height: bbox.height }
              );

              const dx = targetPos.x - bbox.x;
              const dy = targetPos.y - bbox.y;

              nodesWithInternalLayout = nodesWithInternalLayout.map(n => {
                if (n.data?.groupId === group.id) {
                  return {
                    ...n,
                    position: {
                      x: n.position.x + dx,
                      y: n.position.y + dy,
                    },
                  };
                }
                return n;
              });

              console.log(
                `[Layout] Group "${group.id}" anchored to Canvas node "${group.anchor}", offset: (${dx.toFixed(0)}, ${dy.toFixed(0)})`
              );
            }
          }

          // 최종 노드 업데이트
          const finalNodes = nodesWithInternalLayout.map(node => ({
            ...node,
            style: { ...node.style, opacity: 1 },
          }));

          setNodes(finalNodes);
          window.requestAnimationFrame(() => fitView({ padding: 0.1, duration: 200 }));
          console.log('[Layout] Complete.');
          return;
        }

        // ========================================
        // 그룹 없음: 단일 레이아웃 fallback
        // ========================================
        console.log('[Layout] Starting single layout...');

        const strategy = getLayoutStrategy('tree');
        const positions = await strategy.layoutGroup({
          nodes,
          edges,
          spacing: options.spacing || 60,
        });

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
        window.requestAnimationFrame(() => fitView({ padding: 0.1, duration: 200 }));
      } catch (error) {
        console.error('Layout failed:', error);
        const visibleNodes = nodes.map(n => ({
          ...n,
          style: { ...n.style, opacity: 1 },
        }));
        setNodes(visibleNodes);
      } finally {
        setIsLayouting(false);
      }
    },
    [getNodes, getEdges, setNodes, fitView]
  );

  return { calculateLayout, isLayouting };
}
```

### 기존 `useElkLayout.ts`와의 차이점

| 부분 | Before | After |
|------|--------|-------|
| Phase 1 dispatch | `if (layoutType === 'bidirectional') {...} else {...}` | `getLayoutStrategy(layoutType).layoutGroup(...)` |
| bidirectional 함수 | L35-103 인라인 정의 | `BidirectionalStrategy` 클래스로 이동 |
| 단일 맵 fallback | bidirectional/unidirectional 두 분기 | `getLayoutStrategy('tree')` 단일 경로 |
| `UseElkLayoutOptions.bidirectional` | 존재 | 제거 (layoutType이 직접 dispatch) |
| Phase 1.5, 2, 3, 4 | 그대로 | **그대로** (코드 동일) |
| 로그 prefix | `[ELK Layout]` | `[Layout]` |

---

## GraphCanvas.tsx 변경 (3곳)

```typescript
// L22: import 변경
// Before:
import { useElkLayout } from '../hooks/useElkLayout';
// After:
import { useLayout } from '../hooks/useLayout';

// L99: 훅 호출 변경
// Before:
const { calculateLayout, isLayouting } = useElkLayout();
// After:
const { calculateLayout, isLayouting } = useLayout();

// L285-289: bidirectional 파라미터 제거
// Before:
await calculateLayout({
    direction: 'RIGHT',
    bidirectional: layoutType === 'bidirectional',
    mindMapGroups,
});
// After:
await calculateLayout({
    direction: 'RIGHT',
    mindMapGroups,
});
```

---

## 구현 순서 (11 steps)

매 단계 완료 시 앱이 정상 동작하는 상태를 유지합니다.
Step 1-8은 순수 추가, Step 9는 신규 파일, Step 10이 switchover, Step 11이 cleanup.

| Step | 작업 | 타입 | 파일 | 검증 |
|------|------|------|------|------|
| 1 | `elkUtils.ts` 생성 (`DEFAULT_LAYOUT_OPTIONS` + `runElkLayout` 추출) | NEW | `app/utils/elkUtils.ts` | import 확인 |
| 2 | `layoutUtils.ts`에서 ELK 코드 제거 | MODIFY | `app/utils/layoutUtils.ts` | import 확인 |
| 3 | `globalLayoutResolver.ts` import 경로 변경 | MODIFY | `app/utils/globalLayoutResolver.ts` L6 | import 확인 |
| 4 | `strategies/types.ts` 생성 | NEW | `app/utils/strategies/types.ts` | TS 컴파일 |
| 5 | `strategies/treeStrategy.ts` 생성 | NEW | `app/utils/strategies/treeStrategy.ts` | TS 컴파일 |
| 6 | `strategies/bidirectionalStrategy.ts` 생성 | NEW | `app/utils/strategies/bidirectionalStrategy.ts` | TS 컴파일 |
| 7 | `strategies/registry.ts` 생성 | NEW | `app/utils/strategies/registry.ts` | TS 컴파일 |
| 8 | `strategies/index.ts` 생성 | NEW | `app/utils/strategies/index.ts` | TS 컴파일 |
| 9 | `useLayout.ts` 생성 | NEW | `app/hooks/useLayout.ts` | TS 컴파일 |
| 10 | `GraphCanvas.tsx` 3줄 변경 | MODIFY | `app/components/GraphCanvas.tsx` | **앱 실행, 레이아웃 동일 확인** |
| 11 | `useElkLayout.ts` 삭제 | DELETE | `app/hooks/useElkLayout.ts` | 빌드 성공, 앱 정상 |

---

## 호환성 및 리스크

### `radial` 레이아웃

현재 `radial`은 실제 구현이 없어 `tree`(단방향 ELK)로 fallback됩니다.
`getLayoutStrategy('radial')`은 `?? strategies.tree`로 동일하게 fallback합니다.

### `GraphState.layoutType`

리팩토링 후 이 필드는 레이아웃 dispatch에 직접 사용되지 않습니다.
(각 `MindMapGroup`이 자신의 `layoutType`을 가지므로)
하지만 `page.tsx`와 `setGraph` 시그니처에서 사용 중이므로 제거하지 않습니다.

### 콘솔 로그

`[ELK Layout]` → `[Layout]`으로 변경됩니다.
Strategy 내부에서는 로그를 출력하지 않습니다 (파이프라인 훅만 로그).

---

## 향후 확장 시 변경점

새 레이아웃(예: `treemap`) 추가 시:

```
1. app/utils/strategies/treemapStrategy.ts 생성 (LayoutStrategy 구현)
2. app/utils/strategies/registry.ts에 1줄 추가
3. app/utils/strategies/index.ts에 1줄 추가
4. app/store/graph.ts MindMapGroup.layoutType에 'treemap' 추가
5. libs/core/src/components/MindMap.tsx layout prop에 'treemap' 추가
```

파이프라인 훅(`useLayout.ts`), GraphCanvas, globalLayoutResolver 등은 **변경 불필요**.
