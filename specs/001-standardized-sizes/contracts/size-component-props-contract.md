# Contract: Standardized Size Component Props

## 목적

표준 사이즈 언어 도입 시 `@magam/core` 공개 컴포넌트 props와 app parser 소비 계약을 정의한다.

## Producer / Consumer

- Producer: `libs/core/src/components/*` (`Text`, `Sticky`, `Shape`, `Markdown`, `Sequence`)
- Transport: renderer host AST (`graph-*` props)
- Consumer: `app/features/render/parseRenderGraph.ts`, `app/components/nodes/*`

## Public Prop Contract

### Text

| Prop | Required | Type | Notes |
|------|----------|------|-------|
| `fontSize` | No | `number \| SizeToken` | token-first, number-compatible |

### Sticky

| Prop | Required | Type | Notes |
|------|----------|------|-------|
| `size` | No | `ObjectSizeInput` | `number`/`token`/`auto`/object union 지원 |
| `width`/`height` | No | legacy experimental | 공식 계약 외, 런타임 warning+ignore |

### Shape

| Prop | Required | Type | Notes |
|------|----------|------|-------|
| `size` | No | `ObjectSizeInput` | `number`/`token`/`auto`/object union 지원 |
| `type` | No | `'rectangle' \| 'circle' \| 'triangle' \| string` | 기본 ratio 정책 결정(`rectangle=landscape`, `circle/triangle=square`) |
| `width`/`height` | No | legacy experimental | 공식 계약 외, 런타임 warning+ignore |

### Markdown

| Prop | Required | Type | Notes |
|------|----------|------|-------|
| `size` | No | `MarkdownSizeInput` | 단일 값=1D, object=2D(`auto` 지원) |

### Sequence

| Prop | Required | Type | Notes |
|------|----------|------|-------|
| `size` | No | N/A | v1 범위 제외 (size 토큰 미지원) |
| `participantSpacing` | No | number | 현행 계약 유지 |
| `messageSpacing` | No | number | 현행 계약 유지 |

### Sticker

| Prop | Required | Type | Notes |
|------|----------|------|-------|
| `size` | No | N/A | 2D size token 대상 제외 (content-driven) |

## Ratio Contract

- 허용값: `landscape | portrait | square`
- 미지원 ratio: warning + `landscape` fallback
- 단, `Shape`의 `circle/triangle`은 ratio 입력이 있더라도 warning 후 `square`로 정규화한다.

## Parser Mapping Contract

1. parser는 원본 `size`/`fontSize` 입력을 보존해야 한다.
2. parser는 컴포넌트별 size 계약 범위를 기준으로 data payload를 구성한다.
3. Sequence/Stickers는 size token 확장 경로에서 제외한다.
4. app-side resolver는 렌더 직전에 단일 경로로 수치 해석한다.

## Compatibility Contract

- `fontSize={number}`는 계속 지원한다.
- `Markdown size={number}`는 1D 해석으로 지원한다.
- `Sticky/Shape size={number}`는 지원하며 primitive token과 동일 경로로 해석한다.
- `size={{ width, height }}`는 token/number 혼합을 지원한다.

## Non-Goals

- Sequence size token 지원
- Sticker 2D size token 강제
- className 기반 사이즈 유틸을 우선 인터페이스로 채택
