# Contract: Dispatch Descriptor

## 목적

bridge가 반환하는 실행 계획을 제한된 형태로 고정해 실행 경로를 예측 가능하게 유지한다.

## Descriptor Types

```ts
type DispatchKind =
  | 'canonical-mutation'
  | 'canonical-query'
  | 'runtime-only-action';

type DispatchDescriptor = {
  kind: DispatchKind;
  actionId: string;
  payload: Record<string, unknown>;
  optimisticMeta?: Record<string, unknown>;
};

type OrderedDispatchPlan = {
  intentId: string;
  steps: DispatchDescriptor[];
  rollbackPolicy?: Record<string, unknown>;
};
```

## Rules

1. bridge 출력은 세 가지 `kind`만 허용한다.
2. 하나의 intent가 다중 step을 가지면 bridge가 ordered plan을 구성한다.
3. surface는 step 순서와 내부 실행 로직을 알지 못해야 한다.
4. `runtime-only-action`은 mutation/query와 같은 plan 안에서 순서 조정 가능해야 한다.
5. 빈 step plan은 유효하지 않다.

## Failure Contract

- `DISPATCH_PLAN_INVALID`
- `RUNTIME_ACTION_ORDER_CONFLICT`
