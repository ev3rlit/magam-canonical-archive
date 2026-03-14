# Contract: Board Document Core

## 목적

웹 편집의 canonical board document가 가져야 하는 top-level envelope와 core layer 계약을 정의한다.

## Contract Surface

board document는 nested TSX AST가 아니라 normalized document를 기준으로 저장한다.

### Required Top-Level Fields

- `schemaVersion`: number
- `documentId`: string
- `kind`: `'board'`
- `metadata`: object
- `surfaces`: object
- `containers`: object
- `entities`: object
- `structure`: object
- `presentation`: object
- `state`: object
- `extensions`: object

### Optional Top-Level Fields

- `imports`: legacy import provenance 배열
- `history`: mutation trace 또는 revision metadata

## Core Layer Contract

### 1. Envelope

- document identity, version, timestamps, capability 선언의 기준점이다
- import provenance와 migration metadata는 envelope 레벨에 둔다

### 2. Surfaces

- Canvas 같은 scene root를 정의한다
- surface membership은 container와 standalone node를 함께 다룰 수 있어야 한다

### 3. Containers

- MindMap, frame, group 같은 typed container를 정의한다
- container는 semantic structure와 placement policy를 가진다

### 4. Entities

- `entities.nodes`, `entities.edges`는 stable identifier 기반의 normalized record다
- entity는 canonical meaning만 저장하고 derived render cache는 섞지 않는다

### 5. Structure

- parent, child order, root membership 같은 구조 정보를 직접 저장한다
- direct manipulation 결과를 AST 추론 없이 mutation으로 기록할 수 있어야 한다

### 6. Presentation

- geometry, edge routing, layout result, view preset 같은 시각 정보를 저장한다
- semantic structure와 presentation은 독립적으로 진화할 수 있어야 한다

### 7. State

- collapsed, locked, hidden, pinned처럼 저장해야 하는 편집 상태만 둔다
- selection, hover, drag preview, temporary guide는 runtime-only state다

### 8. Extensions

- 문서 전체와 개별 entity 모두 namespaced extension을 보관할 수 있어야 한다
- 미지원 extension payload는 손실 없이 round-trip 되어야 한다

## Behavioral Guarantees

- 동일한 입력 문서와 layout policy에서는 안정적인 결과를 만들어야 한다
- schema consumer는 알지 못하는 extension을 삭제하거나 임의 재작성하면 안 된다
- legacy import provenance는 re-import 판단과 감사 추적에 사용할 수 있어야 한다
- TSX import와 board mutation은 서로 다른 저장 경로로 분리되어야 한다

## Example Skeleton

```json
{
  "schemaVersion": 1,
  "documentId": "board_01",
  "kind": "board",
  "metadata": {},
  "imports": [],
  "surfaces": {},
  "containers": {},
  "entities": {
    "nodes": {},
    "edges": {}
  },
  "structure": {},
  "presentation": {},
  "state": {},
  "extensions": {}
}
```

## Out of Scope

- 모든 feature subtype payload를 이번 단계에서 완전히 닫는 일
- CRDT/OT merge protocol
- AI chat state
