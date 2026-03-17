# Contract: Alias Normalization

## 목적

공개 API alias와 legacy props를 canonical object로 일관되게 변환하는 규칙을 정의한다.

## Mapping

| Public Alias | Canonical Role | Inference Sources | Alias Defaults | Keep as Public Alias |
|---|---|---|---|---|
| `Node` | `topic` | children, text/markdown legacy props | optional `frame` | Yes |
| `Shape` | `shape` | frame/text legacy props | `frame` | Yes |
| `Sticky` | `sticky-note` | sticky legacy props, alias provenance | `material`, `texture`, `attach`, optional `frame` | Yes |
| `Image` | `image` | `src/alt/fit` legacy props | `content:media` | Yes |
| `Markdown` | `topic` | markdown source legacy props | `content:markdown` | Yes |
| `Sticker` | `sticker` | label/decor legacy props | `frame`, optional `material` | Yes |
| `Sequence` | `sequence` | participants/messages legacy props | `content:sequence`, optional `frame` | Yes |

## Resolution Order

1. explicit user capability declarations
2. capability values inferred from legacy props
3. alias preset defaults for still-missing fields

## Sticky Semantic Rule

- `Sticky`는 독립 primitive가 아니라 capability preset alias로 해석한다.
- `Sticky` alias로 작성된 객체는 일부 sticky-default capability가 제거되어도 canonical `semanticRole`을 `sticky-note`로 유지한다.
- parser와 editor는 이러한 객체를 일반 object로 자동 강등하지 않는다.

## Legacy Compatibility Rule

1. explicit capability metadata가 없는 legacy alias 입력도 canonical object로 정규화되어야 한다.
2. alias 직렬화 경로는 사용자 작성 경험을 깨지 않아야 한다.
3. canonical 내부 모델 수는 alias 추가로 증가하지 않아야 한다.

## Failure Contract

- alias 변환 실패: `ALIAS_NORMALIZATION_FAILED`
- alias/role 불일치: `INVALID_ALIAS_ROLE_BINDING`
- legacy capability 추론 실패: `LEGACY_INFERENCE_FAILED`
