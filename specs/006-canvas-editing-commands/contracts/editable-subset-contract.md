# Contract: Editable Subset

## 목적

웹 편집이 허용되는 TSX 패턴과 거부 패턴을 명확히 분리한다.

## Allowed Patterns

- literal `id`, `x`, `y`, `gap`
- object literal `at` (partial merge 허용)
- 단순 text child
- `<Markdown>{`...`}</Markdown>` child
- 명시적 style prop(`pattern`, `fill`, `stroke`, `fontSize` 등 whitelist)
- `from` string 또는 `{ node, edge? }` object

## Blocked / Read-Only Patterns

- JSX spread props (`<Node {...props} />`)
- 계산식 기반 id/position (`id={makeId()}`, `x={a+b}`)
- 복합 조건부 children 구조로 carrier 판정 불가한 경우
- resolve 불가능한 cross-scope 참조

## Family/Command Matrix

| Family | Allowed Commands | Reject Policy |
|---|---|---|
| `canvas-absolute` | move.absolute, content.update, style.update, create | 비허용 command는 `EDIT_NOT_ALLOWED` |
| `relative-attachment` | move.relative, style.update | absolute move는 거부 |
| `mindmap-member` | reparent, child/sibling create, content/style update | cycle/scope 위반 거부 |
| `rich-content` | content.update, style.update | carrier 불명확 시 거부 |

## Client Contract

- `editMeta.readOnlyReason`이 있으면 mutation 트리거를 비활성화한다.
- read-only 노드는 selection/inspect는 허용하고 저장 시도는 하지 않는다.

## Server Contract

- client가 read-only를 우회해도 서버가 editable subset을 재검증한다.
- 위반 시 부분 patch 없이 reject한다.
