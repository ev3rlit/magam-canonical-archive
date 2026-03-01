# Washi Tape 기능 PRD (Magam)

## 1) 배경

Magam은 코드 기반 캔버스에서 다양한 시각 오브젝트를 제공하지만, FigJam 스타일의 와시 테이프처럼 "패턴 기반 강조 오버레이"를 빠르게 배치하는 표준 타입은 없다.

현재는 스티커/도형/이미지를 수동 조합해야 해 반복 작업 비용이 높고, 결과 일관성도 낮다. 본 기획은 `sticker`를 유지한 채 별도 타입 `washi-tape`를 도입해, 간결한 선언형 API로 와시 테이프를 표현하는 것을 목표로 한다.

## 2) 문제 정의

- 와시 테이프 표현을 위해 여러 오브젝트를 조합해야 한다.
- 패턴/텍스처/엣지 표현이 문서마다 달라 시각 일관성이 낮다.
- 커스텀 패턴(SVG/Image/Solid)과 프리셋을 같은 API에서 다루기 어렵다.
- 저장/내보내기에서 렌더 재현 가능한 API 계약이 필요하다.

핵심 문제는 "간결하면서 직렬화 가능한 와시 테이프 API"가 없다는 점이다.

## 2-1) 구현 반영 상태 (2026-03-01)

- `graph-washi-tape` -> `washi-tape` 파서 매핑이 앱 렌더 파이프라인에 연결되었다.
- 툴바에 `PresetPattern` 카탈로그 버튼이 추가되어, 선택된 와시 노드의 프리셋을 즉시 변경할 수 있다.
- QuickOpen(`Ctrl/Cmd+T`)은 파일 + 명령 통합 검색을 지원하며, 와시 선택/포커스/프리셋 적용 명령을 제공한다.
- 키보드 삽입 단축키는 v1 범위에서 제공하지 않는다(요구 확정 사항).
- `attach` 배치는 anchor 해석 경로와 통합되어 대상 이동 시 위치 추적을 유지한다.
- WS patch 경로는 객체 props(`at`, `pattern`, `edge`, `texture`, `text`)를 안전하게 패치한다.
- export 경로는 `graph-washi-tape` sourceMeta 주입 및 와시 geometry 기반 측정값을 사용한다.

## 3) 목표와 비목표

### 목표

- 신규 타입 `washi-tape` 도입 (`sticker`와 공존)
- 단일 컴포넌트 `WashiTape`로 사용성 단순화
- `children`은 콘텐츠 전용으로 제한
- 패턴을 하이브리드로 지원: preset + custom(svg/image/solid)
- helper 함수 기반 타입 안전한 API 제공
- `at` 유니온 기반 상대 부착/절대 배치 지원
- 캔버스/내보내기(PNG/JPEG/SVG/PDF) 시각 유사성 유지

### 비목표

- 전용 Inspector 패널(v1 스펙 오프)
- 캔버스 직접 편집(이동/회전/리사이즈/복제/삭제) v1 스펙 오프
- 오브젝트 물리 결합/잠금
- 사용자 패턴 업로드 관리 시스템(Asset Manager)
- `children` 함수(headless render-prop) 지원(v1 스펙 오프)

## 4) 사용자 시나리오

1. 사용자가 `<WashiTape preset="pastel-dots">TODO</WashiTape>`로 빠르게 강조 라벨을 만든다.
2. 사용자가 SVG 패턴을 지정해 브랜드 스타일 와시 테이프를 만든다.
3. 사용자가 단색(solid) 패턴을 지정해 빠르게 컬러 라벨을 만든다.
4. 사용자가 image 패턴을 지정해 질감 테이프를 적용한다.
5. 사용자가 시작점/도착점을 지정해 원하는 길이로 테이프를 붙인다.
6. 사용자가 export 시 캔버스와 유사한 패턴/텍스처/엣지 결과를 얻는다.

## 5) Public API / 인터페이스

### 최종 의사결정

- API 설계 방식은 **Factory Function + Discriminated Union**으로 확정한다.
- `children`은 순수 콘텐츠 전용(`ReactNode`)으로 분리한다.
- 시각 설정은 `pattern/edge/texture/text` props에 factory helper 반환값을 전달한다.
- 위 구조를 통해 타입 세이프티를 유지하면서 프리셋/커스텀 패턴(svg/image/solid) 확장에 유연하게 대응한다.

### 대화 기반 검토 방법론

