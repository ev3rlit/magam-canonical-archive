# Contract: Bridge Intent Envelope

## 목적

모든 UI surface가 bridge에 전달하는 입력 계약을 고정한다.

## Input Shape

```ts
type SurfaceId =
  | 'toolbar'
  | 'selection-floating-menu'
  | 'pane-context-menu'
  | 'node-context-menu';

type UIIntentEnvelope = {
  surfaceId: SurfaceId;
  intentId: string;
  selectionRef: Record<string, unknown>;
  targetRef?: Record<string, unknown>;
  rawPayload: Record<string, unknown>;
  optimistic: boolean;
};
```

## Rules

1. `surfaceId`는 허용된 4개 surface 중 하나여야 한다.
2. `intentId`는 bridge registry에 등록된 key여야 한다.
3. `selectionRef`는 최신 selection context snapshot이어야 한다.
4. surface는 envelope 생성 외에 mutation/query 실행 책임을 갖지 않는다.
5. envelope 검증 실패는 즉시 오류로 반환한다.

## Failure Contract

- `INTENT_NOT_REGISTERED`
- `INTENT_SURFACE_NOT_ALLOWED`
- `INTENT_PAYLOAD_INVALID`
