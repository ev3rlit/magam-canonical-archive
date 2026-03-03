# 마인드맵 (MindMap)

마인드맵은 계층 구조를 가진 데이터를 시각적으로 표현하기 위한 자동 레이아웃 컨테이너입니다.
사용자가 개별 노드의 좌표를 지정할 필요 없이, 연결 관계(`from`)만 정의하면 레이아웃 엔진이 자동으로 위치를 계산합니다.

## Import

모든 컴포넌트는 `magam` 패키지에서 import합니다.

```tsx
// 기본 컴포넌트
import { Canvas, MindMap, Node, Text, Edge, Sticky, Shape } from 'magam';

// Rich Content 컴포넌트
import { Code, Table } from 'magam';

// 아이콘 (외부 라이브러리)
import { Database, Shield, Users } from 'lucide-react';
```

## 컴포넌트 구조

마인드맵은 두 가지 핵심 컴포넌트로 구성됩니다:

1. **`MindMap`**: 마인드맵 전체를 감싸는 컨테이너입니다. 루트 위치를 결정합니다.
2. **`Node`**: 마인드맵 내부의 개별 항목입니다. `MindMap` 컴포넌트 내부에서만 사용할 수 있습니다.

```
└── MindMap (자동 레이아웃 컨테이너)
    └── Node (마인드맵 노드)
        └── Text, Code, Table, ... (콘텐츠 합성)
```

## 주요 특징

| 특징 | 설명 |
|------|------|
| **자동 레이아웃** | 내부 노드의 `x`, `y` 좌표를 명시하지 않고 자동으로 배치합니다. |
| **상대 좌표** | `MindMap` 컨테이너 자체는 절대 좌표(`x`, `y`)를 가지지만, 내부 노드는 상대적으로 배치됩니다. |
| **연결 기반 구조** | `from` 속성을 통해 노드 간의 연결(부모-자식 관계)을 정의합니다. |

## 사용법

### 기본 예제 (Tree 레이아웃)

```tsx
export default function Diagram() {
  return (
    <Canvas>
      {/* layout과 spacing은 기본값이 있어 생략 가능 */}
      <MindMap x={100} y={100}>
        
        {/* 루트 노드: from이 없습니다. */}
        <Node id="root">
          <Text className="text-xl font-bold">서비스 구조</Text>
        </Node>
        
        {/* 자식 노드: from으로 부모(연결 대상)를 지목합니다. */}
        <Node id="auth" from="root">인증 모듈</Node>
        <Node id="user" from="root">사용자 관리</Node>
        
        {/* 손자 노드 */}
        <Node id="jwt" from="auth">JWT</Node>
        <Node id="oauth" from="auth">OAuth</Node>
        
      </MindMap>
    </Canvas>
  );
}
```

### Radial 레이아웃 예제

중심에서 방사형으로 펼쳐지는 레이아웃입니다.

```tsx
<MindMap x={400} y={300} layout="radial" spacing={80}>
  <Node id="center">핵심 개념</Node>
  <Node id="a" from="center">개념 A</Node>
  <Node id="b" from="center">개념 B</Node>
  <Node id="c" from="center">개념 C</Node>
  <Node id="d" from="center">개념 D</Node>
</MindMap>
```

## API 명세 (Props)

### MindMap (Container)

| Prop | 타입 | 필수 | 설명 |
|------|------|------|------|
| `x` | number | **O** | 마인드맵 앵커(루트)의 X 좌표 (px) |
| `y` | number | **O** | 마인드맵 앵커(루트)의 Y 좌표 (px) |
| `layout` | string | X | `'tree'` (좌→우 계층형) \| `'radial'` (방사형). 기본값 `'tree'` |
| `spacing` | number | X | 노드 간 간격 (px). 기본값 `50` |
| `className` | string | X | 컨테이너 스타일 (Tailwind CSS) |

### Node (Item)

| Prop | 타입 | 필수 | 설명 |
|------|------|------|------|
| `id` | string | **O** | 노드의 고유 식별자 |
| `from` | string | X | 부모(또는 연결 대상) 노드의 `id`. 없으면 루트 노드로 간주됩니다. |
| `edgeLabel` | string | X | `from` 연결선에 표시할 라벨 텍스트 |
| `edgeClassName` | string | X | 연결선 스타일 (`dashed`, `dotted` 등) |
| `className` | string | X | 노드 스타일 (Tailwind CSS) |
| `children` | ReactNode | **O** | 텍스트, `<Text>`, 또는 여러 요소의 조합. 빈 노드는 허용되지 않습니다. |

