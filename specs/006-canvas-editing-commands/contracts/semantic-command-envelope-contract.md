# Contract: Semantic Command Envelope

## 목적

웹 편집 조작을 TSX patch 가능한 단일 계약으로 정규화한다.

## Envelope

```ts
type EditCommandEnvelope = {
  commandId: string;
  type:
    | 'node.move.absolute'
    | 'node.move.relative'
    | 'node.content.update'
    | 'node.style.update'
    | 'node.rename'
    | 'node.reparent'
    | 'node.create'
    | 'mindmap.child.create'
    | 'mindmap.sibling.create';
  filePath: string;
  baseVersion: string;
  originId: string;
  issuedAt: number;
  target: {
    sourceId: string;
    renderedId?: string;
    scopeId?: string;
    frameScope?: string;
  };
};
```

## Command Payload Rules

- `node.move.absolute`: `{ next:{x,y}, previous:{x,y} }`
- `node.move.relative`: `{ carrier:'gap'|'at.offset', next, previous }`
- `node.content.update`: `{ carrier, next:{content}, previous:{content} }`
- `node.style.update`: `{ patch, previous }` (`styleEditableKeys` whitelist 필수)
- `node.rename`: `{ next:{id}, previous:{id} }`
- `node.reparent`: `{ next:{parentId}, previous:{parentId} }`
- `node.create`/`mindmap.*.create`: `{ create, placement }`

## Validation Contract

1. `baseVersion` mismatch 시 `VERSION_CONFLICT`로 거부한다.
2. `target.sourceId`가 비어 있거나 resolve 실패 시 `NODE_NOT_FOUND`로 거부한다.
3. editable subset 위반 시 `EDIT_NOT_ALLOWED`(신규) 또는 `PATCH_FAILED` 세부코드로 거부한다.
4. command 하나는 단일 target/file만 변경한다.
5. 성공 응답은 `{ success, newVersion, commandId, filePath }`를 반환한다.
