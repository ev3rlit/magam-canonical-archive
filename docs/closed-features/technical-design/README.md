# magam Technical Design Document

## Overview

magam는 코드로 다이어그램을 작성하는 도구입니다. "Remotion for Diagrams"를 컨셉으로, 사용자는 React 컴포넌트 기반의 `.tsx` 파일을 작성하고, AI 에이전트와 MCP를 통해 협업하며, 웹 뷰어에서 실시간으로 결과를 확인합니다.

## Design Principles

| 원칙 | 설명 |
|------|------|
| Code as Source of Truth | `.tsx` 파일이 유일한 진실 공급원 |
| 단방향 동기화 | 코드 → 캔버스, 역방향 없음 |
| Zero Config | 사용자는 `.tsx` 파일만 작성, 빌드 설정 불필요 |
| AI 친화적 | MCP 프로토콜로 AI 에이전트가 코드를 직접 조작 |

---

## System Architecture

### 전체 구조

```
┌─────────────────────────────────────────────────────────────┐
│                    @magam/cli                          │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   MCP       │  │  Transpiler │  │   @magam/core  │ │
│  │   Server    │  │  (esbuild)  │  │   (내장)            │ │
│  └──────┬──────┘  └──────┬──────┘  └─────────────────────┘ │
│         │                │                                  │
│  ┌──────┴────────────────┴──────────────────────────────┐  │
│  │                    Web Server                         │  │
│  │              (NestJS + WebSocket)                     │  │
│  └──────────────────────┬───────────────────────────────┘  │
│                         │                                   │
└─────────────────────────┼───────────────────────────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
        ▼                 ▼                 ▼
 ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
 │  AI Agent   │  │   Browser   │  │  User Files │
 │  (OpenCode) │  │   (Viewer)  │  │   (.tsx)    │
 └─────────────┘  └─────────────┘  └─────────────┘
```

### 데이터 흐름

```
1. 사용자가 .tsx 파일 저장
2. File Watcher가 변경 감지
3. Transpiler가 .tsx → JavaScript 변환
4. import 'magam' → 내장 core 모듈로 resolve
5. Canvas Engine이 React 트리 → 그래프 데이터 변환
6. WebSocket으로 브라우저에 전송
7. React Flow가 렌더링
```

### AI 에이전트 흐름

```
1. 사용자: "API 서버 노드 추가해줘"
2. AI: canvas.getState() 호출 → 현재 상태 파악
3. AI: code.read() 호출 → 현재 코드 확인
4. AI: 코드 수정 후 code.write() 호출
5. magam: 파일 변경 감지 → 리렌더링
```

---

## Package Structure

### Monorepo 구성

```
magam/
├── packages/
│   ├── core/                      # @magam/core
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── Canvas.tsx
│   │   │   │   ├── Sticky.tsx
│   │   │   │   ├── Shape.tsx
│   │   │   │   ├── Text.tsx
│   │   │   │   ├── Edge.tsx
│   │   │   │   ├── Group.tsx
│   │   │   │   ├── MindMap.tsx
│   │   │   │   └── Node.tsx
│   │   │   │
│   │   │   ├── context/
│   │   │   │   └── CanvasContext.tsx
│   │   │   │
│   │   │   ├── types/
│   │   │   │   └── index.ts
│   │   │   │
│   │   │   └── index.ts
│   │   │
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── tsup.config.ts
│   │
│   └── cli/                       # @magam/cli
│       ├── src/
│       │   ├── cli.ts             # CLI 진입점
│       │   │
│       │   ├── server/
│       │   │   ├── index.ts
│       │   │   ├── file-watcher.ts
│       │   │   └── websocket.ts
│       │   │
│       │   ├── mcp/
│       │   │   ├── server.ts
│       │   │   └── tools/
│       │   │       ├── canvas.tools.ts
│       │   │       ├── code.tools.ts
│       │   │       └── project.tools.ts
│       │   │
│       │   ├── transpiler/
│       │   │   └── index.ts
│       │   │
│       │   └── client/            # 브라우저 앱 (빌드 후 내장)
│       │       ├── App.tsx
│       │       └── ...
│       │
│       ├── package.json
│       └── tsconfig.json
│
├── docs/
│   └── skill.md                   # AI 에이전트용 스킬 문서
│
├── examples/
│   └── basic/
│       ├── overview.tsx
│       └── architecture.tsx
│
├── package.json
├── pnpm-workspace.yaml
└── README.md
```