> **Note**: `children`에는 단일 텍스트뿐만 아니라 여러 `<Text>` 컴포넌트를 중첩하여 제목/설명 구조를 만들 수 있습니다.

## 스타일링 규칙

- **기본 스타일**: 흰 배경, 둥근 모서리, 얇은 테두리가 기본으로 적용됩니다.
- **커스터마이징**: `className` prop을 통해 Tailwind CSS 클래스로 스타일을 덮어쓸 수 있습니다.

```tsx
// 1. 단순 스타일링
<Node id="node1" className="bg-blue-100 border-blue-300">
  Simple Style
</Node>

// 2. 여러 Text 컴포넌트 중첩 (제목 + 설명 패턴)
<Node id="node2" className="p-4 bg-white shadow-md">
  <Text className="text-lg font-bold text-gray-800">
    Title
  </Text>
  <Text className="text-sm text-gray-500 mt-1">
    Description
  </Text>
</Node>
```

## Technical Design (Layout Engine)

마인드맵의 자동 레이아웃은 **ELK (Eclipse Layout Kernel)** 엔진을 기반으로 동작합니다.

### 아키텍처
 - **Engine**: `elkjs` (Javascript implementation of ELK)
 - **Algorithm**: `layered` (tree) / `radial` (radial)
 - **Environment**: Node.js (Server-side rendering)

### 레이아웃 프로세스
1. **Graph Construction**: `MindMap` 내부의 모든 `Node`와 `from` 관계를 수집하여 ELK 그래프 모델(JSON)로 변환합니다.
2. **Layout Configuration**:
   - `elk.algorithm`: `layered` (tree) 또는 `radial`
   - `elk.direction`: `RIGHT` (tree 레이아웃 시 좌→우 배치)
   - `elk.spacing.nodeNode`: 노드 간 기본 간격 (px)
   - `elk.layered.spacing.nodeNodeBetweenLayers`: 계층 간 간격 (px)
3. **Execution**: ELK 엔진이 비동기로 최적의 `x`, `y` 좌표를 계산합니다.
4. **Reconciliation**: 계산된 좌표를 원본 `Node`의 props에 주입하여 렌더링합니다.

### 제약 사항 및 성능 가이드

| 항목 | 권장/제한 |
|------|----------|
| **최대 노드 수** | 권장 200개 이하. 500개 이상 시 레이아웃 계산 지연 가능 |
| **순환 참조** | 허용되지 않음 (DAG 구조 필수). 순환 시 예측 불가 결과 |
| **Node 격리** | `Node`는 반드시 `MindMap` 내부에서만 사용 |
| **브라우저 호환성** | 모던 브라우저 (Chrome, Firefox, Safari, Edge 최신 버전) |
| **SSR 지원** | Node.js 환경에서 렌더링, 클라이언트 하이드레이션 지원 |

## 심화: 다양한 콘텐츠 활용 (Rich Content)

`Node` 컴포넌트는 React `children`을 지원하므로 단순 텍스트 외에도 다양한 HTML/React 요소를 포함할 수 있습니다.

### 1. 코드 블록 (Code Block)
기술적인 개념을 설명할 때 유용합니다. `<Code>` 컴포넌트를 사용하여 구문 강조(Syntax Highlighting)와 함께 코드를 표시합니다.

```tsx
// MindMap 내부에서 사용
<Node id="code-demo" className="w-[300px]">
  <Text className="font-bold mb-2">tsconfig.json</Text>
  <Code language="json">
    {`{
  "compilerOptions": {
    "strict": true,
    "target": "ES2022"
  }
}`}
  </Code>
</Node>

// 다양한 언어 지원
<Node id="python-example">
  <Code language="python">
    {`def hello():
    print("Hello, World!")`}
  </Code>
</Node>
```

#### Canvas 자유 배치
`<Code>` 컴포넌트는 `MindMap` 내부뿐만 아니라 `Canvas`에 직접 배치할 수도 있습니다.

