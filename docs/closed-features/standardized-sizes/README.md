# Standardized Sizes PRD (Unified `xs~xl` for 1D/2D)

## 1) 배경

현재 Magam의 크기 제어는 숫자 기반(`number`)이 중심입니다.

- `Text.fontSize`, `Shape.labelFontSize`, edge label `fontSize`는 수치 입력이 기본입니다.
- `Sticky`, `Markdown`, `Sequence Diagram`도 직관적인 토큰 중심 크기 언어가 약합니다.
- 2차원 오브젝트(`Sticky`, `Shape` 등)는 특히 직사각형 조합이 많은데, 이를 공통 토큰으로 맞추기 어렵습니다.

이번 기획의 핵심은 다음입니다.

1. 기존 `number` 호환을 유지한다.
2. 1차원/2차원 모두 `xs | s | m | l | xl` 토큰을 기본 언어로 제공한다.
3. 정사각형 중심이 아니라 직사각형 조합(landscape/portrait) 중심 모듈러 규칙을 공식화한다.

---

## 2) 문제 정의

### 사용자 관점
1. 숫자만 보고 실제 크기를 직관적으로 판단하기 어렵다.
2. 동일한 시각 위계를 맞추려면 반복적인 미세 조정이 필요하다.
3. 2D 블록을 조합할 때 크기 규칙이 없어서 레이아웃이 들쭉날쭉해진다.

### 제품/아키텍처 관점
1. 컴포넌트별 개별 숫자 관행이 생겨 토큰 재사용이 어렵다.
2. 텍스트(1D)와 박스(2D) 사이즈 체계가 분리되어 일관성이 약하다.
3. 기능 확장 시 크기 정책 드리프트와 회귀 위험이 커진다.

---

## 3) 목표와 비목표

### 목표 (Goals)
1. `number | token` union 타입으로 숫자/토큰 입력을 동시 지원한다.
2. 사이즈 입력은 컴포넌트별 단일 prop 인터페이스로 통일한다.
3. 1D(폰트/간격)와 2D(폭/높이) 모두 `xs~xl` 기반 토큰을 도입한다.
4. 2D는 직사각형 조합을 기본으로 하며, 필요 시 정사각형도 지원한다.
5. `Sticky`, `Text`, `Markdown`, `Shape` 포함 주요 객체에서 동일한 사이즈 언어를 사용한다.
6. `Markdown`은 `size` 단일 prop으로 1D/2D를 모두 지원한다.
7. 통일된 prop 계약 내에서는 `number | token` 호환을 유지한다.

### 비목표 (Non-Goals)
1. v1에서 좌표(`x`, `y`)나 회전 등 모든 수치형 속성을 토큰화하지 않는다.
2. Experimental 단계의 레거시 크기 API(`width`/`height` 분리 등)는 deprecated 단계 없이 v1에서 지원하지 않는다.
3. `Sequence Diagram`의 size 토큰 도입은 v1 범위에 포함하지 않는다.
4. 반응형 브레이크포인트 시스템 전면 개편은 포함하지 않는다.

---

## 4) 사이즈 모델

### 4.1 공통 타입

```ts
export interface SizeTokenRegistry {
  xs: true;
  s: true;
  m: true;
  l: true;
  xl: true;
}

export type SizeToken = keyof SizeTokenRegistry;
export type SizeValue = number | SizeToken;
export type Object2DSizeToken = SizeToken | 'auto';
export type Object2DSizeValue = number | Object2DSizeToken;

export type SizeRatio = 'landscape' | 'portrait' | 'square';

// 1D 전용 (Text 등)
export type FontSizeInput = number | SizeToken;

// 2D 전용 (Sticky/Shape 등) - 단일 size prop에 주입
export type ObjectSizeInput =
  | Object2DSizeToken
  | number
  | { token: Object2DSizeToken; ratio?: SizeRatio }
  | { widthHeight: Object2DSizeValue }
  | { width: SizeValue; height: SizeValue };

// Markdown 전용 - 단일 size prop으로 1D/2D 동시 지원
// - primitive(number | token): 1D 모듈러 스케일
// - object input: 2D 폭/높이 스케일
export type MarkdownSizeInput =
  | SizeValue
  | { token: Object2DSizeToken; ratio?: SizeRatio }
  | { widthHeight: Object2DSizeValue }
  | { width: SizeValue; height: SizeValue };

export interface TextSizeProps {
  fontSize?: FontSizeInput;
}

export interface Object2DSizeProps {
  size?: ObjectSizeInput;
}

export interface MarkdownSizeProps {
  size?: MarkdownSizeInput;
}
```

