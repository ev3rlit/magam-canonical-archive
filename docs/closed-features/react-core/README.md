좋아요. 코드가 아닌 설계 관점에서 API 문서를 작성해볼게요.

---

## 논의할 구조

```
1. 컴포넌트 계층 구조
2. 각 컴포넌트의 역할과 책임
3. High-level API (Props 명세)
4. 컴포넌트 간 규칙과 제약
5. 스타일링 전략
6. 확장 포인트
```

하나씩 가볼까요?

---

## 1. 컴포넌트 계층 구조

```
Canvas (루트 컨테이너)
├── 자유 배치 요소
│   ├── Sticky (스티키 노트)
│   ├── Shape (도형)
│   └── Text (텍스트)
│
├── 연결선
│   └── Edge (노드 간 연결)
│
└── 마인드맵
    └── MindMap (자동 레이아웃 컨테이너)
        └── Node (마인드맵 노드)
```

**설계 원칙**

| 원칙 | 설명 |
|------|------|
| Canvas는 유일한 루트 | 모든 요소는 Canvas 안에 있어야 함 |
| 자유 요소는 절대 좌표 | Sticky, Shape, Text는 x, y 필수 |
| MindMap은 상대 좌표 | 내부 Node는 위치를 명시하지 않음, 레이아웃 엔진이 계산 |
| Edge는 독립적 | 어디에 선언해도 동작, 순서 무관 |

---

## 2. 각 컴포넌트의 역할

### Canvas

| 항목 | 내용 |
|------|------|
| 역할 | 루트 컨테이너, 뷰포트 관리, 전역 설정 |
| 자식 | Sticky, Shape, Text, Edge, MindMap |
| 책임 | 줌/팬 상태, 그리드 설정, 전체 크기 |

### Sticky

| 항목 | 내용 |
|------|------|
| 역할 | 포스트잇 스타일 메모 |
| 특징 | 기본 배경색, 그림자, 둥근 모서리 |
| 콘텐츠 | 텍스트 (children) |

### Shape

| 항목 | 내용 |
|------|------|
| 역할 | 기본 도형 (사각형, 원, 다이아몬드 등) |
| 특징 | 다양한 형태, 테두리 중심 스타일 |
| 콘텐츠 | 텍스트 (children), 선택적 |

### Text

| 항목 | 내용 |
|------|------|
| 역할 | 순수 텍스트 라벨 |
| 특징 | 배경 없음, 타이포그래피만 |
| 용도 | 제목, 주석, 라벨링 |

### Edge

| 항목 | 내용 |
|------|------|
| 역할 | 두 요소 간 연결선 |
| 특징 | 화살표/선, 라벨 지원 |
| 제약 | from, to는 존재하는 id여야 함 |

### MindMap

| 항목 | 내용 |
|------|------|
| 역할 | 자동 레이아웃 컨테이너 |
| 특징 | 내부 Node 위치를 자동 계산 |
| 자식 | Node만 허용 |

### Node (MindMap 전용)

| 항목 | 내용 |
|------|------|
| 역할 | 마인드맵의 개별 노드 |
| 특징 | parentId로 계층 표현, 위치 자동 |
| 제약 | MindMap 안에서만 사용 |

---

## 3. High-level API (Props 명세)

### Canvas

| Prop | 타입 | 필수 | 설명 |
|------|------|------|------|
| width | number | X | 캔버스 너비, 기본값 무한 |
| height | number | X | 캔버스 높이, 기본값 무한 |
| grid | boolean | X | 그리드 표시 여부, 기본값 false |
| gridSize | number | X | 그리드 간격, 기본값 20 |
| className | string | X | 배경 스타일 |

### Sticky

| Prop | 타입 | 필수 | 설명 |
|------|------|------|------|
| id | string | O | 고유 식별자 |
| x | number | O | X 좌표 |
| y | number | O | Y 좌표 |
| width | number | X | 너비, 기본값 150 |
| height | number | X | 높이, 기본값 auto |
| className | string | X | Tailwind 클래스 |
| children | ReactNode | O | 내용 |

### Shape

| Prop | 타입 | 필수 | 설명 |
|------|------|------|------|
| id | string | O | 고유 식별자 |
| x | number | O | X 좌표 |
| y | number | O | Y 좌표 |
| shape | string | O | 'rectangle' \| 'circle' \| 'diamond' |
| width | number | X | 너비, 기본값 100 |
| height | number | X | 높이, 기본값 100 |
| className | string | X | Tailwind 클래스 |
| children | ReactNode | X | 내부 텍스트 |

### Text

| Prop | 타입 | 필수 | 설명 |
|------|------|------|------|
| id | string | O | 고유 식별자 |
| x | number | O | X 좌표 |
| y | number | O | Y 좌표 |
| className | string | X | Tailwind 클래스 |
| children | ReactNode | O | 텍스트 내용 |

### Edge

