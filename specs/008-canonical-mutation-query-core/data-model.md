# Data Model: Canonical Mutation Query Core

## 1) CanonicalQueryRequest

- Purpose: canonical object와 document/surface를 부분 조회하기 위한 표준 입력.

| Field | Type | Required | Description |
|------|------|----------|-------------|
| `workspaceId` | string | Yes | query ownership boundary |
| `documentId` | string | No | document/surface query 대상 |
| `surfaceId` | string | No | surface 범위 제한 |
| `filters.semanticRole` | string[] | No | canonical semantic role filter |
| `filters.primaryContentKind` | string[] | No | content kind filter |
| `filters.hasCapability` | string[] | No | capability key filter |
| `filters.alias` | string[] | No | alias provenance filter |
| `include` | string[] | Yes | `objects`, `relations`, `canvasNodes`, `bindings`, `documentRevision` 등 응답 subset |
| `limit` | number | No | 최대 결과 수 |
| `cursor` | string | No | pagination cursor |
| `bounds` | object | No | viewport/surface bounding query |

### Validation

- `include`에는 지원된 리소스 키만 허용된다.
- `limit`은 양의 정수여야 한다.
- `cursor`는 불투명 토큰으로 처리하며 adapter가 의미를 해석하지 않는다.
- `bounds`는 숫자 기반 좌표 경계를 가져야 한다.

## 2) CanonicalQueryResultEnvelope

- Purpose: transport-neutral query 응답 표준 단위.

| Field | Type | Required | Description |
|------|------|----------|-------------|
| `ok` | boolean | Yes | success 여부 |
| `data.objects` | array | Conditional | `include`에 요청된 canonical objects |
| `data.relations` | array | Conditional | `include`에 요청된 object relations |
| `data.canvasNodes` | array | Conditional | `include`에 요청된 canvas nodes |
| `data.bindings` | array | Conditional | `include`에 요청된 canvas bindings |
| `data.documentRevision` | object | Conditional | document head revision info |
| `page.cursor` | string | No | 다음 페이지 cursor |
| `errors` | array | No | query 실패 또는 부분 실패 진단 |

### Invariants

- `include`에 없는 데이터는 응답에 포함되지 않는다.
- cursor는 deterministic traversal을 깨지 않는 방식으로 생성된다.

## 3) CanonicalMutationEnvelope

- Purpose: canonical domain mutation 의도를 표현하는 표준 요청 단위.

| Field | Type | Required | Description |
|------|------|----------|-------------|
| `workspaceId` | string | Yes | mutation ownership boundary |
| `documentId` | string | Yes | revision stream boundary |
| `baseRevision` | string | Yes | optimistic concurrency 기준 token |
| `actor.kind` | string | Yes | `user`, `agent`, `system` |
| `actor.id` | string | Yes | actor identifier |
| `operations` | array | Yes | ordered mutation operation list |
| `requestId` | string | No | transport correlation id |

### Operation Families

```ts
type MutationOperation =
  | { op: 'object.update-core'; objectId: string; patch: Record<string, unknown> }
  | { op: 'object.update-content'; objectId: string; content: Record<string, unknown> }
  | { op: 'object.body.replace'; objectId: string; blocks: ContentBlock[] }
  | { op: 'object.body.block.insert'; objectId: string; block: ContentBlock; at: number }
  | { op: 'object.body.block.update'; objectId: string; blockId: string; patch: Record<string, unknown> }
  | { op: 'object.body.block.remove'; objectId: string; blockId: string }
  | { op: 'object.body.block.reorder'; objectId: string; order: string[] }
  | { op: 'object.patch-capability'; objectId: string; patch: Record<string, unknown> }
  | { op: 'object.relation.upsert'; relation: Record<string, unknown> }
  | { op: 'object.relation.remove'; relationId: string }
  | { op: 'canvas-node.move'; nodeId: string; next: Record<string, unknown> }
  | { op: 'canvas-node.reparent'; nodeId: string; parentNodeId: string | null }
  | { op: 'canvas-node.create'; node: Record<string, unknown> }
  | { op: 'canvas-node.remove'; nodeId: string };
```