확장 예시:

```ts
declare module '@magam/core' {
  interface SizeTokenRegistry {
    xxl: true;
    hero: true;
  }
}
```

- 기본 문서/예제는 `xs~xl`을 사용합니다.
- 제품/팀 요구가 생기면 registry 확장으로 신규 토큰을 안전하게 추가할 수 있습니다.

### 4.2 카테고리
- `typography`: 폰트 크기 계층
- `space`: padding/gap/spacing 계층
- `object2d`: 오브젝트 폭/높이 계층

### 4.2.1 단일 prop 계약
- TextNode: `fontSize` 단일 prop 사용 (`number | token`)
- Sticky/Shape: `size` 단일 prop 사용 (`number | token | 'auto' | { token, ratio } | { widthHeight } | { width, height }`)
- Markdown: `size` 단일 prop 사용 (primitive=`1D`, object=`2D`)
- Sequence Diagram: v1에서 size 토큰 미지원(현행 구현 유지)
- Sticker: 다이컷 아웃라인 특성상 `size` 단일 prop 비대상(콘텐츠 기반 자동 크기)
- 신규 컴포넌트도 위 규칙을 기본 계약으로 따른다.
- Sticky/Shape의 primitive `number` 입력은 primitive token과 동일한 해석 경로(컴포넌트 기본 ratio)로 처리한다.

### 4.2.2 Width/Height 단일 토큰 입력
- `size={{ widthHeight: 'm' }}` 형태로 width/height를 하나의 토큰으로 동시에 지정할 수 있다.
- 이 입력은 내부적으로 `size={{ width: 'm', height: 'm' }}`와 동일하게 해석한다.
- `size="auto"` 또는 `size={{ token: 'auto' }}`를 사용하면 2D 프레임을 고정하지 않고 콘텐츠 기반 자동 크기를 사용한다.

### 4.2.3 Experimental 제약 (레거시 API)
- 레거시 크기 API(`width`/`height` 분리, 컴포넌트별 legacy alias)는 v1에서 지원하지 않는다.
- deprecated 단계/유예 기간 없이, 문서/타입/예제는 통일된 prop 계약만 노출한다.

예시:

```tsx
<Shape type="rectangle" size={{ token: 's', ratio: 'portrait' }} />
<Sticky id="note-1" size="m" />
```

### 4.3 모듈러 규칙 (직사각형 우선)
- 기본 비율은 `landscape`(가로형)입니다.
- `portrait`는 `landscape`의 축 전환으로 해석합니다.
- `square`는 대칭 구성용 보조 모드입니다.
- 핵심 원칙은 "정수 유닛 조합"입니다. 작은 블록이 큰 블록을 구성할 수 있어야 합니다.

예시(유닛 기반):

```ts
// [widthUnit, heightUnit]
landscape: {
  xs: [2, 1],
  s:  [3, 2],
  m:  [4, 3],
  l:  [6, 4],
  xl: [8, 5],
}
```

### 4.4 기본 수치 기준 (Tailwind 3.4.3 기준점)

`m`은 typography에서 `1rem(16px)`를 기준으로 잡고, 2D는 같은 리듬으로 확장합니다.

