# Contract: Washi Tape RPC Editing

## 목적

WebSocket JSON-RPC 편집 경로(`app/ws/methods.ts`, `app/ws/filePatcher.ts`)에서 `washi-tape` 타입을 생성/수정할 때의 입력 검증과 동작 계약을 명시한다.

## Methods

### `node.create`

- Request envelope는 기존 공통 필드(`filePath`, `baseVersion`, `originId`, `commandId`)를 유지한다.
- `node.type` 허용 목록에 `washi-tape`를 추가한다.

#### Node Payload

| Field | Required | Type | Description |
|------|----------|------|-------------|
| `node.id` | Yes | string | 생성할 노드 ID |
| `node.type` | Yes | `'shape' \| 'text' \| 'markdown' \| 'mindmap' \| 'sticker' \| 'washi-tape'` | 노드 타입 |
| `node.props` | No | object | JSX props로 변환될 속성 |

#### Behavior

1. `washi-tape` 생성 시 file patcher는 `<WashiTape ... />` JSX를 생성한다.
2. `baseVersion` 충돌 시 `VERSION_CONFLICT`를 반환한다.
3. 성공 시 `{ success: true, newVersion, commandId }`를 반환하고 `file.changed` 알림을 발행한다.

### `node.update`

- 기존 노드 식별(`nodeId`) 및 부분 props 패치 계약을 그대로 사용한다.
- `washi-tape` 전용 props(`pattern`, `at`, `edge`, `texture`, `text`, `seed`, `opacity`)를 패치 가능해야 한다.

### `node.move`

- `washi-tape`도 다른 노드와 동일하게 `x`, `y` 갱신 계약을 따른다.

## Error Contract

| Error | Condition |
|------|-----------|
| `INVALID_PARAMS` | `node.type` 또는 필수 필드가 유효하지 않음 |
| `VERSION_CONFLICT` | `baseVersion` 불일치 |
| `PATCH_FAILED` | AST 패치 실패 |
| `NODE_NOT_FOUND` | update/move 대상 노드 미존재 |

## Compatibility Notes

- 기존 `sticker` 테스트는 유지되어야 한다.
- `washi-tape` 추가로 기존 타입의 직렬화/패치 결과가 변경되면 안 된다.
- WS 이벤트 자기 반영 차단(`originId + commandId`) 규칙은 기존과 동일하게 유지한다.
