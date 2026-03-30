# magam Canvas UX & Design Guidelines

## Overview

본 문서는 magam 캔버스의 시각적 디자인과 사용자 경험을 정의합니다. FigJam을 레퍼런스로 하되, 깔끔한 벡터 그래픽 스타일로 친근하면서도 전문적인 느낌을 지향합니다.

## Design Principles

| 원칙 | 설명 |
|------|------|
| 깔끔한 벡터 | 손그림 대신 정돈된 벡터 그래픽 |
| 친근한 톤 | 파스텔 색상, 둥근 모서리, 부드러운 그림자 |
| 가독성 | 눈 편한 폰트, 충분한 여백 |
| 일관성 | 통일된 색상 팔레트와 스타일 |

---

## Typography

### 폰트 선택

| 우선순위 | 폰트 | 비고 |
|----------|------|------|
| 1 | Pretendard | 한글 지원, 둥근 느낌 |
| 2 | Nunito | 영문, 매우 둥근 산세리프 |
| 3 | system-ui | 폴백 |

### 폰트 스케일

| 용도 | 크기 | 굵기 |
|------|------|------|
| 노드 제목 | 14px | 500 (medium) |
| 노드 본문 | 14px | 400 (regular) |
| 엣지 라벨 | 12px | 400 |
| 캔버스 제목 | 24px | 600 (semibold) |
| 작은 텍스트 | 12px | 400 |

---

## Color Palette

### Primary Colors (브랜드)

| 이름 | Hex | 용도 |
|------|-----|------|
| Primary | `#6366F1` | 선택 상태, 강조 |
| Primary Light | `#A5B4FC` | 호버 상태 |
| Primary Dark | `#4F46E5` | 활성 상태 |

### Sticky Colors

기본값: Yellow

| 이름 | Background | Border | 
|------|------------|--------|
| Yellow | `#FEF3C7` | `#FCD34D` |
| Pink | `#FCE7F3` | `#F9A8D4` |
| Blue | `#DBEAFE` | `#93C5FD` |
| Green | `#D1FAE5` | `#6EE7B7` |
| Purple | `#EDE9FE` | `#C4B5FD` |
| Orange | `#FFEDD5` | `#FDBA74` |
| Gray | `#F3F4F6` | `#D1D5DB` |

### Shape Colors

기본값: White with border

| 이름 | Fill | Border |
|------|------|--------|
| White | `#FFFFFF` | `#D1D5DB` |
| + Sticky 색상들 | (위와 동일) | (위와 동일) |

### Edge Colors

기본값: Gray

| 이름 | Hex |
|------|-----|
| Gray | `#6B7280` |
| Black | `#1F2937` |
| Blue | `#3B82F6` |
| Red | `#EF4444` |
| Green | `#10B981` |

### UI Colors

| 용도 | Hex |
|------|-----|
| Background | `#FAFAFA` |
| Grid | `#E5E7EB` |
| Selection | `#6366F1` |
| Error | `#EF4444` |
| Success | `#10B981` |

---

## Component Styles

### Sticky

```
┌─────────────────────┐
│                     │  ← 둥근 모서리 (8px)
│   내용              │  ← 패딩 12px
│                     │  ← 부드러운 그림자
└─────────────────────┘
```

| 속성 | 값 |
|------|-----|
| Border Radius | 8px |
| Padding | 12px |
| Shadow | `0 2px 8px rgba(0,0,0,0.1)` |
| Min Width | 100px |
| Default Width | 150px |
| Default Color | Yellow |

### Shape

**Rectangle**

```
┌─────────────────────┐
│                     │  ← 둥근 모서리 (8px)
│       내용          │  ← 테두리 2px
│                     │
└─────────────────────┘
```

| 속성 | 값 |
|------|-----|
| Border Radius | 8px |
| Border Width | 2px |
| Default Fill | White |
| Default Border | Gray (`#D1D5DB`) |

**Circle**

| 속성 | 값 |
|------|-----|
| Border Width | 2px |
| Default Size | 100px × 100px |

**Diamond**

| 속성 | 값 |
|------|-----|
| Border Width | 2px |
| Rotation | 45deg |

### Text

| 속성 | 값 |
|------|-----|
| Color | `#1F2937` |
| Background | 없음 (투명) |

### Group

| 속성 | 값 |
|------|-----|
| Border | 1px dashed `#D1D5DB` (선택적) |
| Background | 투명 또는 반투명 |
| Border Radius | 12px |

### MindMap Node

| 속성 | 값 |
|------|-----|
| Border Radius | 8px |
| Border Width | 2px |
| Padding | 8px 16px |
| Background | White |
| Border | `#D1D5DB` |

---

## Edge Styles

### Edge Types

| type | 설명 | 시각화 |
|------|------|--------|
| `default` | 둥근 꺾은선 (기본값) | 코너가 radius로 둥글게 |
| `straight` | 직선 | 시작점에서 끝점으로 직선 |
| `curved` | 베지어 곡선 | 부드러운 S자 곡선 |
| `step` | 직각 꺾은선 | 코너가 90도 각진 형태 |

### 기본 엣지 (둥근 꺾은선)

```
    ┌───────┐
    │   A   │
    └───┬───┘
        │
        ╰────────╮
                 │
             ┌───┴───┐
             │   B   │
             └───────┘
```

