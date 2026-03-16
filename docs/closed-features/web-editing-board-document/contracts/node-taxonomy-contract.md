# Contract: Node Taxonomy

## 목적

board document에서 사용하는 canonical node kind와 각 kind의 의미를 고정한다.

## Core Rule

`entities.nodes[nodeId]`는 최소 아래 공통 필드를 가진다.

- `id`: string
- `nodeKind`: string
- `content`: object
- `extensions?`: object

geometry, layout result, selection 같은 값은 node object 바깥의 `presentation` 또는 `state`에서 관리한다.

## Canonical Node Kinds

### 1. `topic`

- 일반적인 mindmap 주제 노드
- legacy `<Node>` import의 기본 canonical target이다
- `content.kind`는 `plain-text` 또는 `markdown`을 허용한다

### 2. `shape`

- rectangle, circle, triangle 같은 시각적 shape node
- `content.kind`는 `plain-text`, `rich-inline`, `markdown`을 허용한다
- shape family는 semantic topic과 구분되는 visual primitive다

### 3. `text`

- standalone typographic node
- content는 plain text 중심이다

### 4. `markdown`

- markdown source가 canonical content인 block node
- WYSIWYG 편집을 제공하더라도 저장 포맷은 markdown source string이다

### 5. `image`

- workspace asset 또는 external asset을 참조하는 image node
- `src`, `alt`, `fit` 같은 media metadata를 가진다

### 6. `sticky-note`

- paper note semantics를 가진 note node
- material pattern, paper texture, note shape, attach placement를 가진다
- 기존 `Sticky` 개념의 canonical target이다

### 7. `sticker`

- die-cut decoration 또는 label semantics를 가진 decoration node
- outline, padding, rotation, sticker shadow, image/emoji/svg child를 가진다
- 기존 `Sticker` 개념의 canonical target이다

### 8. `washi-tape`

- segment 또는 attach 기반 tape overlay node
- `at`, `pattern`, `texture`, `text`, `resolvedGeometry`를 가진다

### 9. `sequence-diagram`

- participant/message를 내장한 structured composite node
- 현재 runtime 지원 범위를 기준으로 canonical node kind로 유지한다

### 10. `adapter-widget`

- 외부 차트/그래프/커스텀 시각화를 adapter/plugin contract로 마운트하는 node
- canonical 저장값은 executable TSX가 아니라 `adapterId`, serialized `props`, serialized `data`, capability metadata다
- 내부 렌더링은 adapter registry가 담당한다

## Important Distinction

`sticker`와 `sticky-note`는 절대 같은 node kind가 아니다.

- `sticky-note`는 메모형 paper node다
- `sticker`는 decoration/label node다
- 현재 TSX patcher의 legacy create 경로에서 `sticker -> <Sticky>`로 매핑되는 동작은 canonical schema에 가져오지 않는다

## Content Contract

node kind와 content kind는 분리한다.

- `plain-text`
- `markdown`
- `rich-inline`
- `media`
- `structured-sequence`

같은 node kind라도 content kind가 다를 수 있다. 예를 들어 `topic`은 plain-text 또는 markdown을 가질 수 있다.

## Behavioral Guarantees

- node kind는 semantic role을 나타내고, pure render cache와 섞이지 않아야 한다
- node kind rename이나 merge는 breaking change다
- same-kind node는 동일한 최소 contract를 공유해야 한다

## Out of Scope

- 모든 style token catalog를 이번 단계에서 확정하는 일
- AI chat message node
- arbitrary TSX component를 native editable object로 직렬화하는 일
