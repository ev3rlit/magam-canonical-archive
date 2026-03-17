# Contract: Capability Declaration

## 목적

object capability 선언 범위, precedence, payload 검증 규칙을 고정한다.

## Allowed Capabilities

```ts
type CapabilityKey =
  | 'frame'
  | 'material'
  | 'texture'
  | 'attach'
  | 'ports'
  | 'bubble'
  | 'content';
```

## Payload Rules

- `frame`: `shape/fill/stroke/strokeWidth`
- `material`: `preset/pattern`
- `texture`: `noiseOpacity/glossOpacity/texture`
- `attach`: `target/position/offset`
- `ports`: `ports[]`
- `bubble`: `bubble:boolean`
- `content`: 별도 content-kind 계약 적용

## Resolution Rules

1. explicit user capability가 alias preset default보다 우선한다.
2. legacy prop inference는 explicit capability metadata가 없을 때만 canonical capability를 채운다.
3. alias preset default는 여전히 비어 있는 값만 보완한다.

## Validation Contract

1. allow-list 밖 capability key는 허용하지 않는다.
2. capability payload는 key별 schema를 통과해야 한다.
3. capability 누락은 허용되지만, 선언 시 유효성 위반은 실패로 처리한다.
4. preset default는 explicit user capability를 덮어쓰면 안 된다.

## Failure Contract

- unknown capability: `INVALID_CAPABILITY`
- invalid payload: `INVALID_CAPABILITY_PAYLOAD`
