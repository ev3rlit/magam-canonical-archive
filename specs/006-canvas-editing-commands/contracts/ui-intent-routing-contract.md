# Contract: UI Intent Routing

## 목적

selection, drag, double click, toolbar, context menu에서 발생한 UI intent를 어떤 semantic command로 해석할지 정의한다.

## Routing Rules

### Selection-first

- 편집 command는 selection 또는 명시적 create target에서 시작한다.
- 비선택 노드에는 content/style/rename command를 보내지 않는다.

### Family-based Routing

- `canvas-absolute` -> `node.move.absolute`
- `relative-attachment` -> `node.move.relative`
- `rich-content` -> `node.content.update`
- `mindmap-member` drag/context -> `node.reparent` 또는 `mindmap.*.create`

### Content Carrier Routing

- `label-prop` -> label prop patch
- `text-child` -> text child patch
- `markdown-child` -> markdown child patch

### Style Routing

- UI는 `styleEditableKeys`에 없는 field를 노출하거나 저장하면 안 된다.

### Read-only Routing

- `readOnlyReason`가 있으면 편집 UI는 disabled/read-only 상태를 노출한다.
- read-only 노드는 selection, export, AI targeting은 허용할 수 있다.

## Behavioral Guarantees

- 동일한 UI intent는 동일한 command family로 해석되어야 한다.
- UI heuristic과 patcher heuristic이 서로 달라서는 안 된다.
- unsupported TSX pattern은 저장 시도 전 UI에서 차단되어야 한다.

## Out of Scope

- advanced gesture grammar
- keyboard-only editor mode 전면 설계
