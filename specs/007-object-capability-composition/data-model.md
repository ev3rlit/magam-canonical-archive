# Data Model: Object Capability Composition

## 1) ObjectCore

- Purpose: 모든 일반 canvas object가 공유하는 최소 canonical 뼈대.

| Field | Type | Required | Description |
|------|------|----------|-------------|
| `id` | string | Yes | canonical object 식별자 |
| `position` | `{ x?: number; y?: number }` | No | 절대 배치 좌표 |
| `relations` | `{ from?: unknown; to?: unknown; anchor?: unknown }` | No | 연결/참조 관계 |
| `children` | unknown[] | No | 콘텐츠/하위 표현 |
| `className` | string | No | 공통 스타일 힌트 |
| `sourceMeta` | Record<string, unknown> | Yes | source provenance, alias provenance, edit routing 메타 |

### Validation

- `id`는 source scope 내에서 유일해야 한다.
- `sourceMeta.sourceId`는 문자열이어야 한다.
- core는 role, content kind, capability 선언을 직접 소유하지 않는다.

## 2) SemanticRole

- Purpose: object의 의미 축을 표현한다.

```ts
type SemanticRole =
  | 'topic'
  | 'shape'
  | 'sticky-note'
  | 'image'
  | 'sticker'
  | 'sequence';
```

### Validation

- role은 최소 안정 canonical enum에 포함되어야 한다.
- 새 role은 capability나 content contract만으로 안전하게 표현할 수 없을 때만 추가한다.
- role 자체는 content kind나 capability payload를 자동으로 결정하지 않는다.

## 3) ContentCapability

- Purpose: 본문 계약 축을 독립적으로 표현한다.

```ts
type ContentKind = 'text' | 'markdown' | 'media' | 'sequence';

type ContentCapability =
  | { kind: 'text'; value: string; fontSize?: number }
  | { kind: 'markdown'; source: string; size?: unknown }
  | { kind: 'media'; src: string; alt?: string; fit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down'; width?: number; height?: number }
  | { kind: 'sequence'; participants: unknown[]; messages: unknown[] };
```

### Validation

- object는 동시에 하나의 `content.kind`만 가질 수 있다.
- `kind='media'`이면 `src`는 필수다.
- `kind='markdown'`이면 markdown source string이 필수다.
- `kind='sequence'`는 구조화 payload를 요구한다.
- declared content kind와 맞지 않는 필드는 `CONTENT_CONTRACT_VIOLATION`으로 reject한다.

## 4) CapabilityBag

- Purpose: style 및 배치 기능을 opt-in으로 합성한다.

```ts
type CapabilityBag = {
  frame?: { shape?: string; fill?: string; stroke?: string; strokeWidth?: number };
  material?: { preset?: string; pattern?: unknown };
  texture?: { noiseOpacity?: number; glossOpacity?: number; texture?: unknown };
  attach?: { target?: string; position?: string; offset?: number };
  ports?: { ports: unknown[] };
  bubble?: { bubble: boolean };
  content?: ContentCapability;
};
```

### Validation

- 선언되지 않은 capability key는 reject한다.
- capability payload는 key별 schema를 통과해야 한다.
- `content` 외 capability는 content-kind 전용 필드를 흡수하거나 대체하지 않는다.

## 5) NormalizationSource

- Purpose: canonical capability가 어디서 왔는지 추적해 동일 gate를 적용한다.

```ts
type NormalizationSource = 'explicit' | 'legacy-inferred' | 'alias-default';
```

### Validation

- explicit user capability가 있으면 동일 key에서 `alias-default`보다 우선한다.
- legacy props inference는 explicit metadata가 없을 때만 canonical capability를 채운다.

## 6) CanonicalObject

- Purpose: 내부 render/edit/patch 파이프라인의 단일 canonical 단위.

```ts
type CanonicalObject = {
  core: ObjectCore;
  semanticRole: SemanticRole;
  capabilities: CapabilityBag;
  capabilitySources?: Partial<Record<keyof CapabilityBag, NormalizationSource>>;
  alias?: 'Node' | 'Shape' | 'Sticky' | 'Image' | 'Markdown' | 'Sticker' | 'Sequence';
};
```

### Validation