| Token | Typography (Tailwind) | Line Height | Space | Object2D Landscape (W x H) | Object2D Square |
|---|---|---|---|---|---|
| `xs` | `text-xs` = 12px | 16px | 8px | 128 x 80 | 80 x 80 |
| `s` | `text-sm` = 14px | 20px | 12px | 160 x 96 | 96 x 96 |
| `m` | `text-base` = 16px | 24px | 16px | 192 x 120 | 120 x 120 |
| `l` | `text-lg` = 18px | 28px | 24px | 256 x 160 | 160 x 160 |
| `xl` | `text-xl` = 20px | 28px | 32px | 320 x 200 | 200 x 200 |

- `portrait`는 landscape 폭/높이를 스왑해 계산합니다.
- 상기 수치는 기본 preset이며, 팀/제품별로 registry에서 조정 가능합니다.
- fallback 기본값은 카테고리 기준으로 고정합니다: `typography=m`, `space=m`, `object2d='auto'`.

### 4.5 도형(Shape) 기준

`Shape`는 type별 기본 ratio를 다음처럼 고정합니다.

1. `rectangle`: 기본 `landscape`
2. `circle`: 기본 `square`
3. `triangle`: 기본 `square`

해석 예시:

```tsx
<Shape type="rectangle" size="m" />                              // 192 x 120
<Shape type="rectangle" size={{ token: 's', ratio: 'portrait' }} /> // 96 x 160
<Shape type="circle" size="m" />                                 // 120 x 120
<Shape type="triangle" size={{ width: 'l', height: 'l' }} />     // 160 x 160
```

- `size={{ width, height }}`가 들어오면 해당 값이 최우선입니다.
- `size={{ widthHeight: token }}`는 width/height 동시 지정 축약 문법입니다.
- `circle`, `triangle`에서 `ratio`가 들어오면 경고 로그를 남기고 `square`로 정규화합니다.

### 4.6 Sticker 정책 (다이컷 아웃라인)
- Sticker는 다이컷 아웃라인이 콘텐츠 형태를 따라가므로, 오브젝트 자체 `size`를 토큰으로 강제하지 않는다.
- Sticker의 외곽 크기는 콘텐츠/패딩/아웃라인 렌더 규칙에서 자동 결정된다.
- 따라서 v1에서 Sticker는 2D `size` 토큰 대상에서 제외한다.

---

## 5) 사용자 시나리오

### 시나리오 A: 텍스트 위계 선언
1. 사용자가 `<Text fontSize="l">`처럼 토큰을 입력한다.
2. 렌더러가 `typography` 스케일에서 수치로 해석한다.
3. 숫자값을 몰라도 의도된 위계를 즉시 만든다.

### 시나리오 B: 2D 스티키 블록 조합
1. 사용자가 `<Sticky size={{ token: 'm', ratio: 'landscape' }}>`를 선언한다.
2. 폭/높이가 `object2d` 스케일에서 유닛 기반으로 계산된다.
3. 다른 스티키/도형과의 정렬, 조합, 확장이 쉬워진다.

### 시나리오 C: Markdown 밀도/영역 동시 조정
1. 사용자가 `<Markdown size="s">`를 선언해 1D 모듈러 스케일을 적용한다.
2. 필요 시 `<Markdown size={{ token: 'm', ratio: 'landscape' }}>`로 2D 영역을 함께 지정한다.
3. 텍스트 밀도와 박스 크기를 같은 토큰 언어로 제어할 수 있다.

### 시나리오 D: 직사각형 그리드 레이아웃
1. 사용자가 `s`, `m`, `l` 토큰을 섞어 카드 블록을 구성한다.
2. 블록들이 유닛 기반 비율을 공유해 레이아웃 리듬이 유지된다.
3. 화면 전체가 정돈된 모듈러 인상을 갖는다.

---

## 6) 기능 요구사항