| Prop | 타입 | 필수 | 설명 |
|------|------|------|------|
| from | string | O | 시작 노드 id |
| to | string | O | 끝 노드 id |
| type | string | X | 'arrow' \| 'line', 기본값 'arrow' |
| label | string | X | 연결선 위 라벨 |
| className | string | X | 선 스타일 |

### MindMap

| Prop | 타입 | 필수 | 설명 |
|------|------|------|------|
| x | number | O | 앵커 X 좌표 (루트 노드 위치) |
| y | number | O | 앵커 Y 좌표 |
| layout | string | X | 'tree' \| 'radial', 기본값 'tree' |
| spacing | number | X | 노드 간 간격, 기본값 50 |
| className | string | X | 컨테이너 스타일 |

### Node (MindMap 내부)

| Prop | 타입 | 필수 | 설명 |
|------|------|------|------|
| id | string | O | 고유 식별자 |
| parentId | string | X | 부모 노드 id, 없으면 루트 |
| collapsed | boolean | X | 자식 접기 여부 |
| className | string | X | Tailwind 클래스 |
| children | ReactNode | O | 노드 내용 |

---

## 4. 컴포넌트 간 규칙과 제약

### ID 규칙

| 규칙 | 설명 |
|------|------|
| 전역 유일성 | 모든 id는 Canvas 내에서 유일해야 함 |
| 네이밍 권장 | 영문, 숫자, 하이픈 조합 (예: `api-server`, `node-1`) |
| Edge 참조 | from, to는 반드시 존재하는 id를 참조 |

### 계층 규칙

| 규칙 | 설명 |
|------|------|
| Canvas 필수 | 모든 요소는 Canvas의 자식이어야 함 |
| MindMap 격리 | Node는 MindMap 안에서만 사용 |
| 혼합 가능 | Sticky와 MindMap이 같은 Canvas에 공존 가능 |

### 좌표 규칙

| 요소 | 좌표 방식 |
|------|----------|
| Sticky, Shape, Text | 절대 좌표 필수 (x, y) |
| MindMap | 앵커 좌표 필수 (x, y) |
| Node | 좌표 명시 불가, 자동 계산 |

---

## 5. 스타일링 전략

### 기본 원칙

| 원칙 | 설명 |
|------|------|
| Tailwind 우선 | 모든 시각적 커스터마이징은 className으로 |
| 합리적 기본값 | className 없어도 보기 좋은 기본 스타일 |
| 오버라이드 가능 | 기본 스타일을 className으로 덮어쓰기 가능 |

### 컴포넌트별 기본 스타일

| 컴포넌트 | 기본 스타일 |
|----------|------------|
| Sticky | 노란 배경, 그림자, 둥근 모서리 |
| Shape | 흰 배경, 회색 테두리 |
| Text | 검정 텍스트, 배경 없음 |
| Edge | 회색 선, 기본 화살표 |
| Node | 흰 배경, 둥근 모서리, 얇은 테두리 |

### 스타일링 예시

```tsx
// 기본 스타일
<Sticky id="note1" x={100} y={100}>
  기본 노란색 스티키
</Sticky>

// 커스텀 스타일
<Sticky id="note2" x={100} y={200} className="bg-pink-200 shadow-lg">
  분홍색 스티키
</Sticky>

// 도형 스타일
<Shape id="box" x={300} y={100} shape="rectangle" 
       className="bg-blue-500 text-white border-none">
  파란 박스
</Shape>
```

---

## 6. 확장 포인트

### Phase 1 이후 확장 고려

| 확장 | 설명 |
|------|------|
| 새 Shape 타입 | 'triangle', 'hexagon', 'cylinder' 등 |
| 새 레이아웃 | 'force', 'horizontal-tree' 등 |
| 그룹핑 | `<Group>` 컴포넌트로 묶기 |
| 이미지 | `<Image>` 컴포넌트 |
| 커스텀 노드 | 사용자 정의 컴포넌트 렌더링 |

### 확장하지 않을 것

| 항목 | 이유 |
|------|------|
| 인라인 스타일 prop | Tailwind로 충분, API 복잡도 증가 |
| 이벤트 핸들러 | 뷰어 전용, 인터랙션은 웹앱이 담당 |
| 애니메이션 prop | 복잡도 대비 가치 낮음 |

---

## 정리

이 API 설계로 사용자와 AI가 작성할 코드 형태가 명확해졌어요.

```tsx
import { Canvas, Sticky, Shape, Text, Edge, MindMap, Node } from 'magam'

export default function Diagram() {
  return (
    <Canvas grid>
      <Text id="title" x={300} y={30} className="text-2xl font-bold">
        시스템 아키텍처
      </Text>
      
      <Sticky id="api" x={100} y={100}>API Server</Sticky>
      <Shape id="db" x={300} y={100} shape="circle">DB</Shape>
      <Edge from="api" to="db" label="query" />
      
      <MindMap x={500} y={300} layout="tree">
        <Node id="root">서비스</Node>
        <Node id="auth" parentId="root">인증</Node>
        <Node id="user" parentId="root">사용자</Node>
      </MindMap>
    </Canvas>
  )
}
```