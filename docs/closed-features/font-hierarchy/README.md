# Handwriting Font Hierarchy PRD (Global → Canvas → Node)

## 1) 배경

현재 Magam는 앱 전역에서 Inter 기반 폰트를 사용하며, 캔버스 콘텐츠에 대해 폰트 계층(전역/캔버스/노드) 개념이 없습니다.  
손글씨 중심의 다이어리/데코/노트 워크플로우에서 텍스트 톤을 일관되게 제어하려면, 폰트 적용 우선순위가 명확한 정책이 필요합니다.

핵심 문제: "캔버스 텍스트에 대해 폰트 적용 우선순위와 기본값 정책이 계약으로 고정되어 있지 않다."

---

## 2) 목표와 비목표

### 목표

1. 손글씨 폰트를 공식 기능으로 도입한다.
2. 폰트 적용 우선순위를 `Global → Canvas → Node`로 고정한다.
3. 캔버스 텍스트 계열 노드(`text`, `shape`, `sticky`, `markdown`, `sticker`)에 동일 규칙을 적용한다.
4. 글로벌 폰트는 앱 설정으로 변경 가능하고 localStorage에 영속화한다.
5. 캔버스 단위는 코드(`<Canvas fontFamily="...">`)로 오버라이드 가능하다.
6. 노드 단위는 각 컴포넌트 `fontFamily` prop으로 최우선 오버라이드 가능하다.

### 비목표

1. 임의 URL/임의 폰트 패밀리 문자열 입력 지원
2. `fontSize`, `fontWeight`, `lineHeight`, `letterSpacing` 계층화
3. 앱 UI(헤더/사이드바/버튼/모달) 폰트 정책 변경
4. 서버 동기화 기반 사용자 폰트 설정

---

## 3) 용어 및 계층 정의

### 폰트 프리셋 타입

```ts
type FontFamilyPreset = 'hand-gaegu' | 'hand-caveat' | 'sans-inter';
```

### 계층 우선순위

1. Node `fontFamily`
2. Canvas `fontFamily`
3. Global `fontFamily`

결정식:

```ts
effective = node.fontFamily ?? canvas.fontFamily ?? global.fontFamily
```

기본값:

- Global default: `hand-gaegu`
- Canvas default: unset(상속)
- Node default: unset(상속)

---

## 4) 기능 요구사항

### FR-1. Global Font

- 전역 폰트를 store 상태로 유지하고 즉시 반영
- localStorage key: `magam.font.globalFamily`
- 앱 재시작 후에도 전역 폰트 유지

수용 기준:

- [AC-01] 최초 기본값이 `hand-gaegu`로 적용된다.
- [AC-02] 폰트 변경 후 새로고침해도 동일 값이 유지된다.

### FR-2. Canvas Font

- `<Canvas fontFamily="...">`를 통해 캔버스 단위 오버라이드 지원
- Canvas meta로 전달되어 앱 parser/store에 반영

수용 기준:

- [AC-03] Canvas에 `fontFamily`가 지정되면 global보다 우선 적용된다.
- [AC-04] Canvas에서 `fontFamily` 제거 시 global 상속으로 즉시 복귀한다.

### FR-3. Node Font

- `Text`, `Shape`, `Sticky`, `Markdown`, `Sticker`에 `fontFamily` prop 추가
- Node 단위 값이 canvas/global보다 최우선

수용 기준:

- [AC-05] 노드에 `fontFamily`가 있으면 해당 노드만 오버라이드된다.
- [AC-06] 노드 `fontFamily` 제거 시 canvas/global 상속으로 즉시 복귀한다.

### FR-4. Edge/Sequence 적용

- `FloatingEdge` label 텍스트에 동일 resolver 적용
- `SequenceDiagramNode`의 participant/message label 텍스트에 동일 resolver 적용

수용 기준:

- [AC-07] edge label이 global/canvas/node(=edge-level) 규칙으로 렌더된다.
- [AC-08] sequence 내부 텍스트가 같은 계층 규칙으로 렌더된다.