### FR-1. Union 타입 입력 지원
- 대상 prop은 union 타입을 통해 숫자 또는 토큰 기반 입력을 허용해야 한다.
- 숫자 입력은 기존 의미를 그대로 유지해야 한다.

수용 기준:
- [AC-01] `fontSize={16}` 기존 동작이 그대로 유지된다.
- [AC-02] `fontSize="m"`이 표준 수치로 해석된다.
- [AC-03] 미지원 토큰은 개발/운영 환경 구분 없이 동일한 warning을 남기고 카테고리 기본값으로 fallback한다.

### FR-1.1 단일 prop 인터페이스 통일
- TextNode 스케일은 `fontSize` 단일 prop으로만 입력받는다.
- 블록 스케일은 `size` 단일 prop으로만 입력받는다.
- `size` 내부 union으로 다양한 입력 방식을 표현한다.

수용 기준:
- [AC-04] Text 계열은 `fontSize` 외 별도 사이즈 prop 없이 동작한다.
- [AC-05] Sticky/Shape/Markdown 계열은 `size` 외 별도 사이즈 prop 없이 동작한다.
- [AC-06] `size`는 `token | number | 'auto' | { token, ratio } | { widthHeight } | { width, height }` 기반 입력을 허용한다(컴포넌트별 계약에 따름).
- [AC-07] `size={{ widthHeight: 'm' }}`가 `size={{ width: 'm', height: 'm' }}`와 동일하게 동작한다.
- [AC-08] Markdown에서 `size` primitive(`number | token`)는 1D, object 입력은 2D로 해석된다.

### FR-2. 중앙화된 사이즈 레지스트리
- 토큰 해석은 단일 공용 resolver에서 수행한다.
- 컴포넌트 내부 하드코딩 매핑은 금지한다.
- 기본 토큰(`xs~xl`) 외 확장 토큰도 동일 경로에서 해석한다.

수용 기준:
- [AC-09] `resolveSize(value, category)` 단일 경로로 숫자 변환된다.
- [AC-10] 토큰 매핑 변경 시 대상 컴포넌트 전반에 일관 반영된다.
- [AC-11] `SizeTokenRegistry` 확장 토큰(예: `xxl`)도 타입/런타임에서 처리 가능하다.

### FR-3. 1D 적용 범위 (v1)
- 최소 적용 대상:
  - `Text` (`fontSize`)
  - `Markdown` (본문 텍스트 모듈러 스케일)
  - `Shape` (`labelFontSize`)
  - `Edge label` (`fontSize`)

수용 기준:
- [AC-12] 대상 범위에서 정의된 입력 모드가 모두 동작한다.
- [AC-13] 타입 자동완성에서 기본 토큰(`xs~xl`)이 노출된다.

### FR-4. 2D 오브젝트 `xs~xl` 토큰 지원
- 2D 오브젝트(`Sticky`, `Shape`, `Markdown`)는 `size` 단일 prop으로 입력을 받는다.
- `size`는 `size="m"`, `size="auto"` 또는 `size={{ token: 'm', ratio: 'portrait' }}`를 지원한다.
- `size={{ widthHeight: 'm' }}`로 width/height를 하나의 토큰으로 지정할 수 있다.
- 필요 시 `size={{ width: 'l', height: 160 }}` 형태 커스텀 입력을 허용한다.
- `Shape`는 type별 기본 ratio를 가진다(`rectangle=landscape`, `circle/triangle=square`).
- `Sticker`는 다이컷 정책으로 본 FR 대상에서 제외한다.

수용 기준:
- [AC-14] `size="m"`만으로 폭/높이 preset이 적용된다.
- [AC-15] `size={{ token: 'm' }}`도 동일하게 동작한다.
- [AC-16] `size={{ token: 'm', ratio: 'portrait' }}`가 올바르게 적용된다.
- [AC-17] `size={{ widthHeight: 'm' }}`가 width/height 동시 지정으로 동작한다.
- [AC-18] `size={{ width, height }}` 지정 시 해당 값이 최우선이다.
- [AC-19] `Shape`의 `circle/triangle`은 기본적으로 정사각형 기준으로 렌더된다.

