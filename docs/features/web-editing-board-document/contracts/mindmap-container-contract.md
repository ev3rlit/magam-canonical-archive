# Contract: MindMap Container

## 목적

기존 `MindMap` 개념을 typed structural container로 정의한다.

## Contract Surface

`containers.mindmaps[mindmapId]`는 아래 필드를 가진다.

- `id`: string
- `canvasId`: string
- `rootNodeIds`: string[]
- `memberNodeIds`: string[]
- `layout`: object
- `placement?`: object
- `semanticZoom?`: object
- `extensions?`: object

## Layout Policy Contract

`layout.kind`는 현재 코드베이스가 이미 제공하는 레이아웃 family를 기준으로 한다.

- `tree`
- `bidirectional`
- `radial`
- `compact`
- `compact-bidir`
- `depth-hybrid`
- `treemap-pack`
- `quadrant-pack`
- `voronoi-pack`

추가 layout field:

- `spacing?`: number
- `density?`: number
- `direction?`: string
- `branchDirectionByNodeId?`: record

## Placement Contract

MindMap container는 canvas 위 placement policy를 가질 수 있다.

- `x?`, `y?`
- `anchor?`
- `position?`
- `gap?`
- `align?`

## Semantic Zoom Contract

- `semanticZoom.bubbleNodeIds?`: string[]
- bubble 여부는 node content가 아니라 container policy + node state의 조합으로 본다

## Topology Rules

- nested mindmap은 허용하지 않는다
- multi-root mindmap은 허용한다
- `memberNodeIds`에 포함된 모든 node는 동일한 mindmap container에 속한다
- non-root member의 parent 관계는 global `structure` layer에서 해석된다
- explicit edge는 전역 `entities.edges`에 존재할 수 있고, implicit hierarchy edge는 structure로부터 계산될 수 있다

## Allowed Member Kinds

MindMap는 `topic`만 담는 제한된 컨테이너가 아니다. 현재 런타임과 호환되도록 다음 family를 member로 허용한다.

- topic
- shape
- text
- markdown
- image
- sticky-note
- sticker
- washi-tape
- sequence-diagram

## Legacy Mapping

- TSX `<MindMap>`는 `containers.mindmaps` item으로 import 된다
- 현재 `mindMapGroups`에 흩어져 있는 `layoutType`, `spacing`, `density`, `anchor` 정보는 새 schema에서 container policy로 올라간다

## Out of Scope

- layout algorithm 내부 구현 세부
- collaborative topology editing conflict resolution
