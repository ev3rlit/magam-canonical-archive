# Contract: TSX Patch Surface

## 목적

각 semantic command가 TSX에서 어느 surface만 수정할 수 있는지 고정한다.

## Allowed Patch Surface

### `node.move.absolute`

- 허용: `x`, `y`
- 비허용: `id`, `from`, `children`, style props

### `node.move.relative`

- 허용: `gap` 또는 `at.offset`
- 비허용: `anchor`, `at.target`, `at.align`, `at.span`, `at.placement`

### `node.content.update`

- 허용: `label` 또는 text child 또는 markdown child
- 비허용: 다른 prop, sibling 구조 재작성

### `node.style.update`

- 허용: `styleEditableKeys` whitelist field
- 비허용: `id`, `from`, `to`, `anchor`, children carrier 변경

### `node.rename`

- 허용: `id` + reference rewrite surface
- 비허용: reference와 무관한 literal string field 변경

### `node.create`

- 허용: 신규 JSX element 1건 삽입 + placement mode에 따른 최소 필수 prop
- 비허용: 기존 sibling bulk reorder, unrelated subtree rewrite

### `node.reparent`

- 허용: `from`
- 비허용: node body, other props, unrelated edges

## Behavioral Guarantees

- patch 결과는 command의 allowed surface를 벗어나면 안 된다.
- patcher는 기존 JSX 구조를 최대한 보존해야 한다.
- patcher는 불명확한 carrier 또는 dynamic expression을 silent fallback으로 처리하면 안 된다.

## Out of Scope

- formatting stability 보장
- arbitrary JSX normalization