### 패키지 역할

| 패키지 | npm 공개 | 역할 |
|--------|---------|------|
| @magam/core | O | React 컴포넌트 라이브러리 |
| @magam/cli | O | 서버 + MCP + 트랜스파일러 + 뷰어 |

### 의존성 관계

```
@magam/cli
    │
    ├── @magam/core (내장)
    ├── @nestjs/core
    ├── @modelcontextprotocol/sdk
    ├── esbuild
    ├── socket.io
    └── react-flow
```

---

## User Experience

### Zero Config 실행

```bash
# 1. 아무 폴더에서
cd ~/my-diagrams

# 2. 바로 실행
npx @magam/cli dev

# 3. 출력
🚀 magam running at http://localhost:3000
📁 Watching: ~/my-diagrams
```

### 사용자 파일 구조

```
~/my-diagrams/
├── overview.tsx           # 페이지 1
├── architecture.tsx       # 페이지 2
├── roadmap.tsx           # 페이지 3
└── components/
    ├── api-layer.tsx     # 재사용 그룹
    └── database-layer.tsx
```

- `package.json` 불필요
- `node_modules` 불필요
- `tsconfig.json` 불필요

### 사용자가 작성하는 코드

```tsx
// overview.tsx
import { Canvas, Sticky, Shape, Edge } from 'magam'

export default function Overview() {
  return (
    <Canvas>
      <Sticky id="idea" x={100} y={100} className="bg-yellow-200">
        아이디어
        <Edge to="system" />
      </Sticky>
      <Shape id="system" x={300} y={100} shape="rectangle">
        시스템
      </Shape>
    </Canvas>
  )
}
```

### 제약 사항

| 제약 | 이유 |
|------|------|
| `magam`만 import 가능 | CLI가 resolve할 수 있는 것만 |
| 외부 npm 패키지 불가 | node_modules 없음 |
| 상대 경로 import 허용 | `./components/xxx` |

### CLI 명령어

```bash
# 현재 폴더에서 실행
npx @magam/cli dev

# 특정 폴더 지정
npx @magam/cli dev ./my-diagrams

# 포트 지정
npx @magam/cli dev --port 4000
```

---

## Component API Specification

### 컴포넌트 계층

```
Canvas (루트 컨테이너)
├── 자유 배치 요소 (Edge를 자식으로 포함 가능)
│   ├── Sticky (스티키 노트)
│   │   └── Edge (연결선, 선택적)
│   ├── Shape (도형)
│   │   └── Edge (연결선, 선택적)
│   └── Text (텍스트)
│
├── 그룹
│   └── Group (로컬 좌표계, 재사용 가능)
│       ├── Sticky, Shape, Text (Edge 포함 가능)
│       └── Group (중첩 가능)
│
├── 연결선 (별도 선언, 특수 케이스용)
│   └── Edge
│
└── 마인드맵
    └── MindMap (자동 레이아웃)
        └── Node
```

### Edge 연결 방식

Edge는 두 가지 방식으로 사용할 수 있습니다. **자식 방식을 권장**합니다.

**권장: Edge를 노드의 자식으로**

```tsx
<Sticky id="api" x={100} y={100}>
  API Server
  <Edge to="db" label="query" />
  <Edge to="cache" label="read" className="stroke-blue-500" />
</Sticky>
<Sticky id="db" x={300} y={100}>DB</Sticky>
<Sticky id="cache" x={300} y={200}>Cache</Sticky>
```

| 장점 | 설명 |
|------|------|
| from 자동 추론 | 부모 노드가 시작점이므로 `from` 불필요 |
| 계층 명확 | "이 노드에서 나가는 연결"이 코드 구조로 보임 |
| AI 친화적 | 노드 하나만 읽으면 연결까지 파악 가능 |
| 자유도 유지 | 라벨, 스타일, 타입 모두 지정 가능 |

**허용: 별도 Edge 선언 (특수 케이스)**

양방향 연결 등 특수한 경우에만 사용합니다.

```tsx
<Sticky id="api" x={100} y={100}>API</Sticky>
<Sticky id="db" x={300} y={100}>DB</Sticky>

<!-- 양방향 연결 -->
<Edge from="api" to="db" type="bidirectional" />
```

---

### Canvas

루트 컨테이너. 모든 요소는 Canvas 안에 있어야 함.

