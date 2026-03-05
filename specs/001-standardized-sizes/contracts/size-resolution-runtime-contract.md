# Contract: Size Resolution Runtime

## 목적

size 입력(`fontSize`, `size`)을 렌더 직전 최종 수치로 변환하는 런타임 계약을 정의한다.

## Scope

- 대상: Text / Sticky / Shape / Markdown
- 제외: Sequence size token, Sticker 2D token

## Resolver Entry Points

| Entry | Input | Output |
|------|-------|--------|
| `resolveSize(value, category)` | `number \| SizeToken` | category 기준 px 수치 |
| `normalizeObjectSizeInput(size)` | `ObjectSizeInput` | `NormalizedSizeInput` |
| `resolveObject2D(normalized)` | `NormalizedSizeInput` | `{ widthPx, heightPx, ratioUsed }` |
| `resolveMarkdownSize(size)` | `MarkdownSizeInput` | 1D or 2D resolved result |

## Category Defaults

- `typography`: `m`
- `space`: `m`
- `object2d`: `auto`

## Input Interpretation Rules

1. Text `fontSize`
   - `number` -> 그대로 사용
   - `token` -> typography 스케일로 해석
2. Sticky/Shape `size`
   - `number` -> primitive token과 동일 경로 + 컴포넌트 기본 ratio
   - `token` -> object2d 스케일 + 기본 ratio
   - `auto` 또는 size 미지정 -> 콘텐츠 기반 자동 크기(프레임 미고정)
   - `{ token, ratio }` -> 명시 ratio 적용
   - `{ widthHeight }` -> `{ width, height }` 동시 지정으로 정규화
   - `{ width, height }` -> 최우선 explicit 치수
   - Shape 기본 ratio: `rectangle=landscape`, `circle/triangle=square`
3. Markdown `size`
   - 단일 값(`number|token`) -> 1D 스케일
   - object 입력 -> 2D 스케일

## Ratio Rules

- 허용 ratio: `landscape | portrait | square`
- `portrait`: landscape width/height 스왑
- 미지원 ratio: warning + `landscape` fallback
- `Shape(circle|triangle)`에서 non-square ratio는 warning + `square` 정규화

## Conflict Rules

- 하나의 2D 입력에 충돌 모드가 동시에 존재하면 invalid로 처리
- invalid 입력은 warning + category default fallback

## Warning Contract

| Code | Trigger | Fallback |
|------|---------|----------|
| `UNSUPPORTED_TOKEN` | registry에 없는 token | category default |
| `UNSUPPORTED_RATIO` | 허용 enum 외 ratio | `landscape` |
| `CONFLICTING_SIZE_INPUT` | 2D 입력 모드 충돌 | category default |
| `UNSUPPORTED_LEGACY_SIZE_API` | 공식 계약 외 legacy width/height 사용 | warning + ignore |

- 개발/운영 환경 모두 동일한 warning 정책을 사용한다.

## Determinism Requirements

1. 동일 category + 동일 token은 항상 동일 수치를 반환해야 한다.
2. 동일 입력은 컴포넌트와 무관하게 동일한 normalized 결과를 생성해야 한다.
3. fallback 결과는 환경/세션에 따라 달라지면 안 된다.

## Verification Contract

- 토큰 해석 lookup은 상수 시간이어야 한다.
- parser 저장 포맷은 원본 입력(number/token/object)을 유지해야 한다.
- 렌더러는 정규화 -> 해석 단일 경로를 사용해야 한다.