### FR-5. 모듈러 조합 규칙
- 2D size preset은 정수 유닛 기반으로 정의되어야 한다.
- 서로 다른 크기 조합에서도 그리드 정합성이 유지되어야 한다.

수용 기준:
- [AC-20] `xs~xl` preset이 공통 유닛 배수 규칙을 따른다.
- [AC-21] 주요 2D 노드(`Sticky`, `Shape`, `Markdown`)에서 같은 규칙이 적용된다.

### FR-6. 파서/런타임 계약
- 코드 레벨에서는 원본 입력(`number` 또는 `token`)을 유지한다.
- 렌더 직전에 카테고리 기반 수치로 해석한다.
- 미지원 토큰은 개발/운영 환경 모두 동일하게 `warn + fallback`으로 처리한다.

수용 기준:
- [AC-22] AST/코드 저장 포맷이 불필요하게 숫자로 강제 변환되지 않는다.
- [AC-23] 렌더러는 number/token 입력을 동일 경로로 처리한다.
- [AC-24] 미지원 토큰은 환경 구분 없이 동일 warning 포맷과 fallback 결과를 낸다.

### FR-7. Experimental 전환 정책
- v1은 통일된 사이즈 prop 계약만 공식 지원한다.
- 레거시 크기 API는 deprecated 단계 없이 지원하지 않는다.
- 신규 문서/예제는 토큰 기반 사용을 기본으로 안내한다.

수용 기준:
- [AC-25] 레거시 크기 API는 공식 지원 옵션으로 안내되지 않으며, 런타임 입력 시 warning+ignore로 처리된다.
- [AC-26] 신규 예제에서 1D/2D 모두 통일 prop 계약과 `xs~xl` 표기가 기본값으로 제시된다.

---

## 7) 비기능 요구사항

1. 타입 안정성
- `as any` 없이 명시적 union 타입으로 컴파일 타임 검증이 가능해야 한다.

2. 성능
- 토큰 해석은 상수 시간 lookup 기반이어야 하며 렌더 체감 저하가 없어야 한다.

3. 일관성
- 동일 토큰은 동일 카테고리에서 항상 같은 결과를 낸다.

4. 관측성
- 미지원 토큰/카테고리 입력 시 개발/운영 동일한 warning 포맷으로 원인이 드러나고, 카테고리 기본값으로 fallback되어야 한다.

---

## 8) UX/API 원칙

1. Token-first, Number-compatible
- 문서와 자동완성은 토큰 사용을 먼저 보여주고 숫자는 호환 모드로 유지한다.

2. 직사각형 우선 설계
- 2D 기본은 `landscape`이며, 실제 사용 패턴(문서/노트/다이어그램 카드)에 맞춘다.

3. 의도 중심 선언
- `"s"`, `"m"`, `"xl"`이 의미를 드러내고, 매직 넘버를 최소화한다.

4. Size prop 우선, className 예외
- 크기 의미(폰트/폭/높이/비율)는 `fontSize` 또는 `size` prop으로 먼저 표현한다.
- `className`은 색상/장식/특수 레이아웃 등 예외 스타일 조정(escape hatch) 용도로 제한한다.
- Tailwind 크기 유틸(`text-*`, `w-*`, `h-*`, `min/max-*`)을 사이즈 소스로 우선 사용하지 않는다.

API 예시:

```tsx
<Text id="title" fontSize="xl">Release Plan</Text>
<Text id="caption" fontSize={12}>legacy numeric</Text>

<Sticky id="note-1" size="m">핵심 메모</Sticky>
<Sticky id="note-2" size={{ token: 'm', ratio: 'portrait' }}>세로 메모</Sticky>
<Shape id="card-1" size={{ token: 's', ratio: 'portrait' }}>Service</Shape>
<Sticker id="badge-1">HOT</Sticker> {/* 다이컷 정책: 콘텐츠 기반 자동 크기 */}

<Markdown size="s">{`## 제목`}</Markdown>
<Markdown size={{ token: 'm', ratio: 'landscape' }}>{`## 본문`}</Markdown>
<Markdown size={{ widthHeight: 'l' }}>{`## 정사각형 카드`}</Markdown>
```

---

## 9) 기술 설계 개요

### 9.1 핵심 컴포넌트
1. `size tokens registry`
- `typography`, `space`, `object2d` 카테고리별 토큰 값을 정의한다.
- `SizeTokenRegistry` 확장 토큰도 동일한 registry 엔트리로 등록한다.

2. `resolveSize(value, category)`
- number면 그대로 반환, token이면 registry에서 해석한다.

3. `normalizeSizeInput(size)`
- 2D `size` union(`token | 'auto' | { token, ratio } | { widthHeight } | { width, height }`)을 내부 공통 형태로 정규화한다.

4. `resolveObject2D(sizeInput)`
- 정규화된 입력을 최종 width/height(px)로 변환한다.

5. `widthHeight` 축약 해석
- `size={{ widthHeight: v }}` 입력을 `size={{ width: v, height: v }}`로 먼저 정규화한 뒤 동일 경로로 처리한다.

6. `resolveMarkdownSize(sizeInput)`
- primitive(`number | token`)는 1D 모듈러 스케일로, object 입력은 2D 폭/높이로 분기 해석한다.
- 미지원 토큰은 공통 규칙에 따라 동일 warning + fallback을 적용한다.

### 9.2 처리 파이프라인

```text
TSX 입력(number | token | object union)
 -> 파서(원본 보존)
 -> renderer 직전 단일 prop(size/fontSize) normalize
 -> category/ratio 기반 resolve
 -> React Flow/UI에 최종 number 반영
```

### 9.3 적용 우선순위
1. Text/Shape/Edge label (기존 number prop 확장)
2. Sticky/Shape 2D size+ratio 도입
3. Markdown 1D/2D size 확장
4. 예제/문서 토큰 우선 표기 전환

---

## 10) 리스크 및 대응

| 리스크 | 영향 | 대응 |
|---|---|---|
| 컴포넌트별 개별 매핑 재도입 | 일관성 붕괴 | 공용 resolver 강제 + lint 룰 |
| ratio별 의미 혼선 | 예측 불가 UX | `landscape` 기본 규칙 고정 + 문서 예제 통일 |
| 레거시 API 사용 코드 잔존 | 런타임 혼선 | 타입/문서에서 즉시 차단 + 마이그레이션 가이드 제공 |
| 2D preset 과도한 복잡도 | 학습 비용 증가 | `size + ratio` 2축만 노출하고 세부 규칙은 내부화 |

---

## 11) 최종 수용 기준

1. 주요 대상 컴포넌트가 `number | token` 입력을 지원한다.
2. `xs | s | m | l | xl` 토큰이 `typography/space/object2d`에서 일관 동작한다.
3. 2D 오브젝트(`Sticky`, `Shape`, `Markdown`)는 `size="xs~xl"` + `ratio` 조합으로 직사각형 모듈러 구성이 가능하다.
4. 통일 prop 계약 내 숫자 입력은 계속 동작한다.
5. `Sticky`, `Text`, `Markdown`, `Shape`에서 토큰 사용이 가능하다(`Sequence Diagram`은 v1 제외).
6. `Markdown`은 `size` 단일 prop으로 1D/2D를 모두 지원한다.
7. `Shape`의 type별 기본 기준(`rectangle=landscape`, `circle/triangle=square`)이 일관 적용된다.
8. 미지원 토큰은 개발/운영 환경 모두 동일하게 warning + fallback으로 처리된다.
9. `Sticker`는 다이컷 정책에 따라 콘텐츠 기반 자동 크기를 유지한다.
