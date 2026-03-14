# Contract: Create Placement

## 목적

웹에서 신규 오브젝트를 생성할 때 Canvas absolute 생성과 MindMap child/sibling 생성을 구분하는 placement rule을 정의한다.

## Placement Modes

### `canvas-absolute`

- 입력: `x`, `y`
- 결과: top-level Canvas scope에 새 element 삽입
- 기본 prop: absolute position + component-specific defaults

### `mindmap-child`

- 입력: `parentId`
- 결과: 선택 부모를 기준으로 새 child 생성
- 기본 prop: `from=parentId`

### `mindmap-sibling`

- 입력: `siblingOf`, `parentId`
- 결과: 같은 부모를 공유하는 새 sibling 생성
- root sibling이면 `from` 없이 생성 가능

## Insertion Rules

- create는 가장 가까운 semantic scope에 삽입되어야 한다.
- source provenance에 따라 `filePath`와 local `sourceId`를 존중해야 한다.
- frame/local scope가 있는 경우 rendered id가 아닌 local id 기준으로 생성 위치를 계산해야 한다.

## Behavioral Guarantees

- 동일 placement mode는 동일 insertion policy를 따른다.
- create는 기존 subtree를 재정렬하지 않는다.
- 생성 즉시 렌더 가능하고, TSX는 유효한 JSX를 유지해야 한다.

## Out of Scope

- freehand multi-create
- bulk paste/import
