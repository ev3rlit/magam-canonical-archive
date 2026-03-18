# Contract: Optimistic Rollback

## 목적

optimistic 실행과 rollback 처리에 필요한 metadata 계약을 bridge descriptor에 고정한다.

## Optimistic Metadata

```ts
type OptimisticMeta = {
  pendingKey: string;
  baseVersion: string;
  rollbackSteps: Array<Record<string, unknown>>;
};
```

## Rules

1. optimistic intent는 descriptor에 `pendingKey`와 `baseVersion`을 반드시 포함한다.
2. 실패 시 rollback은 descriptor에 명시된 `rollbackSteps`를 기준으로 수행한다.
3. bridge는 오류를 성공 모양으로 변환하지 않는다.
4. validation/rpc 오류 코드는 canonical contract를 유지한 채 surface까지 전달한다.
5. pending 상태 정리 없이 요청 lifecycle을 종료하면 안 된다.

## Failure Contract

- `OPTIMISTIC_CONFLICT`
- `ROLLBACK_FAILED`
- canonical mutation/query core validation error code set
