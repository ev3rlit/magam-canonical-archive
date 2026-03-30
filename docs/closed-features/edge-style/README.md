# Edge Style

엣지(연결선)의 시각적 표현을 통합하는 공용 타입 `EdgeStyle`을 정의합니다.

## 동기

현재 엣지 스타일링이 세 곳에 분산되어 있고, 각각 다른 API를 사용합니다:

| 사용처 | 현재 API | 문제 |
|--------|----------|------|
| `Edge` 컴포넌트 | `stroke`, `labelTextColor`, `className` (flat props) | 이름이 제각각 |
| Node의 `from` prop | `edgeLabel`, `edgeClassName` (별도 props) | 엣지 속성이 노드에 흩어짐 |
| `page.tsx` 내부 | `getStrokeStyle()`, `getEdgeType()` (하드코딩) | 확장 불가 |

또한 다음 속성들이 코드베이스에 파이프라인은 있으나 사용자에게 노출되지 않습니다:

| 속성 | 현황 |
|------|------|
| 화살표 방향 | `markerEnd` prop이 FloatingEdge에 전달되나 **설정 안 됨** |
| 애니메이션 | `animated: false` 하드코딩 |
| 라벨 위치 | midpoint 고정, 선택 불가 |
| 경로 타입 | `getEdgeType()` 존재하나 MindMap 엣지는 항상 `floating` |

## `EdgeStyle` — 공용 타입

엣지의 모든 시각적 관심사를 하나의 타입으로 통합합니다.

```typescript
interface EdgeStyle {
  // 경로 — 어떤 형태로 연결하나
  type?: 'floating' | 'straight' | 'curved' | 'step';

  // 선 — 선 자체의 시각
  stroke?: string;              // 선 색상 (기본: #94a3b8)
  strokeWidth?: number;         // 선 두께 (기본: 2)
  pattern?: 'solid' | 'dashed' | 'dotted';  // 선 패턴
  animated?: boolean;           // 흐르는 애니메이션

  // 방향 — 화살표와 방향성
  direction?: 'forward'         // → 소스에서 타겟으로
            | 'backward'        // ← 타겟에서 소스로
            | 'both'            // ↔ 양방향
            | 'none';           // — 화살표 없음 (기본)

  // 라벨 — 연결선 위의 텍스트
  label?: string | EdgeLabel;

  // 탈출구
  className?: string;
}

interface EdgeLabel {
  text: string;
  position?: 'center' | 'start' | 'end';  // 라벨 위치 (기본: center)
  color?: string;               // 텍스트 색상
  bg?: string;                  // 배경 색상
  fontSize?: number;
}
```

### 관심사 분류

| 카테고리 | 속성 | 설명 |
|----------|------|------|
| **경로** | `type` | 연결선 형태 (floating, straight, curved, step) |
| **선** | `stroke`, `strokeWidth`, `pattern`, `animated` | 선 자체의 시각 |
| **방향** | `direction` | 화살표와 방향성 |
| **라벨** | `label` | 연결선 위의 텍스트와 스타일 |

## 사용처

한 가지 타입, 세 곳에서 사용:

| 사용처 | 역할 | 형태 |
|--------|------|------|
| `from.edge` | MindMap 트리 엣지 개별 스타일 | 구조화 객체 |
| `Edge` 컴포넌트 | 독립 연결 스타일 | flat props |
| `MindMap.edgeDefaults` | MindMap 그룹 기본 스타일 | 구조화 객체 |

### `from.edge` — 트리 엣지 스타일

MindMap 내 자식이 `from` prop으로 부모를 선언할 때, 엣지 시각을 함께 지정합니다.

```tsx
<Node id="child" from={{
  node: "root",
  edge: { stroke: "#ef4444", pattern: "dashed", direction: "forward" }
}}>...</Node>
```

자세한 내용은 [MindMap Polymorphic Children](../mindmap-polymorphic-children/README.md) 참조.

### `Edge` 컴포넌트 — flat props

독립 연결은 `EdgeStyle`의 속성을 flat props로 받습니다. 내부에서 동일한 `EdgeStyle`로 정규화합니다.

```tsx
// flat props (편의)
<Edge from="A" to="B" stroke="#ef4444" pattern="dashed" direction="forward" label="연결" />

// 위 코드는 내부적으로 아래와 동일:
// { stroke: "#ef4444", pattern: "dashed", direction: "forward", label: "연결" }
```

### `MindMap.edgeDefaults` — 그룹 기본 스타일

