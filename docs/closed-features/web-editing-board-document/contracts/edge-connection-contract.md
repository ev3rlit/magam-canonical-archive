# Contract: Edge and Connection

## 목적

board document에서 edge, handle, implicit hierarchy connection을 어떻게 저장하고 해석할지 정의한다.

## Contract Surface

`entities.edges[edgeId]`는 최소 아래 필드를 가진다.

- `id`: string
- `edgeKind`: string
- `source`: endpoint reference
- `target`: endpoint reference
- `label?`: object
- `style?`: object
- `extensions?`: object

endpoint reference는 최소 아래 필드를 가진다.

- `nodeId`: string
- `portId?`: string

## Edge Families

### 1. Explicit Edge

- 사용자가 직접 생성하거나 import된 연결선
- `edgeKind` 예시: `default`, `straight`, `curved`, `step`, `floating`

### 2. Implicit Hierarchy Edge

- mindmap hierarchy에서 구조로부터 유도되는 연결선
- canonical source는 `structure` 또는 container topology이며, edge object는 derived cache일 수 있다

## Port Contract

`entities.nodes[nodeId].ports?`는 handle/port 정의를 포함할 수 있다.

- `id`: string
- `position`: string
- `style?`: object
- `extensions?`: object

port는 renderer-specific handle 이름이 아니라 semantic connection point로 본다.

## MindMap Connection Rule

- mindmap member의 parent-child 연결은 global `structure`가 canonical source다
- 현재 TSX의 `from` prop과 edge style payload는 import 시 hierarchy edge policy와 edge presentation으로 분해 저장한다
- `from` object에 포함된 `edge.label`, `edge.pattern`, `edge.stroke` 같은 값은 implicit hierarchy edge의 style contract로 보존해야 한다

## Behavioral Guarantees

- handle-aware endpoint는 stable node id와 optional port id로 식별할 수 있어야 한다
- unknown edge style extension은 보존되어야 한다
- explicit edge와 implicit hierarchy edge는 의미적으로 구분되어야 한다
- cross-mindmap edge와 canvas-to-mindmap edge를 모두 허용해야 한다

## Relationship to Current Codebase

- 현재 `Edge`와 `EdgePort`가 public surface다
- parser는 `from`/`to` endpoint와 handle suffix를 해석한다
- nested edge와 mindmap implicit edge를 모두 지원한다

## Out of Scope

- collaborative edge routing merge
- advanced orthogonal routing authoring UI
