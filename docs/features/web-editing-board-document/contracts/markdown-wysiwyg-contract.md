# Contract: Markdown and WYSIWYG

## 목적

markdown source와 WYSIWYG 편집 경험의 저장 경계를 정의한다.

## Canonical Storage Rule

- markdown의 canonical persisted form은 markdown source string이다
- WYSIWYG는 편집 UX일 뿐, 별도의 canonical rich-text document를 저장하지 않는다

## Contract Surface

markdown content는 최소 아래 필드를 가진다.

- `content.kind`: `'markdown'`
- `content.source`: string
- `content.variant?`: `'default' | 'minimal'`
- `content.size?`: size payload

## WYSIWYG Contract

- 편집 중 preview와 저장 후 렌더는 같은 markdown renderer 규칙을 사용해야 한다
- editor selection, composition state, cursor position, draft preview layout 같은 값은 runtime-only state다
- markdown source를 생성하지 못하는 HTML snapshot 저장은 허용하지 않는다

## Supported Experience Boundary

현재 코드베이스 기준으로 WYSIWYG는 full rich-text CRDT editor가 아니라 아래 경험을 의미한다.

- markdown source 수정
- 같은 renderer를 사용하는 live preview
- 선택된 단일 노드 중심 편집 세션

## Relationship to Node Taxonomy

- `markdown` node kind는 markdown-centric block node다
- `topic`, `shape`, `sticky-note`, `sticker` 안에도 markdown content block이 들어갈 수 있다
- bubble/semantic zoom 여부는 markdown content 자체가 아니라 container/node policy에서 관리한다

## Behavioral Guarantees

- preview와 saved render의 시각 결과는 가능한 한 1:1로 맞춰야 한다
- external asset, code block, table, internal link는 저장 시 markdown source로 보존되어야 한다
- unsupported syntax는 조용히 손실시키지 말고 그대로 source에 남겨야 한다

## Out of Scope

- 별도의 rich-text canonical document
- collaborative cursor state
- AI-assisted markdown authoring