MindMap 전체에 적용되는 기본 엣지 스타일을 선언합니다.
자식의 `from.edge`와 shallow merge되며, 개별 설정이 우선합니다.

```tsx
<MindMap id="map" edgeDefaults={{ stroke: "#3b82f6", direction: "forward" }}>
  <Node id="root">Root</Node>
  <Node id="a" from="root">기본 스타일 상속</Node>
  <Node id="b" from={{ node: "root", edge: { pattern: "dashed" } }}>패턴만 오버라이드</Node>
</MindMap>
```

merge 로직:

```typescript
function resolveEdgeStyle(edge: EdgeStyle, defaults?: EdgeStyle): EdgeStyle {
  return { ...defaults, ...edge };
}
```

## `direction` 기본값

`direction`의 기본값은 `'none'`(화살표 없음)이다.

- 마인드맵은 트리 구조 자체가 방향을 내포하므로, 화살표 없는 선이 자연스럽다
- 플로우차트나 데이터 흐름 다이어그램에서는 `edgeDefaults`로 `direction: "forward"`를 설정

## `from` vs `Edge`

| | `from` | `Edge` |
|--|--------|--------|
| 의존 방향 | 자식 → 부모 (단방향 선언) | 제3자가 A↔B 연결 |
| 레이아웃 | MindMap 트리 구조에 참여 | 레이아웃에 영향 없음 |
| 사용 시점 | 컴포넌트가 자신의 출처를 선언할 때 | 독립적인 연결이 필요할 때 |
| 시각 타입 | 공용 `EdgeStyle` (`from.edge`) | 공용 `EdgeStyle` (flat props) |
| 기본 스타일 | `MindMap.edgeDefaults`에서 상속 | 개별 지정 |

둘 다 동일한 `EdgeStyle` 타입을 사용하므로, 시각적 속성은 완전히 호환됩니다.

## 하위 호환

기존 `edgeLabel`, `edgeClassName`도 당분간 유지합니다.

```tsx
// 기존 문법 (deprecated but works)
<Node id="a" from="root" edgeLabel="label" edgeClassName="dashed" />

// 새 문법 (권장)
<Node id="a" from={{ node: "root", edge: { label: "label", pattern: "dashed" } }} />
```

`Edge` 컴포넌트의 기존 props (`labelTextColor`, `labelBgColor`, `labelFontSize`)도 당분간 유지하되, `EdgeStyle` 기반 속성을 권장합니다.

## 현재 코드베이스 현황

### 엣지 생성 경로 3곳 (`page.tsx`)

| 경로 | 위치 | 설명 |
|------|------|------|
| Canvas 직속 Edge | `graph-edge` 처리 | `parseEdgeEndpoint()`로 포트 지정 지원 |
| MindMap Node의 `from` | `graph-node` + `from` prop | `edgeLabel`/`edgeClassName` 개별 처리 |
| Sticky/Shape 내부 Edge | 중첩 `graph-edge` | `from` 자동 주입 (부모 nodeId) |

세 경로 모두 `EdgeStyle` 기반으로 통합하면, `createEdgeFromProp()` 하나로 수렴 가능합니다.

### 포트 표기법

이미 `parseEdgeEndpoint()`가 `"nodeId:portId"` 표기를 지원합니다:

```tsx
<Edge from="shapeA:output" to="shapeB:input" />
<Node id="child" from={{ node: "root:bottom", edge: { type: "step" } }}>...</Node>
```

### ReactFlow 매핑

```typescript
// direction → marker 변환
markerEnd: direction === 'forward' || direction === 'both'
  ? { type: MarkerType.ArrowClosed } : undefined
markerStart: direction === 'backward' || direction === 'both'
  ? { type: MarkerType.ArrowClosed } : undefined

// pattern → strokeDasharray 변환
pattern === 'dashed' → { strokeDasharray: '5 5' }
pattern === 'dotted' → { strokeDasharray: '2 2' }

// type → React Flow edge type 변환
'floating'  → 'floating'  (FloatingEdge 커스텀 컴포넌트)
'straight'  → 'straight'
'curved'    → 'default'   (React Flow 기본 bezier)
'step'      → 'step'
```

## 관련 문서

- [MindMap Polymorphic Children](../mindmap-polymorphic-children/README.md) — `from` prop 설계, 디커플링 전략
- [Layout Strategy 아키텍처](../layout-strategy/README.md) — 레이아웃 엔진