| 속성 | 값 |
|------|-----|
| Stroke Width | 2px |
| Color | `#6B7280` |
| Corner Radius | 8px |

### Arrow Head

| 속성 | 값 |
|------|-----|
| Type | Filled triangle |
| Size | 8px |

### Edge Label

```
        ──────┤ label ├──────
```

| 속성 | 값 |
|------|-----|
| Background | `#FFFFFF` |
| Padding | 2px 6px |
| Font Size | 12px |
| Border Radius | 4px |

---

## Selection States

### 선택됨

```
┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐
  ┌─────────────────────┐
│ │                     │ │  ← Primary 색상 테두리 (2px)
  │   선택된 노드        │
│ │                     │ │
  └─────────────────────┘
└ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘
        ← 점선 바운딩 박스 (선택적)
```

| 속성 | 값 |
|------|-----|
| Border | 2px solid `#6366F1` |
| Shadow | `0 0 0 3px rgba(99, 102, 241, 0.2)` |

### 호버

| 속성 | 값 |
|------|-----|
| Border | 2px solid `#A5B4FC` |
| Cursor | `pointer` |

### 드래그 선택 영역

```
┌─ ─ ─ ─ ─ ─ ─ ─┐
│               │  ← Primary 색상 반투명 배경
│               │  ← Primary 색상 테두리
└─ ─ ─ ─ ─ ─ ─ ─┘
```

| 속성 | 값 |
|------|-----|
| Background | `rgba(99, 102, 241, 0.1)` |
| Border | 1px solid `#6366F1` |

---

## Canvas Background

### 기본 배경

| 속성 | 값 |
|------|-----|
| Color | `#FAFAFA` |

### Grid (선택적)

```
┼───────┼───────┼───────┼
│       │       │       │
│       │       │       │
┼───────┼───────┼───────┼
│       │       │       │
```

| 속성 | 값 |
|------|-----|
| Grid Size | 20px |
| Line Color | `#E5E7EB` |
| Line Width | 1px |

### Dot Grid (대안)

```
·       ·       ·       ·

·       ·       ·       ·

·       ·       ·       ·
```

| 속성 | 값 |
|------|-----|
| Dot Size | 2px |
| Dot Color | `#D1D5DB` |
| Spacing | 20px |

---

## Tailwind Class Mappings

사용자가 className으로 스타일을 지정할 때의 매핑입니다.

### Sticky Colors

```tsx
<Sticky className="bg-yellow-100">  // #FEF3C7
<Sticky className="bg-pink-100">    // #FCE7F3
<Sticky className="bg-blue-100">    // #DBEAFE
<Sticky className="bg-green-100">   // #D1FAE5
<Sticky className="bg-purple-100">  // #EDE9FE
<Sticky className="bg-orange-100">  // #FFEDD5
<Sticky className="bg-gray-100">    // #F3F4F6
```

### Edge Colors

```tsx
<Edge className="stroke-gray-500">   // #6B7280
<Edge className="stroke-gray-800">   // #1F2937
<Edge className="stroke-blue-500">   // #3B82F6
<Edge className="stroke-red-500">    // #EF4444
```

### 기타 스타일

```tsx
// 그림자
<Sticky className="shadow-lg">

// 테두리
<Shape className="border-2 border-blue-500">

// 폰트
<Text className="text-xl font-bold">
```

---

## Animation & Transitions

### 기본 트랜지션

| 대상 | Duration | Easing |
|------|----------|--------|
| 호버 | 150ms | ease-out |
| 선택 | 200ms | ease-out |
| 줌/팬 | 200ms | ease-out |

### 노드 추가 애니메이션

```css
@keyframes nodeAppear {
  from {
    opacity: 0;
    transform: scale(0.9);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
```

Duration: 200ms

---

## Responsive Behavior

### 줌 레벨별 표시

| 줌 레벨 | 표시 내용 |
|---------|----------|
| < 25% | 노드 박스만, 텍스트 숨김 |
| 25-50% | 제목만 표시 |
| 50-100% | 전체 내용 표시 |
| > 100% | 전체 내용 + 상세 |

### 최소/최대 줌

| 속성 | 값 |
|------|-----|
| Min Zoom | 10% |
| Max Zoom | 400% |
| Default | 100% |

---

## Accessibility

### 색상 대비

- 텍스트와 배경 간 최소 4.5:1 대비
- 중요 UI 요소는 색상만으로 구분하지 않음

### 키보드 네비게이션

| 키 | 동작 |
|----|------|
| Tab | 다음 노드로 포커스 |
| Shift+Tab | 이전 노드로 포커스 |
| Enter | 노드 선택 |
| Esc | 선택 해제 |
| Arrow keys | 선택 노드 이동 (선택적) |

### 포커스 표시

```
┌─────────────────────┐
│                     │  ← 2px solid outline
│   포커스된 노드      │  ← offset 2px
│                     │
└─────────────────────┘
```

---

## Summary

| 항목 | 결정 |
|------|------|
| 스타일 | 깔끔한 벡터 그래픽 |
| 톤 | 친근하고 전문적 |
| 색상 | 파스텔 팔레트 |
| 폰트 | Pretendard / Nunito |
| 모서리 | 둥근 모서리 (8px) |
| 엣지 기본 | 둥근 꺾은선 |
| 그림자 | 부드러운 그림자 |