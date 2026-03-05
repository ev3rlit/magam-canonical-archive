# Data Model: Standardized Size Language

## 1) SizeToken

- Purpose: 의도 기반 사이즈 레벨을 표현하는 공통 라벨.

### Type

```ts
interface SizeTokenRegistry {
  xs: true;
  s: true;
  m: true;
  l: true;
  xl: true;
}

type SizeToken = keyof SizeTokenRegistry & string;
type Object2DSizeToken = SizeToken | 'auto';
```

### Rules

- 기본 토큰 집합은 위 5개를 사용한다.
- 확장 토큰은 registry 확장 규칙으로 추가 가능해야 한다.

## 2) SizeCategoryScale

- Purpose: 동일 token이 카테고리별로 어떻게 수치화되는지 정의.

| Category | Token Result |
|------|------|
| `typography` | font-size px + line-height px |
| `space` | spacing px |
| `object2d` | width/height px + ratio 규칙 |

### Baseline Table (Tailwind 3.4.3)

| Token | Typography | Line Height | Space | Object2D Landscape | Object2D Square |
|------|------------|-------------|-------|--------------------|-----------------|
| `xs` | 12 | 16 | 8  | 128x80 | 80x80 |
| `s`  | 14 | 20 | 12 | 160x96 | 96x96 |
| `m`  | 16 | 24 | 16 | 192x120 | 120x120 |
| `l`  | 18 | 28 | 24 | 256x160 | 160x160 |
| `xl` | 20 | 28 | 32 | 320x200 | 200x200 |

## 3) SizeRatio

- Purpose: 2D 오브젝트의 방향/형상 의도를 표현.

```ts
type SizeRatio = 'landscape' | 'portrait' | 'square';
```

### Rules

- 기본 ratio는 `landscape`.
- `portrait`는 landscape width/height 스왑으로 계산.
- 미지원 ratio는 warning 후 `landscape` fallback.

## 4) 1D Input Models

### FontSizeInput (Text)

```ts
type FontSizeInput = number | SizeToken;
```

### Markdown1DInput

```ts
type Markdown1DInput = number | SizeToken;
```

## 5) 2D Input Models

### ObjectSizeInput (Sticky/Shape)

```ts
type SizeValue = number | SizeToken;
type Object2DSizeValue = number | Object2DSizeToken;

type ObjectSizeInput =
  | Object2DSizeToken
  | number
  | { token: Object2DSizeToken; ratio?: SizeRatio }
  | { widthHeight: Object2DSizeValue }
  | { width: SizeValue; height: SizeValue };
```

- primitive `number`/`token` 입력은 컴포넌트 기본 ratio 규칙으로 해석한다.
- `auto`는 콘텐츠 기반 자동 크기를 의미하며, `size` 미지정 시에도 기본적으로 `auto`로 해석한다.
- `Shape` 기본 ratio: `rectangle=landscape`, `circle/triangle=square`.

### MarkdownSizeInput

```ts
type MarkdownSizeInput =
  | SizeValue                    // 1D
  | { token: Object2DSizeToken; ratio?: SizeRatio } // 2D
  | { widthHeight: Object2DSizeValue }   // 2D
  | { width: SizeValue; height: SizeValue }; // 2D
```

### Validation

- 하나의 2D object 입력에서 충돌 모드가 동시에 존재하면 invalid.
- invalid 입력은 warning 후 category default fallback.

## 6) NormalizedSizeInput

- Purpose: 다양한 입력 형태를 내부 공통 형태로 정규화.

| Field | Type | Required | Description |
|------|------|----------|-------------|
| `mode` | `'auto' \| 'token' \| 'uniform' \| 'explicit'` | Yes | 해석 모드 |
| `token` | `Object2DSizeToken \| null` | Cond | token 모드 값 |
| `ratio` | `SizeRatio` | Yes | 2D 방향(기본 landscape) |
| `width` | `SizeValue \| null` | Cond | explicit width |
| `height` | `SizeValue \| null` | Cond | explicit height |
| `source` | string | Yes | 원본 입력 경로(`fontSize`, `size`, etc) |

## 7) ResolvedSize

### ResolvedTypography

| Field | Type | Required | Description |
|------|------|----------|-------------|
| `fontSizePx` | number | Yes | 최종 font-size |
| `lineHeightPx` | number | Yes | 최종 line-height |
| `tokenUsed` | SizeToken | No | token 기반일 때 사용 |

### ResolvedObject2D (`mode='fixed'`)

| Field | Type | Required | Description |
|------|------|----------|-------------|
| `widthPx` | number | Yes | 최종 width |
| `heightPx` | number | Yes | 최종 height |
| `ratioUsed` | SizeRatio | Yes | 최종 ratio |
| `tokenUsed` | SizeToken | No | token 기반일 때 사용 |

### ResolvedObject2D (`mode='auto'`)

| Field | Type | Required | Description |
|------|------|----------|-------------|
| `mode` | `'auto'` | Yes | 콘텐츠 기반 자동 크기 |
| `ratioUsed` | SizeRatio | Yes | 컨텍스트 기본 ratio(참고값) |
| `tokenUsed` | `'auto'` | Yes | auto 토큰 사용 표시 |

## 8) SizeWarningEvent

- Purpose: 미지원 입력/충돌 입력 관측을 표준화.

| Field | Type | Required | Description |
|------|------|----------|-------------|
| `code` | `'UNSUPPORTED_TOKEN' \| 'UNSUPPORTED_RATIO' \| 'CONFLICTING_SIZE_INPUT' \| 'UNSUPPORTED_LEGACY_SIZE_API'` | Yes | 경고 분류 |
| `component` | string | Yes | 발생 컴포넌트 |
| `inputPath` | string | Yes | 문제 입력 경로 |
| `fallbackApplied` | string | Yes | 적용된 fallback 설명 |

## Relationships

- `SizeToken` -> `SizeCategoryScale` (1:N)
- `ObjectSizeInput`/`MarkdownSizeInput` -> `NormalizedSizeInput` (N:1 normalize)
- `NormalizedSizeInput` -> `ResolvedTypography`/`ResolvedObject2D` (1:1 resolve)
- 경고 발생 시 `SizeWarningEvent`가 생성되고 fallback 결과와 연결

## State Transitions

1. `RawInputReceived` -> `Normalized`
   - Trigger: `fontSize`/`size` 입력 파싱
   - Action: union 입력을 `NormalizedSizeInput`으로 변환
2. `Normalized` -> `Validated`
   - Trigger: token/ratio/충돌 규칙 검증
   - Action: 유효 입력은 통과, 무효 입력은 warning 이벤트 생성
3. `Validated` -> `Resolved`
   - Trigger: category resolver 실행
   - Action: 최종 px 수치(`ResolvedSize`) 산출
4. `Resolved` -> `Rendered`
   - Trigger: node renderer style/class 적용
   - Action: React Flow UI 반영
5. `InvalidInput` -> `FallbackResolved`
   - Trigger: unsupported token/ratio 또는 충돌 입력
   - Action: category default fallback으로 해석 후 렌더 지속