아래 방법론을 순차 검토한 후 최종안을 선택했다.

1. URL 전용 props (`patternSrc`, `patternKind`)
- 장점: 구현 단순
- 한계: SVG inline/타입 제약/직렬화 메타 표현력 부족

2. 개별 props 분리 (`preset`, `svgSrc`, `imageSrc` 등)
- 장점: 학습 비용 낮음
- 한계: 상호배타 규칙이 늘어나고 조합 복잡도 증가

3. Namespace 객체 props (`pattern={{...}}`, `edge={{...}}`)
- 장점: 선언형 구조 명확
- 한계: 객체 리터럴 노이즈 증가

4. Compound Component (`WashiTape.Pattern`, `WashiTape.Content`)
- 장점: React 선언형 표현력 우수
- 한계: parser/직렬화/저장 규약 복잡도 증가

5. Render-prop/Headless (`children={(primitives)=>...}`)
- 장점: 완전 커스텀 가능
- 한계: 직렬화/재현성/보안 리스크로 v1 부적합

6. Preset-only
- 장점: 제품화 속도 빠름
- 한계: 커스텀 SVG/Image/Solid 요구 미충족

최종 선택: **Factory Function + Discriminated Union**  
선정 이유: 타입 안전성, 간결한 사용성, 직렬화 안정성, 확장성의 균형이 가장 좋음.

### 컴포넌트

- 신규 컴포넌트: `WashiTape`
- Host node: `graph-washi-tape`

### 핵심 원칙

- `children`은 콘텐츠 전용(`ReactNode`)으로만 받는다.
- 시각 설정은 props(`pattern`, `edge`, `texture`, `text`)로만 제어한다.
- 선언형 객체 props와 helper 반환값을 모두 허용한다.

### Props (v1)

- 공통: `id`, `zIndex`, `className`
- 배치(At): `at: AtDef`
- 시각:
  - `pattern?: PatternDef`
  - `edge?: EdgeDef`
  - `texture?: TextureDef`
  - `text?: TextDef`
- 단축: `preset?: PresetName` (`pattern={preset(name)}`의 sugar)
- 기타: `seed?: string | number`, `opacity?: number`
- 콘텐츠: `children?: ReactNode` (함수 미지원)
- 제약:
  - `at`는 필수이며 유니온 타입 중 하나만 선택한다.
  - 공개 API는 `at` 단일 prop만 사용한다.
- 회전 규칙:
  - `at.type='segment'`는 `from/to`로 각도를 결정한다.
  - `at.type='polar'`에서 `angle` 미명시 시 seed 기반 지터 적용
  - `at.type='attach'`는 target 로컬 좌표/placement에서 각도를 계산한다.

### 타입 (요약)

```ts
// 프리셋 이름 목록을 타입으로 고정하는 SSOT 상수
const PRESET_NAMES = [
  'classic-cream',
  'pastel-pink',
  'grid-kraft',
  'neon-marker',
  'transparent-film',
  'pastel-dots',
  'stripe-mint',
] as const;

// 프리셋 이름 유니온 타입 (PRESET_NAMES에서 파생)
type PresetName = (typeof PRESET_NAMES)[number];

// 프리셋 패턴 정의
type PresetPattern = {
  type: 'preset';
  name: PresetName;
};

// SVG 기반 패턴 정의 (URL 또는 inline markup)
type SVGPattern = {
  type: 'svg';
  src?: string;
  markup?: string;
};

// 단색 채우기 패턴 정의
type SolidPattern = {
  type: 'solid';
  color: string;
};

// 이미지 기반 패턴 정의
type ImagePattern = {
  type: 'image';
  src: string;
  scale?: number;
  repeat?: 'repeat-x' | 'repeat' | 'stretch';
};

// 패턴 입력 전체 유니온
type PatternDef = PresetPattern | SVGPattern | SolidPattern | ImagePattern;

// 2D 좌표 점
type Point = {
  x: number;
  y: number;
};

// 시작점-도착점(세그먼트)으로 테이프를 배치하는 방식 (권장 기본)
type SegmentAt = {
  type: 'segment';
  from: Point;
  to: Point;
  thickness?: number;
};

// 원점+길이(+각도)로 배치하는 편의 입력 방식
type PolarAt = {
  type: 'polar';
  x: number;
  y: number;
  length: number;
  angle?: number;
  thickness?: number;
};

// 특정 오브젝트에 상대적으로 부착하는 관계 기반 방식
type AttachAt = {
  type: 'attach';
  target: string;
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'center' | 'custom';
  span?: number; // 0..1
  align?: number; // 0..1
  offset?: number; // px
  from?: [number, number]; // local 0..1
  to?: [number, number]; // local 0..1
  followRotation?: boolean;
  clipToTarget?: boolean;
  thickness?: number;
};

// 부착 방식 전체 유니온
type AtDef = SegmentAt | PolarAt | AttachAt;

// 테이프 엣지(가장자리) 스타일
type EdgeDef =
  | { variant: 'smooth' }
  | { variant: 'torn'; roughness?: number };

// 테이프 표면 텍스처 스타일
type TextureDef = {
  opacity?: number;
  blend?: 'normal' | 'multiply' | 'overlay';
};

// 테이프 내부 텍스트 스타일
type TextDef = {
  align?: 'start' | 'center' | 'end';
  color?: string;
  size?: number;
};

// 문자열이 PresetName 유효값인지 판별하는 타입가드
function isPresetName(value: string): value is PresetName {
  return (PRESET_NAMES as readonly string[]).includes(value);
}
```