| Prop | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| width | number | X | 무한 | 캔버스 너비 |
| height | number | X | 무한 | 캔버스 높이 |
| grid | boolean | X | false | 그리드 표시 |
| gridSize | number | X | 20 | 그리드 간격 |
| className | string | X | - | 배경 스타일 |

### Sticky

스티키 노트 스타일 메모. 자식으로 Edge를 포함할 수 있습니다.

| Prop | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| id | string | O | - | 고유 식별자 |
| x | number | O | - | X 좌표 |
| y | number | O | - | Y 좌표 |
| width | number | X | 150 | 너비 |
| height | number | X | auto | 높이 |
| className | string | X | - | Tailwind 클래스 |
| children | ReactNode | O | - | 내용 (텍스트, Edge 포함 가능) |

기본 스타일: 노란 배경, 그림자, 둥근 모서리

### Shape

기본 도형. 자식으로 Edge를 포함할 수 있습니다.

| Prop | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| id | string | O | - | 고유 식별자 |
| x | number | O | - | X 좌표 |
| y | number | O | - | Y 좌표 |
| shape | string | O | - | 'rectangle' \| 'circle' \| 'diamond' |
| width | number | X | 100 | 너비 |
| height | number | X | 100 | 높이 |
| className | string | X | - | Tailwind 클래스 |
| children | ReactNode | X | - | 내부 텍스트, Edge 포함 가능 |

기본 스타일: 흰 배경, 회색 테두리

### Text

순수 텍스트 라벨.

| Prop | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| id | string | O | - | 고유 식별자 |
| x | number | O | - | X 좌표 |
| y | number | O | - | Y 좌표 |
| className | string | X | - | Tailwind 클래스 |
| children | ReactNode | O | - | 텍스트 내용 |

기본 스타일: 검정 텍스트, 배경 없음

### Edge

두 요소 간 연결선. 노드의 자식으로 사용하거나 별도로 선언할 수 있습니다.

| Prop | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| from | string | △ | - | 시작 노드 id (자식으로 사용 시 생략) |
| to | string | O | - | 끝 노드 id |
| type | string | X | 'arrow' | 'arrow' \| 'line' \| 'bidirectional' |
| label | string | X | - | 연결선 위 라벨 |
| className | string | X | - | 선 스타일 |

- 노드의 자식으로 사용 시: `from` 생략 가능 (부모 노드가 시작점)
- 별도 선언 시: `from` 필수

기본 스타일: 회색 선, 기본 화살표

```tsx
// 자식으로 사용 (권장)
<Sticky id="api" x={100} y={100}>
  API
  <Edge to="db" label="query" />
</Sticky>

// 별도 선언 (양방향 등 특수 케이스)
<Edge from="api" to="db" type="bidirectional" />
```

### Group

여러 요소를 하나의 단위로 묶음. 로컬 좌표계 생성.

| Prop | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| id | string | O | - | 그룹 식별자 |
| x | number | O | - | 그룹 앵커 X 좌표 |
| y | number | O | - | 그룹 앵커 Y 좌표 |
| className | string | X | - | 그룹 배경/테두리 스타일 |
| children | ReactNode | O | - | 그룹 내부 요소들 |

좌표 규칙:
- Group은 Canvas 절대 좌표
- Group 내부 요소는 Group 상대 좌표

```tsx
<Group id="my-group" x={100} y={100}>
  {/* 실제 위치: (100+0, 100+50) = (100, 150) */}
  <Shape id="box" x={0} y={50} shape="rectangle">Box</Shape>
</Group>
```

### MindMap

자동 레이아웃 컨테이너.

| Prop | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| x | number | O | - | 앵커 X 좌표 (루트 노드 위치) |
| y | number | O | - | 앵커 Y 좌표 |
| layout | string | X | 'tree' | 'tree' \| 'radial' |
| spacing | number | X | 50 | 노드 간 간격 |
| className | string | X | - | 컨테이너 스타일 |

### Node (MindMap 내부 전용)

마인드맵의 개별 노드. MindMap 안에서만 사용.

| Prop | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| id | string | O | - | 고유 식별자 |
| parentId | string | X | - | 부모 노드 id, 없으면 루트 |
| collapsed | boolean | X | false | 자식 접기 여부 |
| className | string | X | - | Tailwind 클래스 |
| children | ReactNode | O | - | 노드 내용 |