### Validation

- `operations`는 최소 1개 이상이어야 한다.
- operation order는 executor가 유지하며 일부 operation은 선행 결과에 의존할 수 있다.
- capability/content/content-block 규칙 위반은 operation 단위 실패로 진단된다.

## 4) CanonicalMutationResultEnvelope

- Purpose: mutation execution 결과를 transport-neutral하게 반환하는 표준 단위.

| Field | Type | Required | Description |
|------|------|----------|-------------|
| `ok` | boolean | Yes | mutation 성공 여부 |
| `code` | string | No | 실패 코드 (`VERSION_CONFLICT`, validation code 등) |
| `message` | string | No | 실패 메시지 |
| `path` | string | No | 실패 지점 |
| `details` | object | No | 추가 진단 |
| `appliedOperations` | array | No | 성공 반영된 operation id/summary |
| `changedSet` | object | No | 변경 object/node/relation/revision 집합 |
| `revision.before` | string | No | 실행 전 revision token |
| `revision.after` | string | No | 실행 후 revision token |

### Invariants

- 성공 응답에는 `revision.after`와 `changedSet`이 반드시 존재한다.
- 충돌 응답에는 `expected`/`actual` head 정보가 포함된다.
- validation 실패는 절대 success-shaped envelope로 반환되지 않는다.

## 5) ValidationFailure

- Purpose: domain validation 실패를 표준화한 진단 단위.

| Field | Type | Required | Description |
|------|------|----------|-------------|
| `code` | string | Yes | canonical validation code |
| `message` | string | Yes | human-readable failure summary |
| `path` | string | No | invalid field path |
| `details` | object | No | contextual diagnostics |

### Expected Codes

- `INVALID_CAPABILITY`
- `INVALID_CAPABILITY_PAYLOAD`
- `CONTENT_CONTRACT_VIOLATION`
- `INVALID_CONTENT_BLOCK`
- `CONTENT_BODY_CONFLICT`
- `EDITABLE_OBJECT_REQUIRES_CLONE`
- `PATCH_SURFACE_VIOLATION`

## 6) RevisionState

- Purpose: mutation ordering과 optimistic concurrency를 제어하는 상태 단위.

| Field | Type | Required | Description |
|------|------|----------|-------------|
| `documentId` | string | Yes | revision stream identifier |
| `headRevision` | string | Yes | current revision token |
| `revisionNo` | number | Yes | monotonic revision number |
| `lastMutationAt` | string | No | latest mutation timestamp |

## Relationships

- `CanonicalMutationEnvelope`는 하나의 `RevisionState`를 기준으로 실행된다.
- `CanonicalMutationEnvelope.operations[*]`는 `CanonicalObjectRecord`, `ObjectRelationRecord`, `CanvasNodeRecord`를 변경한다.
- `CanonicalMutationResultEnvelope.changedSet`은 query에서 다시 조회 가능한 최소 변경 단위를 제공한다.
- `CanonicalQueryRequest`와 `CanonicalQueryResultEnvelope`는 같은 filter/include vocabulary를 공유한다.

## State Transitions

1. `CanonicalMutationEnvelope(baseRevision=head)` -> `Applied`
2. `CanonicalMutationEnvelope(baseRevision!=head)` -> `Conflict`
3. `Applied` -> `RevisionState(revisionNo + 1, new token)`
4. `ValidationFailure` -> `Rejected` (no revision advance)

## Invariants

- 동일 base revision + 동일 operation 집합은 동일 결과를 생성해야 한다.
- 실패한 mutation은 revision을 advance하지 않는다.
- `changedSet`은 최소 하나 이상의 변경 엔터티를 가져야 한다(성공 시).
- query 응답의 resource vocabulary는 mutation changed-set vocabulary와 일치해야 한다.

