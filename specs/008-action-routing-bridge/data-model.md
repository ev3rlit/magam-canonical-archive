# Data Model: Action Routing Bridge

## 1) IntentCatalogEntry

- Purpose: UI intent를 canonical 실행 경로로 매핑하는 단위.

| Field | Type | Required | Description |
|------|------|----------|-------------|
| `surface` | `'canvas-toolbar' \| 'selection-floating-menu' \| 'pane-context-menu' \| 'node-context-menu'` | Yes | intent 발신 surface |
| `intent` | string | Yes | 사용자 의도 식별자 |
| `intentType` | `'mutation' \| 'query' \| 'runtime-only'` | Yes | 실행 유형 |
| `dispatchRecipeId` | string | Yes | 실행 레시피 참조 키 |
| `gatingProfile` | string | Yes | 실행 가능성 검증 프로파일 |

### Validation

- `surface + intent` 조합은 중복되면 안 된다.
- `intentType='runtime-only'`이면 canonical mutation action이 포함되면 안 된다.

## 2) BridgeRequest

- Purpose: UI가 bridge에 전달하는 표준 입력 계약.

| Field | Type | Required | Description |
|------|------|----------|-------------|
| `surface` | string | Yes | 요청을 보낸 surface |
| `intent` | string | Yes | 실행할 intent |
| `resolvedContext` | `ResolvedContextSnapshot` | Yes | selection-context-resolver가 해석한 문맥 |
| `uiPayload` | `Record<string, unknown>` | Yes | UI 입력 payload |
| `trigger` | `{ source: 'click' \| 'hotkey' \| 'menu'; actorId?: string }` | Yes | 실행 트리거 메타 |

### Validation

- `resolvedContext`가 없으면 dispatch를 시작하면 안 된다.
- `surface`와 `intent`는 intent catalog에 등록된 조합이어야 한다.

## 3) ResolvedContextSnapshot

- Purpose: bridge가 신뢰하는 실행 문맥 스냅샷.

| Field | Type | Required | Description |
|------|------|----------|-------------|
| `surfaceId` | string | Yes | 현재 surface 식별자 |
| `selection` | `{ nodeIds: string[]; homogeneous: boolean }` | Yes | selection 요약 |
| `target` | `{ canvasNodeId?: string; objectId?: string; relationId?: string }` | No | 대상 식별자 |
| `metadata` | `{ semanticRole?: string; primaryContentKind?: string; capabilities?: string[] }` | Yes | canonical metadata |
| `editability` | `{ canMutate: boolean; allowedCommands: string[]; reason?: string }` | Yes | 실행 가능성 요약 |

### Validation

- `editability.canMutate=false`인 상태에서 mutation intent를 실행하면 안 된다.
- `target.objectId`가 필요한 intent에서 누락되면 정규화 실패로 처리한다.

## 4) NormalizedPayload

- Purpose: canonical executor가 직접 사용할 수 있는 정규화 결과.

| Field | Type | Required | Description |
|------|------|----------|-------------|
| `objectId` | string | No | canonical object id |
| `canvasNodeId` | string | No | canvas node id |
| `relationId` | string | No | relation id |
| `patch` | `Record<string, unknown>` | No | canonical patch payload |
| `runtimeArgs` | `Record<string, unknown>` | No | runtime-only action 인자 |

### Validation

- canonical id 해석 실패 시 정규화는 성공으로 간주하면 안 된다.
- `patch`는 capability/content contract 허용 surface만 포함해야 한다.

## 5) DispatchRecipe

- Purpose: 단일/복합 action 실행 순서와 실패 처리 규칙 정의.

| Field | Type | Required | Description |
|------|------|----------|-------------|
| `id` | string | Yes | 레시피 식별자 |
| `steps` | `DispatchStep[]` | Yes | 순차 실행 단계 |
| `rollbackPolicy` | `'none' \| 'intent-scoped'` | Yes | 롤백 정책 |
| `requiresOptimistic` | boolean | Yes | optimistic 이벤트 필요 여부 |

```ts
type DispatchStep = {
  action: string;
  payloadRef: string;
  onFailure: 'stop' | 'continue';
};
```

### Validation

- 복합 mutation recipe는 step 순서를 유지해야 한다.
- `onFailure='continue'`는 read/query 성격 step에서만 허용한다.

## 6) BridgeResponse

- Purpose: bridge 처리 결과를 surface와 runtime-state에 전달한다.

| Field | Type | Required | Description |
|------|------|----------|-------------|
| `dispatchedActions` | `{ action: string; status: 'applied' \| 'skipped' \| 'failed' }[]` | Yes | 실행 결과 |
| `optimisticToken` | string | No | optimistic 추적 토큰 |
| `rollbackToken` | string | No | rollback 추적 토큰 |
| `error` | `BridgeError` | No | 실패 상세 |

## 7) BridgeError

- Purpose: silent fallback 없이 진단 가능한 오류 전달.

| Field | Type | Required | Description |
|------|------|----------|-------------|
| `code` | `'INVALID_INTENT' \| 'NORMALIZATION_FAILED' \| 'GATE_BLOCKED' \| 'PATCH_SURFACE_VIOLATION' \| 'EXECUTION_FAILED'` | Yes | 오류 코드 |
| `message` | string | Yes | 설명 메시지 |
| `surface` | string | Yes | 오류 발생 surface |
| `intent` | string | Yes | 오류 발생 intent |
| `details` | `Record<string, unknown>` | No | 필드/경로 등 진단 정보 |

## 8) OptimisticLifecycleEvent

- Purpose: apply/commit/reject 이벤트를 runtime-state로 전달.

| Field | Type | Required | Description |
|------|------|----------|-------------|
| `phase` | `'apply' \| 'commit' \| 'reject'` | Yes | 라이프사이클 단계 |
| `intent` | string | Yes | 관련 intent |
| `surface` | string | Yes | 발신 surface |
| `optimisticToken` | string | Yes | optimistic 추적 키 |
| `rollbackToken` | string | No | reject 시 롤백 키 |
| `reason` | string | No | reject 사유 |

## Relationships

- `IntentCatalogEntry`는 `DispatchRecipe`를 1:N으로 참조한다.
- `BridgeRequest`는 하나의 `ResolvedContextSnapshot`을 가진다.
- `BridgeRequest`는 `NormalizedPayload`를 생성해 `DispatchRecipe` 실행에 사용한다.
- `DispatchRecipe` 실행 결과는 `BridgeResponse`와 `OptimisticLifecycleEvent`로 분기된다.
- `BridgeError`는 `BridgeResponse.error`로 surface에 반환된다.

## State Transitions

1. `Received` -> `CatalogMatched`
   - Trigger: `surface + intent` 조합 조회
   - Guard: intent catalog entry 존재
2. `CatalogMatched` -> `Normalized`
   - Trigger: payload normalization
   - Guard: canonical id/reference 해석 성공
3. `Normalized` -> `Gated`
   - Trigger: semantic/capability/editability 검증
   - Guard: gating profile 통과
4. `Gated` -> `Dispatched`
   - Trigger: dispatch recipe 실행
   - Guard: action step 실행 성공
5. `Dispatched` -> `Committed`
   - Trigger: executor 성공 응답
   - Action: optimistic `commit` 발행
6. `Dispatched` -> `Rejected`
   - Trigger: step 실패 또는 executor validation error
   - Action: optimistic `reject`와 `BridgeError` 반환