기본 스타일: 흰 배경, 둥근 모서리, 얇은 테두리

---

## Component Rules

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
| Group | 절대 좌표 필수 (x, y) |
| Group 내부 요소 | Group 기준 상대 좌표 |
| MindMap | 앵커 좌표 필수 (x, y) |
| Node | 좌표 명시 불가, 자동 계산 |

### 스타일링 규칙

| 원칙 | 설명 |
|------|------|
| Tailwind 우선 | 모든 시각적 커스터마이징은 className으로 |
| 합리적 기본값 | className 없어도 보기 좋은 기본 스타일 |
| 오버라이드 가능 | 기본 스타일을 className으로 덮어쓰기 가능 |

---

## MCP Interface Specification

### 도구 레이어 구조

```
┌─────────────────────────────────────────┐
│              MCP Tools                   │
├─────────────────────────────────────────┤
│  Canvas Layer    │  조회 전용            │
│  - getState      │  현재 렌더링 상태     │
│  - getSelection  │  사용자 선택          │
├─────────────────────────────────────────┤
│  Code Layer      │  파일 조작            │
│  - read          │  .tsx 파일 읽기       │
│  - write         │  .tsx 파일 쓰기       │
├─────────────────────────────────────────┤
│  Template Layer  │  편의 도구            │
│  - getTemplate   │  코드 스니펫 제공     │
├─────────────────────────────────────────┤
│  Project Layer   │  프로젝트 구조        │
│  - listPages     │  페이지 목록          │
│  - listComponents│  컴포넌트 목록        │
└─────────────────────────────────────────┘
```

### Canvas Layer

**canvas.getState(pageId?: string)**

현재 렌더링된 캔버스 상태를 반환.

```typescript
// 요청
{ pageId?: "architecture" }

// 응답
{
  nodes: [
    {
      id: "api-server",
      type: "sticky",
      position: { x: 100, y: 100 },
      content: "API Server",
      parentId: null
    }
  ],
  edges: [
    {
      id: "edge-1",
      source: "api-server",
      target: "database"
    }
  ],
  viewport: { x: 0, y: 0, zoom: 1 }
}
```

**canvas.getSelection()**

사용자가 뷰어에서 선택한 요소를 반환.

```typescript
// 응답
{
  nodeIds: ["api-server", "database"],
  edgeIds: []
}
```

### Code Layer

**code.read(pageId?: string)**

페이지의 .tsx 파일 내용을 반환.

```typescript
// 요청
{ pageId: "architecture" }

// 응답
{
  filepath: "/Users/me/diagrams/architecture.tsx",
  content: "import { Canvas, Sticky } from 'magam'\n\nexport default..."
}
```

**code.write(content: string, pageId?: string)**

페이지의 .tsx 파일을 덮어쓰기.

```typescript
// 요청
{
  content: "import { Canvas, Sticky } from 'magam'...",
  pageId: "architecture"
}

// 응답
{
  success: true,
  filepath: "/Users/me/diagrams/architecture.tsx"
}
```

### Template Layer

**code.getTemplate(type: string)**

코드 스니펫을 반환.

```typescript
// 요청
{ type: "node" }

// 응답
{
  template: `<Sticky id="unique-id" x={100} y={100} className="bg-yellow-200">
  내용을 입력하세요
</Sticky>`,
  description: "스티키 노트 컴포넌트"
}
```

사용 가능한 type:
- `node`: Sticky 컴포넌트
- `shape`: Shape 컴포넌트
- `edge`: Edge 컴포넌트
- `group`: Group 컴포넌트
- `mindmap`: MindMap + Node 컴포넌트
- `full`: 전체 페이지 템플릿

### Project Layer

**project.listPages()**

프로젝트의 모든 페이지 목록을 반환.

```typescript
// 응답
{
  pages: [
    { id: "overview", filepath: "./overview.tsx" },
    { id: "architecture", filepath: "./architecture.tsx" },
    { id: "roadmap", filepath: "./roadmap.tsx" }
  ]
}
```

**project.listComponents()**

재사용 가능한 컴포넌트 목록을 반환.

```typescript
// 응답
{
  components: [
    { id: "api-layer", filepath: "./components/api-layer.tsx" },
    { id: "database-layer", filepath: "./components/database-layer.tsx" }
  ]
}
```

---

## Technology Stack