### FR-5. 캔버스 콘텐츠 한정

- 폰트 계층 기능은 캔버스 콘텐츠 텍스트만 대상
- 앱 UI는 기존 Inter 정책 유지

수용 기준:

- [AC-09] 헤더/사이드바/모달 등 앱 UI의 기본 폰트는 유지된다.
- [AC-10] 캔버스 노드 텍스트만 변경된다.

---

## 5) 인터페이스 계약

### Core 컴포넌트 계약

- `CanvasProps.fontFamily?: FontFamilyPreset`
- `NodeProps.fontFamily?: FontFamilyPreset`
- `ShapeProps.fontFamily?: FontFamilyPreset`
- `StickyProps.fontFamily?: FontFamilyPreset`
- `TextProps.fontFamily?: FontFamilyPreset`
- `MarkdownProps.fontFamily?: FontFamilyPreset`
- `StickerProps.fontFamily?: FontFamilyPreset`

### Canvas Meta 계약

- `CanvasMeta.fontFamily?: FontFamilyPreset`

### App Store 계약

- `globalFontFamily: FontFamilyPreset`
- `canvasFontFamily?: FontFamilyPreset`
- `setGlobalFontFamily(fontFamily: FontFamilyPreset): void`
- `setCanvasFontFamily(fontFamily?: FontFamilyPreset): void`

---

## 6) 폰트 공급 정책

- 공급원: Google Fonts preset (`next/font/google`)
- 기본 프리셋 매핑:
  - `hand-gaegu`: Gaegu + system sans fallback
  - `hand-caveat`: Caveat + system sans fallback
  - `sans-inter`: Inter + system sans fallback
- 언어 커버리지 정책:
  - 한/영 혼용 가독성을 위해 system fallback 체인을 항상 포함

---

## 7) UX 계약

### Global FontSelector

- 위치: 기존 툴바 진입점(Floating toolbar)
- 옵션:
  - `Handwriting (Gaegu)`
  - `Handwriting (Caveat)`
  - `Sans (Inter)`
- 저장: 선택 즉시 반영 + localStorage 저장

### Canvas/Node 설정

- Canvas: 코드 prop 중심 (`<Canvas fontFamily="...">`)
- Node: 각 노드 컴포넌트 prop 중심
- v1에서 캔버스 단위 UI 편집은 비범위

---

## 8) 테스트 시나리오

### 단위 테스트

1. font resolver 우선순위 검증
   - global only
   - canvas > global
   - node > canvas > global
2. localStorage 저장/복구 검증
3. preset 값 검증(`isFontFamilyPreset`)

### 통합 테스트

1. 같은 캔버스에서 global/canvas/node 혼합 적용 검증
2. markdown/sticker 텍스트에 resolver 적용 검증
3. sequence/edge label 적용 검증

### Export 회귀

1. export 직전 `document.fonts.ready` 대기 후 캡처
2. PNG/JPG/SVG/PDF 결과에서 preset 폰트 유지

---

## 9) 리스크 및 대응

1. 리스크: Google font subset 한계로 일부 한글 glyph 미흡
   - 대응: system fallback 체인 강제
2. 리스크: export 시 폰트 로딩 지연
   - 대응: `document.fonts.ready` 대기 후 캡처
3. 리스크: className 기반 font-family와 계층 규칙 충돌
   - 대응: `font-sans/font-serif/font-mono` 명시 시 class 우선(escape hatch)

---

## 10) 최종 수용 기준

1. 글로벌 기본 폰트가 `hand-gaegu`로 동작한다.
2. `<Canvas fontFamily>`가 global을 덮어쓴다.
3. 노드 `fontFamily`가 canvas/global을 덮어쓴다.
4. `text/shape/sticky/markdown/sticker`에 같은 계층 규칙이 적용된다.
5. edge label과 sequence 텍스트가 같은 규칙을 따른다.
6. 앱 UI 폰트는 기존 정책을 유지한다.
7. export 결과에 preset 폰트가 안정적으로 반영된다.
