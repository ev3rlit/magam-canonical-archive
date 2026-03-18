# Contract: Bridge Request/Response

## 목적

모든 entrypoint surface가 동일한 dispatch 인터페이스를 사용하게 고정한다.

## Request Shape

```ts
type BridgeRequest = {
  surface: string;
  intent: string;
  resolvedContext: unknown;
  uiPayload: Record<string, unknown>;
  trigger: { source: 'click' | 'hotkey' | 'menu'; actorId?: string };
};
```

## Response Shape

```ts
type BridgeResponse = {
  dispatchedActions: Array<{ action: string; status: 'applied' | 'skipped' | 'failed' }>;
  optimisticToken?: string;
  rollbackToken?: string;
  error?: {
    code: string;
    message: string;
    surface: string;
    intent: string;
    details?: Record<string, unknown>;
  };
};
```

## Rules

1. request에 `resolvedContext`가 없으면 dispatch를 시작하지 않는다.
2. response는 성공/실패와 무관하게 `dispatchedActions`를 포함한다.
3. 오류 응답은 `surface`와 `intent`를 반드시 포함한다.
4. bridge는 오류를 swallowed 하지 않고 구조화된 error를 반환한다.

## Failure Contract

- context 누락: `NORMALIZATION_FAILED`
- action 실행 실패: `EXECUTION_FAILED`
