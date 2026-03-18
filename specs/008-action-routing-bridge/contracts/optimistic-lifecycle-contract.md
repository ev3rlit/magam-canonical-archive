# Contract: Optimistic Lifecycle

## 목적

optimistic apply/commit/reject 이벤트 계약을 공통화하고 ui-runtime-state와 책임을 분리한다.

## Event Shape

```ts
type OptimisticLifecycleEvent = {
  phase: 'apply' | 'commit' | 'reject';
  surface: string;
  intent: string;
  optimisticToken: string;
  rollbackToken?: string;
  reason?: string;
};
```

## Rules

1. optimistic가 필요한 mutation intent는 `apply` 이벤트를 먼저 발행한다.
2. 모든 성공 흐름은 동일 token으로 `commit` 이벤트를 발행한다.
3. 실패 흐름은 동일 token으로 `reject` 이벤트를 발행하고 실패 원인을 포함한다.
4. pending state 저장/표시는 `ui-runtime-state`가 담당하며 bridge는 이벤트만 발행한다.
5. bridge는 rollback을 generic success-like 응답으로 감추지 않는다.

## Failure Contract

- token 누락 이벤트: `EXECUTION_FAILED`
- reject reason 누락: `EXECUTION_FAILED`