### Helper API (`@magam/washi`)

```ts
preset(name: PresetName): PatternDef
svg(opts: { src?: string; markup?: string }): PatternDef
solid(color: string): PatternDef
image(src: string, opts?: { scale?: number; repeat?: 'repeat-x' | 'repeat' | 'stretch' }): PatternDef
definePattern(def: PatternDef): PatternDef

segment(from: { x: number; y: number }, to: { x: number; y: number }, opts?: { thickness?: number }): AtDef
polar(x: number, y: number, length: number, angle?: number, opts?: { thickness?: number }): AtDef
attach(opts: {
  target: string;
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'center' | 'custom';
  span?: number;
  align?: number;
  offset?: number;
  from?: [number, number];
  to?: [number, number];
  followRotation?: boolean;
  clipToTarget?: boolean;
  thickness?: number;
}): AttachAt

smooth(): EdgeDef
torn(opts?: { roughness?: number }): EdgeDef
texture(opts?: TextureDef): TextureDef
```

### 예시

```tsx
// 1) 가장 간단한 사용법 (segment)
<WashiTape
  at={segment({ x: 120, y: 80 }, { x: 360, y: 120 }, { thickness: 28 })}
  preset="pastel-dots"
>
  TODO
</WashiTape>

// 2) SVG 이용
<WashiTape pattern={svg({ src: '/patterns/dots.svg' })}>
  Release Note
</WashiTape>

// 3) Image 이용
<WashiTape
  at={segment({ x: 140, y: 220 }, { x: 420, y: 220 }, { thickness: 30 })}
  pattern={image('/patterns/floral.png', { scale: 0.5 })}
  edge={smooth()}
>
  꽃무늬 테이프
</WashiTape>

// 4) 단색(Solid) 이용
<WashiTape
  at={attach({ target: 'card-1', placement: 'top', span: 0.72, align: 0.5, offset: -8, thickness: 28 })}
  pattern={solid('#FFE08A')}
  text={{ align: 'center', color: '#5B4A00' }}
>
  단색 라벨
</WashiTape>

// 5) x,y,length 보조 입력 (polar)
<WashiTape
  at={polar(100, 300, 260, -6, { thickness: 26 })}
  pattern={solid('#FFE08A')}
  text={{ align: 'center', color: '#5B4A00' }}
>
  polar 입력 라벨
</WashiTape>

// 6) 완전 커스텀(객체 조합)
const polka = definePattern({
  type: 'svg',
  markup: '<svg viewBox="0 0 16 16"><rect width="16" height="16" fill="#fce4ec"/><circle cx="8" cy="8" r="3" fill="#f48fb1"/></svg>',
});

<WashiTape
  at={segment({ x: 180, y: 420 }, { x: 460, y: 440 }, { thickness: 30 })}
  pattern={polka}
  edge={torn({ roughness: 1.5 })}
  texture={texture({ opacity: 0.8, blend: 'multiply' })}
  text={{ align: 'center', color: '#555', size: 14 }}
>
  2024년 여행 계획 ✈️
</WashiTape>
```

## 6) 기능 요구사항

### FR-1. 전용 오브젝트 타입

- `washi-tape`를 캔버스 1급 타입으로 추가한다.
- 직렬화 키는 `type: "washi-tape"`를 사용한다.

수용 기준

