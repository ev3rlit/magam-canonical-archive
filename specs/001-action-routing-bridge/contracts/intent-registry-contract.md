# Contract: Intent Registry

## 목적

intent 등록, gating, payload normalization 책임을 bridge 내부에서 일관되게 소유한다.

## Registry Entry

```ts
type IntentRegistryEntry = {
  intentId: string;
  supportedSurfaces: string[];
  isEnabled: (context: Record<string, unknown>) => boolean;
  normalizePayload: (raw: Record<string, unknown>) => Record<string, unknown>;
  buildDispatch: (normalized: Record<string, unknown>) => Record<string, unknown>;
};
```

## Rules

1. UI surface는 직접 분기 규칙을 구현하지 않고 registry lookup 결과만 사용한다.
2. gating은 `semanticRole`, `primaryContentKind`, capability profile, selection context만 사용한다.
3. renderer/tag 이름 기반 분기를 신규 규칙으로 추가하면 안 된다.
4. normalization은 raw payload를 canonical action payload로만 변환한다.
5. 미등록 intent 호출은 즉시 실패해야 한다.

## Failure Contract

- `INTENT_NOT_REGISTERED`
- `INTENT_GATING_DENIED`
- `INTENT_PAYLOAD_INVALID`
