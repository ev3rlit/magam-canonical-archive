# Contract: Content Kind Boundary

## 목적

content 계약을 style capability와 분리하고, 강한 semantic boundary를 유지한다.

## Content Kinds

```ts
type ContentKind = 'text' | 'markdown' | 'media' | 'sequence';
```

## Rules

1. object는 동시에 하나의 declared `content.kind`만 가진다.
2. `content:text`: plain text payload만 가진다.
3. `content:markdown`: markdown source payload만 가진다.
4. `content:media`: `src` 필수, `alt/fit/size`를 가진다.
5. `content:sequence`: 구조화 participants/messages를 가진다.
6. declared content kind와 맞지 않는 필드는 허용하지 않는다.
7. content kind 검증은 style capability 검증과 별도로 수행한다.

## Alias Binding

- `Image` -> `content:media`
- `Markdown` -> `content:markdown`
- `Sequence` -> `content:sequence`

## Diagnostic Contract

- content-kind mismatch는 normalization 또는 validation 단계에서 명시적으로 reject한다.
- 오류는 위반 필드 경로를 포함해야 한다.

## Failure Contract

- content payload 위반: `CONTENT_CONTRACT_VIOLATION`
- role/content 불일치: `INVALID_CONTENT_ROLE_BINDING`