- [AC-01] `washi-tape`는 노드 목록에서 독립 타입으로 조회된다.
- [AC-02] 저장/재로드 후 배치/회전/패턴/콘텐츠 값이 보존된다.

### FR-2. 장식 오버레이 동작

- 독립 오브젝트로 배치되며 물리 결합은 제공하지 않는다.
- 특정 타겟 오브젝트 기준 상대 부착(`at.type='attach'`)을 지원한다.

수용 기준

- [AC-03] target 대상 이동/리사이즈 시 부착된 와시테이프 상대 위치가 유지된다.
- [AC-04] 물리 결합/잠금 없이 기본 사용 플로우가 중단되지 않는다.

### FR-3. 콘텐츠 및 동적 크기

- `children`은 콘텐츠 전용으로 렌더한다.
- 길이/방향/부착 기준은 `at` 유니온으로 결정한다.
  - `at.type='segment'`: 시작점/도착점 기반
  - `at.type='polar'`: `x,y,length,angle` 기반(보조 입력)
  - `at.type='attach'`: 특정 오브젝트 상대 부착 기반
- 모든 입력은 내부에서 endpoint geometry로 정규화한다.
- 텍스트 기본 정렬은 중앙 정렬(`text.align=center`).
- 텍스트 overflow 처리 순서:
  1) 2줄 줄바꿈 + 중앙 정렬
  2) 초과 시 말줄임(`…`)

수용 기준

- [AC-05] `at.type='segment'` 입력 시 동일 좌표에서 일관된 길이/각도로 렌더된다.
- [AC-06] `at.type='polar'` 및 `at.type='attach'` 입력은 endpoint로 정규화되어 동일 결과를 생성한다.
- [AC-07] 텍스트는 기본 중앙 정렬되고 overflow 정책이 일관되게 적용된다.

### FR-4. 패턴 API (프리셋 + 커스텀)

- 프리셋은 `preset` 또는 `pattern={preset(name)}`로 지정한다.
- 커스텀 패턴은 `pattern`으로 `solid`/`svg`/`image`를 지정한다.
- SVG 패턴은 원본 에셋의 고유 밀도(viewBox/원본 비율)를 기본 유지한다(강제 타일 정규화 없음).
- helper 반환 타입만 허용해 타입 안정성을 유지한다.
- 미지원/불완전 패턴은 안전 fallback(기본 preset) 처리한다.

수용 기준

- [AC-08] preset/solid/svg/image 패턴이 동일 API로 렌더된다.
- [AC-09] 잘못된 패턴 입력 시 앱 크래시 없이 fallback 렌더된다.
- [AC-10] 외부 선언 `definePattern(...)` 재사용이 가능하다.

### FR-5. 캔버스 인터랙션 (비편집)

- 삽입, 선택, 다중 선택, 포커스 이동만 지원한다.
- v1에서 직접 편집(이동/회전/리사이즈/복제/삭제)은 제공하지 않는다.
- polar 입력에서 `angle` 미설정 시 결정적 지터를 자동 적용한다(`-5~+5`, `0` 제외).

수용 기준

- [AC-11] 100개 장면에서 삽입/선택/포커스 동작이 정상이다.
- [AC-12] 선택 시 편집 핸들/편집 UI가 노출되지 않는다.
- [AC-13] 동일 노드 id는 재로드 후 동일 지터 각도를 유지한다.

### FR-6. Export 동일성

- PNG/JPEG/SVG/PDF export에서 캔버스와 유사한 결과를 유지한다.

수용 기준

- [AC-14] 골든 비교 SSIM 0.98 이상.
- [AC-15] 패턴/텍스처/엣지 누락률 2% 이하.

### FR-7. 접근성 및 조작 채널

- 키보드로 삽입/선택/포커스 이동이 가능해야 한다.
- 스타일 변경은 툴바 quick action/명령 팔레트로 수행한다.
- 전용 Inspector 패널은 제공하지 않는다.

수용 기준

- [AC-16] 키보드만으로 기본 플로우 수행 가능.
- [AC-17] 명령 팔레트에서 preset/패턴 전환 가능.
- [AC-18] `washi-tape` 선택 시 전용 Inspector가 노출되지 않는다.

### FR-8. Sticker와 공존

- `sticker`와 `washi-tape`를 별도 타입으로 공존시킨다.

수용 기준

- [AC-19] 동일 문서에서 파싱/렌더 충돌이 없다.
- [AC-20] 기존 `sticker` 동작 회귀가 없다.

