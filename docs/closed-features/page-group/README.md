아주 좋은 포인트야. 실제 개발 워크플로우랑 똑같이 가져가는 거네.

## 계층 구조 확장

```
Whiteboard (프로젝트)
├── Page 1 (overview.tsx)
│   ├── Sticky
│   ├── Group (재사용 가능)
│   │   ├── Shape
│   │   └── Text
│   └── MindMap
├── Page 2 (architecture.tsx)
│   └── Group (다른 페이지 Group 재사용 가능)
└── Page 3 (roadmap.tsx)
```

## 장점 정리

| 관점 | 장점 |
|------|------|
| AI 토큰 | 페이지 단위로 작업하면 컨텍스트 작음 |
| 작업 범위 | "architecture 페이지만 수정해줘" 가능 |
| 재사용 | 공통 그룹을 여러 페이지에서 import |
| 버전 관리 | 파일별 변경 이력 추적 용이 |
| 협업 | 각자 다른 페이지 작업 가능 |

---

## 파일 구조 제안

```
my-project/
├── magam.config.ts      # 프로젝트 설정, 페이지 목록
├── pages/
│   ├── overview.tsx          # 페이지 1
│   ├── architecture.tsx      # 페이지 2
│   └── roadmap.tsx           # 페이지 3
└── components/
    ├── api-layer.tsx         # 재사용 그룹
    └── database-layer.tsx    # 재사용 그룹
```

### magam.config.ts

```ts
export default {
  name: "내 프로젝트",
  pages: [
    { id: "overview", title: "개요", file: "./pages/overview.tsx" },
    { id: "architecture", title: "아키텍처", file: "./pages/architecture.tsx" },
    { id: "roadmap", title: "로드맵", file: "./pages/roadmap.tsx" },
  ]
}
```

### pages/architecture.tsx

```tsx
import { Canvas, Sticky, Edge } from 'magam'
import { ApiLayer } from '../components/api-layer'
import { DatabaseLayer } from '../components/database-layer'

export default function Architecture() {
  return (
    <Canvas>
      <ApiLayer x={100} y={100} />
      <DatabaseLayer x={400} y={100} />
      <Edge from="api-server" to="postgres" />
    </Canvas>
  )
}
```

### components/api-layer.tsx

```tsx
import { Group, Shape, Text } from 'magam'

export function ApiLayer({ x, y }: { x: number, y: number }) {
  return (
    <Group id="api-layer" x={x} y={y}>
      <Shape id="api-server" x={0} y={0} shape="rectangle">
        API Server
      </Shape>
      <Text id="api-label" x={0} y={-30}>
        API Layer
      </Text>
    </Group>
  )
}
```

---

## Group 컴포넌트 설계

### 역할

| 항목 | 내용 |
|------|------|
| 역할 | 여러 요소를 하나의 단위로 묶음 |
| 좌표 | 로컬 좌표계 생성 (자식은 그룹 기준 상대 좌표) |
| 재사용 | React 컴포넌트로 export하여 다른 페이지에서 import |
| Edge 연결 | 그룹 내부 요소 id로 외부에서 연결 가능 |

### Props

| Prop | 타입 | 필수 | 설명 |
|------|------|------|------|
| id | string | O | 그룹 식별자 |
| x | number | O | 그룹 앵커 X 좌표 |
| y | number | O | 그룹 앵커 Y 좌표 |
| className | string | X | 그룹 배경/테두리 스타일 |
| children | ReactNode | O | 그룹 내부 요소들 |

### 좌표 규칙

```tsx
<Group id="my-group" x={100} y={100}>
  {/* 이 Shape의 실제 위치는 (100+0, 100+50) = (100, 150) */}
  <Shape id="box" x={0} y={50} shape="rectangle">Box</Shape>
</Group>
```

| 요소 | 좌표 기준 |
|------|----------|
| Group | Canvas 절대 좌표 |
| Group 내부 요소 | Group 상대 좌표 |
| 중첩 Group | 부모 Group 상대 좌표 |

---

## Page 네비게이션

웹 뷰어에서 페이지 간 이동이 필요해요.

### 방식 옵션

**Option A: 탭 방식**
```
[개요] [아키텍처] [로드맵]
┌─────────────────────────┐
│                         │
│      현재 페이지         │
│                         │
└─────────────────────────┘
```

**Option B: 사이드바 방식**
```
┌──────┬──────────────────┐
│ 개요  │                  │
│ 아키  │   현재 페이지     │
│ 로드  │                  │
└──────┴──────────────────┘
```

---

## MCP 도구 확장

페이지와 그룹이 추가되면 MCP 도구도 확장이 필요해요.

### 추가될 도구

```typescript
// 페이지 목록 조회
project.listPages(): Page[]

// 특정 페이지 상태 조회
canvas.getState(pageId: string): CanvasState

// 특정 페이지 코드 읽기
code.read(pageId: string): { filepath: string, content: string }

// 컴포넌트(그룹) 목록 조회
project.listComponents(): Component[]

// 컴포넌트 코드 읽기
code.readComponent(componentId: string): { filepath: string, content: string }
```

### AI 사용 시나리오

```
사용자: "architecture 페이지에 캐시 레이어 추가해줘"

AI:
1. project.listPages() → architecture 페이지 확인
2. code.read("architecture") → 현재 코드 확인
3. 코드 수정하여 code.write("architecture", newCode)
```

```
사용자: "api-layer 컴포넌트에 로드밸런서 추가해줘"

AI:
1. project.listComponents() → api-layer 컴포넌트 확인
2. code.readComponent("api-layer") → 현재 코드 확인
3. 코드 수정
```

---

## 정리: 확장된 컴포넌트 계층

```
Canvas (페이지 루트)
├── 자유 배치 요소
│   ├── Sticky
│   ├── Shape
│   └── Text
│
├── 그룹
│   └── Group (로컬 좌표계, 재사용 가능)
│       ├── Sticky, Shape, Text
│       └── Group (중첩 가능)
│
├── 연결선
│   └── Edge
│
└── 마인드맵
    └── MindMap
        └── Node
```
