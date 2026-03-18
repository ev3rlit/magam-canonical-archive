# Data Model: Action Routing Bridge

## 1) UIIntentEnvelope

- Purpose: UI surface가 bridge로 전달하는 공통 입력 단위.

| Field | Type | Required | Description |
|------|------|----------|-------------|
| `surfaceId` | `'toolbar' \| 'selection-floating-menu' \| 'pane-context-menu' \| 'node-context-menu'` | Yes | intent 발화 surface 식별자 |
| `intentId` | string | Yes | registry lookup key |
| `selectionRef` | object | Yes | selection-context-resolver 결과 참조 |
| `targetRef` | object | No | 특정 node/object 대상 참조 |
| `rawPayload` | Record<string, unknown> | Yes | UI 원본 payload |
| `optimistic` | boolean | Yes | optimistic 처리 필요 여부 |

### Validation

- `surfaceId`는 허용된 surface 집합에 속해야 한다.
- `intentId`는 빈 문자열이면 안 된다.
- `selectionRef`는 실행 시점 selection snapshot을 가리켜야 한다.

## 2) IntentRegistryEntry

- Purpose: intent별 규칙(노출 조건, 정규화, dispatch 생성)을 표현한다.

| Field | Type | Required | Description |
|------|------|----------|-------------|
| `intentId` | string | Yes | registry key |
| `supportedSurfaces` | string[] | Yes | 허용 surface 목록 |
| `isEnabled` | function | Yes | selection + metadata 기반 gating 함수 |
| `normalizePayload` | function | Yes | raw -> canonical payload 변환 |
| `buildDispatch` | function | Yes | dispatch descriptor(plan) 생성 |

### Validation

- `supportedSurfaces`에 없는 surface에서 호출되면 `INTENT_SURFACE_NOT_ALLOWED`를 반환한다.
- `normalizePayload`는 canonical payload 계약 위반 시 명시적 오류를 반환한다.

## 3) DispatchDescriptor

- Purpose: bridge가 실행기에 전달하는 최소 실행 단위.

```ts
type DispatchKind = 'canonical-mutation' | 'canonical-query' | 'runtime-only-action';
```

| Field | Type | Required | Description |
|------|------|----------|-------------|
| `kind` | DispatchKind | Yes | 실행 유형 |
| `actionId` | string | Yes | canonical action 또는 runtime action 식별자 |
| `payload` | Record<string, unknown> | Yes | 실행 payload |
| `optimisticMeta` | object | No | optimistic/rollback 메타 |

### Validation

- `kind`는 세 가지 허용 값 중 하나여야 한다.
- `canonical-*` kind는 mutation/query core contract actionId를 사용해야 한다.

## 4) OrderedDispatchPlan

- Purpose: 하나의 intent 실행에 필요한 descriptor 집합과 순서를 정의한다.

| Field | Type | Required | Description |
|------|------|----------|-------------|
| `intentId` | string | Yes | 원본 intent 식별자 |
| `steps` | DispatchDescriptor[] | Yes | 실행 순서가 보장된 descriptor 목록 |
| `rollbackPolicy` | object | No | 중간 실패 시 롤백 기준 |

### Validation

- `steps`는 비어 있으면 안 된다.
- `runtime-only-action` 선행/후행 순서는 intent 규칙에 따라 결정 가능해야 한다.

## 5) OptimisticPendingRecord

- Purpose: optimistic 실행 중 상태 추적과 rollback 연결.

| Field | Type | Required | Description |
|------|------|----------|-------------|
| `pendingKey` | string | Yes | pending 식별자 |
| `baseVersion` | string | Yes | concurrency guard |
| `intentId` | string | Yes | 원본 intent |
| `rollbackSteps` | DispatchDescriptor[] | Yes | 실패 시 복구 단계 |
| `startedAt` | number | Yes | 타임스탬프 |

### Validation

- `pendingKey`는 활성 pending 집합에서 유일해야 한다.
- 실패 시 `rollbackSteps` 실행 여부가 명시적으로 기록되어야 한다.

## 6) BridgeError

- Purpose: bridge 단계의 실패를 구조화하여 surface와 ws에서 공통 처리.

| Field | Type | Required | Description |
|------|------|----------|-------------|
| `code` | string | Yes | 오류 코드 |
| `message` | string | Yes | 사용자/개발자 진단 메시지 |
| `details` | Record<string, unknown> | No | 실패 context |

### Canonical Codes

- `INTENT_NOT_REGISTERED`
- `INTENT_SURFACE_NOT_ALLOWED`
- `INTENT_GATING_DENIED`
- `INTENT_PAYLOAD_INVALID`
- `DISPATCH_PLAN_INVALID`
- `OPTIMISTIC_CONFLICT`

## Relationships

- `UIIntentEnvelope.intentId` -> `IntentRegistryEntry.intentId`
- `IntentRegistryEntry.buildDispatch` -> `OrderedDispatchPlan`
- `OrderedDispatchPlan.steps[]` -> `DispatchDescriptor`
- `DispatchDescriptor.optimisticMeta` -> `OptimisticPendingRecord`
- Bridge/WS failure path -> `BridgeError`

## State Transitions

1. `Received`
   - Input: `UIIntentEnvelope`
2. `Registered`
   - Condition: `intentId`가 registry에 존재
3. `Gated`
   - Condition: `isEnabled` 통과
4. `Normalized`
   - Condition: canonical payload 생성
5. `Planned`
   - Condition: `OrderedDispatchPlan` 생성
6. `OptimisticPending` (optional)
   - Condition: `optimistic=true` + pending record 생성
7. `Dispatched`
   - Condition: step 실행 완료
8. `Committed` or `RolledBack`
   - Condition: 전체 성공 또는 실패 복구
9. `Failed`
   - Condition: 어느 단계에서든 `BridgeError` 발생