```tsx
<Canvas>
  {/* 캔버스에 코드 블록 자유 배치 */}
  <Code id="api-example" x={100} y={200} language="typescript">
    {`interface User {
  id: string;
  name: string;
}`}
  </Code>

  {/* 다른 요소와 연결 가능 */}
  <Sticky id="note" x={400} y={200}>API 타입 정의</Sticky>
  <Edge from="api-example" to="note" label="참조" />
</Canvas>
```

#### Code 컴포넌트 Props

| Prop | 타입 | 필수 | 설명 |
|------|------|------|------|
| `id` | string | Canvas 배치 시 **O** | 고유 식별자 (Edge 연결용) |
| `x` | number | Canvas 배치 시 **O** | X 좌표 (px) |
| `y` | number | Canvas 배치 시 **O** | Y 좌표 (px) |
| `language` | string | X | 프로그래밍 언어 (`json`, `typescript`, `python`, `sql` 등). 기본값 `text` |
| `className` | string | X | 추가 스타일 (Tailwind CSS) |
| `children` | string | **O** | 표시할 코드 문자열 |

### 2. 이미지 (Image)
다이어그램 내에 시각 자료를 첨부할 수 있습니다.

```tsx
<Node id="logo-node" className="items-center justify-center p-2">
  <img 
    src="/logo.png" 
    alt="Logo" 
    className="w-16 h-16 mb-2 object-contain" 
  />
  <Text>Project Logo</Text>
</Node>
```

### 3. 링크 (Link)
외부 문서나 참조 사이트로 연결할 수 있습니다.

```tsx
<Node id="ref-link" className="hover:bg-blue-50 transition-colors">
  <Text>참조 문서</Text>
  <a 
    href="https://react.dev" 
    target="_blank" 
    className="text-blue-600 text-xs underline mt-1 block"
  >
    React 공식 문서 열기 ↗
  </a>
</Node>
```

### 4. 테이블 (Table)
데이터 구조나 속성을 간단히 정리할 수 있습니다. `<Table>` 컴포넌트로 쉽게 작성합니다.

```tsx
// 간편 문법 (Table 컴포넌트)
<Node id="schema" className="w-[200px]">
  <Table
    title="User Schema"
    data={[
      { field: 'id', type: 'UUID' },
      { field: 'email', type: 'String' },
    ]}
  />
</Node>

// 또는 기본 HTML 테이블
<Node id="schema2" className="w-[200px] p-0 overflow-hidden">
  <div className="bg-slate-100 p-2 border-b text-center font-bold text-sm">Schema</div>
  <table className="w-full text-xs">
    <tr><td className="p-2 border-b">id</td><td className="p-2 border-b">UUID</td></tr>
    <tr><td className="p-2">email</td><td className="p-2">String</td></tr>
  </table>
</Node>
```

### 5. 아이콘 (Icon)
`lucide-react` 등의 아이콘 라이브러리를 활용하여 노드에 시각적 맥락을 추가합니다.

```tsx
<Node id="db" from="root" className="flex items-center gap-2">
  <Database className="w-5 h-5 text-blue-500" />
  <Text>Database</Text>
</Node>

<Node id="auth" from="root" className="flex items-center gap-2">
  <Shield className="w-5 h-5 text-green-500" />
  <Text>Authentication</Text>
</Node>
```

> **Tip**: `lucide-react`는 경량이면서 트리쉐이킹을 지원하여 번들 크기에 영향이 적습니다.

### 6. 엣지 라벨 및 스타일 (Edge Label & Style)
노드 간 연결선에 라벨과 스타일을 적용할 수 있습니다.

```tsx
<Node id="parent">부모</Node>

{/* 기본 엣지 라벨 */}
<Node id="child1" from="parent" edgeLabel="상속">
  자식 1
</Node>

{/* 스타일이 적용된 엣지 */}
<Node 
  id="child2" 
  from="parent" 
  edgeLabel="의존" 
  edgeClassName="dashed"
>
  자식 2
</Node>
```

#### edgeClassName 지원 값

| 값 | 효과 |
|----|------|
| `dashed` | 점선 (strokeDasharray: 5 5) |
| `dotted` | 더 짧은 점선 (strokeDasharray: 2 2) |
| *(기본)* | 실선 |

> **Note**: 선 색상은 `stroke` prop으로 직접 지정하거나, 전역 테마에서 설정합니다. Tailwind의 `stroke-*` 클래스는 SVG 요소에만 적용되므로, 엣지 색상 변경 시 인라인 스타일 또는 `stroke` prop 사용을 권장합니다.
