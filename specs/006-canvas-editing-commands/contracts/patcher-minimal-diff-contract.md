# Contract: Patcher Minimal Diff Rules

## 목적

command별 patcher가 의도 필드 외 변경을 만들지 않도록 강제한다.

## Patcher Rules

### `patchNodePosition`

- 허용 변경: `x`, `y`
- 금지 변경: `id`, `children`, `from`, `to`, `anchor`, style/content 필드

### `patchNodeRelativePosition`

- 허용 변경: `gap` 또는 `at.offset`
- 금지 변경: `anchor`, `at.target`, `at.placement`, 관계 필드 삭제

### `patchNodeContent`

- 허용 변경: `label` 또는 text/markdown child content
- 금지 변경: 위치/관계/스타일 필드

### `patchNodeStyle`

- 허용 변경: `styleEditableKeys` whitelist key
- 금지 변경: `id`, `from`, `to`, `anchor`, `children` 구조

### `patchNodeRename`

- 허용 변경: `id` + 참조 surface rewrite(`from`,`to`,`anchor`, 필요 시 `from.node`)
- 금지 변경: 비참조 필드의 동반 수정

### `patchNodeCreate`

- 허용 변경: 새 element 삽입 + placement에 필요한 최소 필드
- 금지 변경: 기존 sibling/children 대규모 재정렬

### `patchNodeReparent`

- 허용 변경: `from` (`string` 또는 object `node`)
- 금지 변경: edge payload 손실, cycle 허용

## Shared Guarantees

1. patch 실패 시 파일은 변경되지 않는다.
2. 명령 1건은 단일 의도 변경으로 끝나야 한다.
3. formatter/attribute order는 불필요하게 변경하지 않는다.
4. regression 테스트는 각 patcher의 금지 변경을 명시적으로 검증한다.