- `alias='Image'`일 경우 `semanticRole === 'image'` 이고 `capabilities.content.kind === 'media'`여야 한다.
- `alias='Sticky'`일 경우 `semanticRole === 'sticky-note'` 이며, 일부 sticky-default capability가 제거되어도 자동 강등되지 않는다.
- explicit capability 값은 inferred value나 alias default보다 우선한다.
- explicit capability metadata가 없는 legacy alias 입력은 inference를 거친 뒤 동일 canonical validation을 통과해야 한다.

## 7) AliasNormalizationRule

- Purpose: public API alias와 legacy props를 canonical object로 안정적으로 변환한다.

| Alias | Normalized Role | Inference Source | Default Capabilities | Override Behavior |
|------|------------------|------------------|----------------------|-------------------|
| `Node` | `topic` | children, text/markdown legacy props | optional `frame` | explicit content/frame가 우선 |
| `Shape` | `shape` | frame/text legacy props | `frame` | explicit frame/content가 우선 |
| `Sticky` | `sticky-note` | alias provenance, sticky legacy props | `material`, `texture`, `attach`, optional `frame` | explicit override가 일부 defaults를 제거해도 role 유지 |
| `Image` | `image` | `src/alt/fit` legacy props | `content:media` | explicit media fields가 우선 |
| `Markdown` | `topic` | markdown source legacy props | `content:markdown` | explicit markdown fields가 우선 |
| `Sticker` | `sticker` | label/decor legacy props | `frame`, optional `material` | explicit frame/material가 우선 |
| `Sequence` | `sequence` | participants/messages legacy props | `content:sequence`, optional `frame` | explicit sequence payload가 우선 |

## 8) CapabilityProfile

- Purpose: renderer/editability/patcher가 같은 gate를 사용하도록 policy를 공유한다.

```ts
type CapabilityProfile = {
  allowedUpdateKeys: string[];
  allowedCommands: string[];
  readOnlyReason?: string;
  contentCarrier?: string;
};
```

### Validation

- `allowedUpdateKeys`는 capability registry와 content contract에서 유도되어야 한다.
- legacy-inferred object와 explicit object는 동일 canonical profile 규칙을 공유해야 한다.
- content contract가 강한 object는 profile에 content-specific command만 포함해야 한다.

## 9) ValidationResult

- Purpose: normalization 및 patch 단계의 실패를 구조화한다.

| Field | Type | Required | Description |
|------|------|----------|-------------|
| `ok` | boolean | Yes | 유효성 통과 여부 |
| `code` | string | No | `EDIT_NOT_ALLOWED`, `INVALID_CAPABILITY`, `CONTENT_CONTRACT_VIOLATION`, `LEGACY_INFERENCE_FAILED` 등 |
| `message` | string | No | 사용자/개발자 진단 메시지 |
| `path` | string | No | 실패 필드 경로 |

## Relationships

- `CanonicalObject.core` -> `ObjectCore` (1:1)
- `CanonicalObject.semanticRole` -> `SemanticRole` (1:1)
- `CanonicalObject.capabilities` -> `CapabilityBag` (1:1)
- `CanonicalObject.capabilitySources` -> `NormalizationSource` map (0..1)
- `CapabilityBag.content` -> `ContentCapability` (0..1)
- `AliasNormalizationRule`는 alias/legacy 입력을 `CanonicalObject`로 변환한다.
- `CapabilityProfile`은 `CanonicalObject` 기반으로 계산된다.
- `ValidationResult`는 normalization, routing, patch 단계의 실패를 표현한다.

## State Transitions

1. `AliasOrLegacyInput` -> `InferredCapabilities`
   - Trigger: parser가 public alias component와 legacy props를 해석
   - Guard: alias provenance 또는 legacy prop surface가 식별 가능
2. `InferredCapabilities` -> `NormalizedCanonical`
   - Trigger: explicit capability, legacy inference, alias defaults를 precedence order로 병합
   - Guard: role/content/capability mapping rule 통과
3. `NormalizedCanonical` -> `CapabilityValidated`
   - Trigger: capability registry와 content contract 검증
   - Guard: unknown capability, invalid payload, content-kind mismatch 없음
4. `CapabilityValidated` -> `Routed`
   - Trigger: renderer/editability/patcher routing
   - Guard: capability profile와 semantic role 규칙 충족
5. `Routed` -> `Patched`
   - Trigger: 허용 command 실행
   - Guard: capability profile의 allowed surface 준수
6. Any -> `Rejected`
   - Trigger: validation failure
   - Action: structured `ValidationResult` 반환