## 7) 비기능 요구사항

- 성능: 100개 장면에서 삽입/선택/포커스 체감 지연 최소화
- 안정성: 삽입/선택/스타일 전환 플로우 데이터 손실 0건
- 접근성: 키보드 조작 + 명령 팔레트 중심 조작 가능
- 유지보수성: preset/helper 추가 시 기존 렌더 파이프라인 재사용
- 보안: SVG markup 입력은 whitelist sanitize를 통과해야 렌더

## 8) UX 제안

- 삽입 진입점: 툴바 `Washi Tape`, 명령 팔레트 `Insert Washi Tape`
- 스타일 변경: 툴바 quick action + 명령 팔레트
- 기본값:
  - `preset`: `classic-cream`
  - `thickness`: `28`
  - `text.align`: `center`
- Inspector 미제공(v1)

## 9) 기술 설계 개요

### 데이터 모델

- ReactFlow node type: `washi-tape`
- node data:
  - `pattern: PatternDef`
  - `at: AtDef`
  - `resolvedGeometry: { from: Point; to: Point; thickness: number }`
  - `edge: EdgeDef`
  - `texture: TextureDef`
  - `text: TextDef`
  - `children: RenderableChild[]`
  - `seed?: string | number`

### 렌더 전략

1. 패턴 우선순위: `pattern` > `preset` sugar > default preset
2. 부착 우선순위: `at.segment` > `at.attach` > `at.polar`를 endpoint로 해석
3. `at.polar`에서 `angle` 미설정 시 `seed jitter`로 각도 계산
4. 텍스트 정렬/overflow 정책 적용
5. SVG markup은 sanitize 후 렌더

### export 전략

- 캔버스 렌더 토큰을 export 경로에서 공유
- PNG/JPEG/SVG/PDF 골든 테스트로 회귀 검증

## 10) 단계별 구현 계획

1. 타입/헬퍼 정의 (`PatternDef`, `AtDef`, `EdgeDef`, `TextureDef`, `TextDef`)
2. `WashiTape` 단일 컴포넌트 API 및 parser 경로 구현
3. 패턴 렌더러(preset/svg/image) + sanitize + fallback 구현
4. 비편집 인터랙션/지터/동적 크기 규칙 연결
5. 툴바/명령 팔레트 스타일 액션 연결(Inspector 제외)
6. export/테스트/문서 예제 마감

## 11) 테스트 계획

### 단위 테스트

- helper 함수 타입/반환값 검증
- `pattern` 우선순위 및 fallback 검증
- at 정규화(`segment`, `polar`, `attach`) 검증
- 텍스트 정렬/overflow 규칙 검증
- 지터 결정성(`seed` 동일 시 각도 동일) 검증
- SVG sanitize/whitelist 검증

### 통합 테스트

- `graph-washi-tape` -> `washi-tape` parser 매핑
- preset/svg/image 렌더 경로 검증
- at 입력별(`segment/polar/attach`) 렌더 경로 일관성 검증
- 스타일 액션(툴바/명령 팔레트) 적용 검증
- `sticker` + `washi-tape` 혼합 문서 검증

### E2E 테스트

- 삽입 -> 선택 -> 포커스 이동
- 명령 팔레트에서 preset/패턴 전환
- attach 기반 상대 부착 추적
- export 파일별 시각 회귀 검증

## 12) 성공 지표

- `washi-tape` 사용 세션 비율 20% 이상
- 강조 요소 구성 시간 40% 이상 단축(수동 조합 대비)
- export 시각 불일치 리포트 2% 미만
- 릴리즈 후 4주 내 washi 관련 크래시 0건

## 13) 리스크 및 대응

- 리스크: SVG markup 보안/안정성 이슈
  대응: sanitize + 태그/속성 whitelist + fallback

- 리스크: 패턴 종류 증가로 렌더 복잡도 상승
  대응: helper 기반 타입 강제 + 패턴 렌더 어댑터 분리

- 리스크: 비편집 정책으로 사용자 기대와 괴리
  대응: v1 범위 명시 + v2 후보(편집/Inspector) 별도 관리

## 14) 가정 및 기본값

- `sticker`는 유지하며 대체하지 않는다.
- `children`은 콘텐츠 전용(`ReactNode`)이고 함수는 v1에서 미지원.
- 시각 설정은 props/헬퍼로만 전달한다.
- v1은 Inspector 및 캔버스 직접 편집을 스펙 오프로 둔다.
