# Contract: MindMap Polymorphic Host Node

## 목적

MindMap 내부에서 `Node` 외 임의 컴포넌트가 계층 노드로 참여할 때, core renderer host output과 app parser 간의 입력/해석 계약을 정의한다.

## Producer / Consumer

- Producer: `libs/core` host components (`MindMap`, `Node`, `Sticky`, `Shape`, `Sequence`, `Sticker`, `WashiTape`, `Image`)
- Transport: renderer AST host nodes (`graph-*`)
- Consumer: `app/app/page.tsx` parser + React Flow node/edge builder

## Topology Contract

1. MindMap 컨텍스트 child는 `id`와 `from`을 모두 가져야 한다.
2. MindMap 컨텍스트 child에서 `from` 누락 시 parser는 `MISSING_FROM` 오류를 반환한다.
3. MindMap 내부 `graph-mindmap`는 허용되지 않으며 parser는 `NESTED_MINDMAP` 오류를 반환한다.
4. Canvas 내 sibling MindMap 다중 배치는 허용된다.

## FromProp Contract

| Prop | Required | Type | Notes |
|------|----------|------|-------|
| `from` | Yes (in MindMap child) | `string \| { node: string; edge?: EdgeStyle }` | 계층 관계 + edge 시각 정의 |
| `from.node` | Cond | string | `nodeId`, `nodeId:portId`, `map.nodeId`, `map.nodeId:portId` 지원 |
| `from.edge` | No | `EdgeStyle` | label/stroke/pattern/type/direction 등 |

### Compatibility

- 기존 `edgeLabel`, `edgeClassName` 입력은 parser의 unified edge helper(`buildMindMapEdge`)에서 fallback으로 계속 해석된다.
  - `from.edge.label`이 있으면 우선 적용하고, 없으면 `edgeLabel`을 사용한다.
  - `from.edge.className`이 있으면 우선 적용하고, 없으면 `edgeClassName`을 사용한다.
- WS 편집 경로(`app/ws/filePatcher.ts`, `app/ws/methods.ts`)는 `from` object를 문자열로 강등하지 않고 object shape를 보존한다.
  - id rename 시 `from={{ node, edge }}`의 `node` 참조를 함께 업데이트한다.
  - reparent 시 기존 `from.edge` payload를 유지한 채 `node`만 갱신한다.
- string `from` 입력은 계속 지원한다.

## Parser Mapping Contract

1. MindMap 참여 노드는 visual type과 무관하게 `groupId=mindmapId`를 갖는다.
2. edge 생성은 `parseFromProp()` + `buildMindMapEdge()` 단일 경로로 생성한다.
3. MindMap 참여 노드의 id는 `resolveNodeId` 규칙(스코프 prefix)으로 정규화된다.
4. 그룹 레이아웃은 `groupId` 기반으로 구성되고 node visual type에 의존하지 않는다.

## Error Surface Contract

- parser topology 오류는 렌더 단계에서 삼키지 않고 `setGraphError` 경로로 UI에 노출해야 한다.
- 오류 메시지는 최소한 `mindmapId`와 문제 노드(`nodeId`)를 포함해야 한다.

## Non-Goals

- nested MindMap 레이아웃 지원
- MindMap 컨텍스트에서 암묵 root 추론
- 기존 Canvas-only 노드 배치 규칙 변경