| 영역 | 기술 | 역할 |
|------|------|------|
| Monorepo | pnpm workspaces | 패키지 관리 |
| 빌드 (core) | tsup | 라이브러리 번들링 |
| 런타임 | Node.js | 서버 실행 |
| 서버 | NestJS | 모듈화된 서버, WebSocket |
| MCP | @modelcontextprotocol/sdk | AI 에이전트 통신 |
| 트랜스파일 | esbuild | .tsx → JS 변환 |
| 실시간 | Socket.io | 브라우저-서버 통신 |
| 프론트엔드 | React | UI 컴포넌트 |
| 캔버스 | React Flow | 노드/엣지 렌더링 |
| 스타일링 | Tailwind CSS | 유틸리티 스타일 |

---

## Code Examples

### 기본 페이지

```tsx
// overview.tsx
import { Canvas, Sticky, Shape, Text, Edge } from 'magam'

export default function Overview() {
  return (
    <Canvas grid>
      <Text id="title" x={200} y={30} className="text-2xl font-bold">
        프로젝트 개요
      </Text>
      
      <Sticky id="idea-1" x={100} y={100}>
        핵심 아이디어
        <Edge to="system" />
      </Sticky>
      
      <Sticky id="idea-2" x={100} y={200} className="bg-pink-200">
        보조 아이디어
        <Edge to="system" />
      </Sticky>
      
      <Shape id="system" x={300} y={150} shape="rectangle" className="bg-blue-100">
        시스템
      </Shape>
    </Canvas>
  )
}
```

### 그룹 사용

```tsx
// components/api-layer.tsx
import { Group, Shape, Text, Edge } from 'magam'

export function ApiLayer({ x, y }: { x: number, y: number }) {
  return (
    <Group id="api-layer" x={x} y={y}>
      <Text id="api-title" x={50} y={-20} className="font-bold">
        API Layer
      </Text>
      <Shape id="gateway" x={0} y={0} shape="rectangle">
        Gateway
        <Edge to="auth" />
      </Shape>
      <Shape id="auth" x={0} y={80} shape="rectangle">
        Auth
        <Edge to="api" />
      </Shape>
      <Shape id="api" x={0} y={160} shape="rectangle">
        API Server
      </Shape>
    </Group>
  )
}
```

```tsx
// architecture.tsx
import { Canvas } from 'magam'
import { ApiLayer } from './components/api-layer'
import { DatabaseLayer } from './components/database-layer'

export default function Architecture() {
  return (
    <Canvas>
      <ApiLayer x={100} y={100} />
      <DatabaseLayer x={400} y={100} />
    </Canvas>
  )
}

// 참고: api-layer 내부의 api 노드에서 database-layer로 연결하려면
// api-layer.tsx에서 <Edge to="postgres" label="query" /> 추가
```

### 마인드맵

```tsx
// learning.tsx
import { Canvas, MindMap, Node } from 'magam'

export default function Learning() {
  return (
    <Canvas>
      <MindMap x={400} y={300} layout="tree" spacing={60}>
        <Node id="root">React 학습</Node>
        
        <Node id="basics" parentId="root">기초</Node>
        <Node id="jsx" parentId="basics">JSX</Node>
        <Node id="components" parentId="basics">컴포넌트</Node>
        <Node id="props" parentId="basics">Props</Node>
        
        <Node id="advanced" parentId="root">심화</Node>
        <Node id="hooks" parentId="advanced">Hooks</Node>
        <Node id="context" parentId="advanced">Context</Node>
        <Node id="suspense" parentId="advanced">Suspense</Node>
      </MindMap>
    </Canvas>
  )
}
```

---

## Future Considerations

### Phase 1 이후 확장

| 기능 | 설명 |
|------|------|
| 새 Shape 타입 | triangle, hexagon, cylinder |
| 새 레이아웃 | force, horizontal-tree |
| 이미지 컴포넌트 | `<Image src="..." />` |
| 내보내기 | PNG, PDF, SVG |
| 테마 | 다크 모드, 커스텀 테마 |

### 확장하지 않을 것

| 항목 | 이유 |
|------|------|
| 양방향 동기화 | 복잡도 대비 가치 낮음 |
| 실시간 협업 | 범위 초과 |
| 인라인 스타일 prop | Tailwind로 충분 |
| 이벤트 핸들러 | 뷰어 전용, 인터랙션 불필요 |