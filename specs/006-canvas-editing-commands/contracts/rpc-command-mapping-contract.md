# Contract: Semantic Command to RPC Mapping

## 목적

semantic command와 기존 WS RPC 사이의 초기 매핑을 고정한다.

## Mapping Table

| Semantic Command | Transport RPC | Required Params | Server Patcher |
|---|---|---|---|
| `node.move.absolute` | `node.move` | `filePath,nodeId,x,y,baseVersion,originId,commandId` | `patchNodePosition` |
| `node.move.relative` | `node.update` | `filePath,nodeId,props,baseVersion,originId,commandId` | `patchNodeRelativePosition` |
| `node.content.update` | `node.update` | `filePath,nodeId,props.content,...` | `patchNodeContent` |
| `node.style.update` | `node.update` | `filePath,nodeId,props(style only),...` | `patchNodeStyle` |
| `node.rename` | `node.update` | `filePath,nodeId,props.id,...` | `patchNodeRename` |
| `node.reparent` | `node.reparent` | `filePath,nodeId,newParentId,...` | `patchNodeReparent` |
| `node.create` | `node.create` | `filePath,node(create+placement),...` | `patchNodeCreate` |
| `mindmap.child.create` | `node.create` | `filePath,node,placement=child,...` | `patchNodeCreate` |
| `mindmap.sibling.create` | `node.create` | `filePath,node,placement=sibling,...` | `patchNodeCreate` |

## Internal History Inverse

| Internal Command | Transport RPC | Purpose |
|---|---|---|
| `node.delete` | `node.delete` | `node.create` undo/replay inverse |

## Transport Guarantees

- 모든 mutation RPC는 `baseVersion`, `originId`, `commandId`를 필수로 받는다.
- 성공 시 `file.changed` notification에 동일 `originId`, `commandId`를 포함한다.
- 실패 시 표준 에러 코드를 반환한다.

## Error Code Contract

| Code | Message | Meaning |
|---|---|---|
| `40901` | `VERSION_CONFLICT` | 기준 버전 불일치 |
| `40902` | `MINDMAP_CYCLE` | 구조 변경 사이클 감지 |
| `40903` | `ID_COLLISION` | ID 중복 |
| `40401` | `NODE_NOT_FOUND` | 대상 노드/참조 누락 |
| `42201` | `EDIT_NOT_ALLOWED` | editable subset 위반(신규) |
| `50001` | `PATCH_FAILED` | patch 실행 실패 |
