# Contract: MindMap Polymorphic RPC Editing

## 목적

WebSocket JSON-RPC 편집 경로(`app/ws/methods.ts`, `app/ws/filePatcher.ts`)에서 `from` 다형성(string/object)과 MindMap topology 정책이 손실 없이 round-trip 되도록 계약을 정의한다.

## Scope

- `node.create`
- `node.update`
- `node.reparent`
- `node.move` (위치 이동 자체는 기존 계약 유지)

## Payload Contract

| Field | Required | Type | Description |
|------|----------|------|-------------|
| `node.id` | Yes | string | 노드 식별자 |
| `node.type` | Yes | string | 지원 host 노드 타입 |
| `node.props.from` | Cond | `string \| { node: string; edge?: EdgeStyle }` | MindMap child 관계 선언 |
| `node.props.id` | Yes | string | JSX id prop |
| `baseVersion` | Yes | string | optimistic concurrency 버전 |
| `originId` | Yes | string | self-event 방지용 client id |
| `commandId` | Yes | string | idempotency/echo suppression 키 |

## Behavior Contract

1. `node.update`는 `from` object를 부분 병합이 아닌 값 단위로 보존/대체해야 한다.
2. `node.reparent`는 `from`이 string일 때는 string 변경, object일 때는 `from.node`만 변경하고 `from.edge`는 보존해야 한다.
3. id 변경/리네임 시 `from` 참조 경로(string/object 모두)를 일관되게 갱신해야 한다.
4. `node.move`는 기존 규칙 유지하되 MindMap topology 정책(`from` 필수)과 충돌하지 않아야 한다.

## Validation & Errors

| Error | Condition |
|------|-----------|
| `INVALID_PARAMS` | `from` 타입 불일치, 필수 필드 누락 |
| `VERSION_CONFLICT` | `baseVersion` 불일치 |
| `NODE_NOT_FOUND` | 대상 노드 없음 |
| `PATCH_FAILED` | AST patch 실패 |

### Topology-related Notes

- RPC 자체가 topology를 최종 검증하지 않더라도, 저장된 결과는 parser 단계에서 동일 정책(`MISSING_FROM`, `NESTED_MINDMAP`)으로 검증돼야 한다.
- invalid topology 저장 시 다음 render cycle에서 UI 오류가 일관되게 노출되어야 한다.

## Compatibility

- legacy `from="id"` payload는 기존처럼 동작해야 한다.
- 신규 `from={{ node, edge }}` payload는 손실 없이 저장/재열기/재편집되어야 한다.
- 기존 non-MindMap 노드 편집 흐름에는 회귀가 없어야 한다.
