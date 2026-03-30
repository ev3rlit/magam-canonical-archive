# Component Embedding (EmbedScope)

## 개요 및 문제 정의

### 문제: 단일 파일 비대화

Magam 프로젝트에서 하나의 `.tsx` 파일에 모든 마인드맵, 도형, 다이어그램을 작성하면 다음 문제가 발생합니다.

| 문제 | 설명 |
|------|------|
| AI 토큰 낭비 | AI가 전체 파일을 읽어야 하므로 컨텍스트 토큰 소모 증가 |
| 편집 성능 저하 | 큰 파일의 `code.write()` 시 전체 덮어쓰기 → 충돌 위험 |
| 유지보수 어려움 | 하나의 파일에 여러 관심사가 혼합 → 변경 범위 불명확 |
| 협업 제약 | 같은 파일을 동시에 수정하기 어려움 |

### 해결 방향: 파일 분산 + React 컴포넌트 조합

여러 파일에 분산된 마인드맵/도형/다이어그램을 일반적인 React `export/import` 패턴으로 조합합니다. ID 충돌 방지를 위해 **React Context 기반의 `EmbedScope`**로 네임스페이스를 격리합니다.

```
해결 전: overview.tsx (500줄, 모든 요소 포함)
해결 후:
  overview.tsx (50줄, import + EmbedScope 조합)
  components/auth-flow.tsx (100줄)
  components/data-layer.tsx (80줄)
  components/api-arch.tsx (120줄)
```

---

## 설계 철학: React-native Approach

### 커스텀 엘리먼트 vs React Context

| 비교 | 커스텀 엘리먼트 (`graph-embed`) | React Context (`EmbedScope`) |
|------|-------------------------------|------------------------------|
| Reconciler 변경 | 필요 (`appendInitialChild` 수정) | **불필요** |
| Frontend 변경 | 필요 (`processChildren` 수정) | **불필요** |
| 중첩 지원 | 별도 구현 필요 | **Context 체이닝으로 자연스럽게 동작** |
| React 패턴 | Magam 전용 개념 | **표준 React 패턴** (Context + Hook) |
| 학습 비용 | 새로운 커스텀 엘리먼트 학습 | **useContext를 아는 사람이면 즉시 이해** |

**선택: React Context 방식**

`EmbedScope`는 렌더 트리에 어떤 호스트 엘리먼트도 추가하지 않습니다. 순수하게 React Context만 제공하며, 각 컴포넌트가 hook을 통해 자신의 ID를 스코핑합니다.

```
기존 렌더 트리:
  graph-canvas → graph-embed → graph-shape(id="jwt")
                                ↑ reconciler가 embed 처리

Context 방식 렌더 트리:
  graph-canvas → graph-shape(id="auth.jwt")
                  ↑ Shape 컴포넌트가 hook으로 직접 prefix
```

---

## 핵심 API: `EmbedScope` + `useNodeId`

### EmbedScope (Context Provider)

ID 네임스페이스를 제공하는 순수 React Context Provider입니다.

```tsx
// libs/core/src/context/EmbedScopeContext.tsx
import { createContext, useContext } from 'react';

const EmbedScopeContext = createContext<string | undefined>(undefined);

export function useEmbedScope(): string | undefined {
  return useContext(EmbedScopeContext);
}

export { EmbedScopeContext };
```

```tsx
// libs/core/src/components/EmbedScope.tsx
import * as React from 'react';
import { EmbedScopeContext, useEmbedScope } from '../context/EmbedScopeContext';

interface EmbedScopeProps {
  id: string;
  children: React.ReactNode;
}

export function EmbedScope({ id, children }: EmbedScopeProps) {
  const parentScope = useEmbedScope();
  const fullScope = parentScope ? `${parentScope}.${id}` : id;

  return (
    <EmbedScopeContext.Provider value={fullScope}>
      {children}
    </EmbedScopeContext.Provider>
  );
}
```

**특징:**
- 렌더 트리에 아무것도 추가하지 않음 (순수 Context)
- 중첩 시 자동으로 스코프 체이닝 (`"auth"` → `"auth.social"`)
- 기존 Reconciler, Frontend 코드 변경 없음

### useNodeId (Hook)

컴포넌트 내부에서 현재 스코프에 맞게 ID를 해석하는 hook입니다.

```tsx
// libs/core/src/hooks/useNodeId.ts
import { useEmbedScope } from '../context/EmbedScopeContext';

export function useNodeId(id: string | undefined): string | undefined {
  const scope = useEmbedScope();

  if (!id) return id;
  if (id.includes('.')) return id;  // 이미 완전한 ID (cross-boundary 참조)
  if (!scope) return id;            // EmbedScope 밖 → prefix 없음
  return `${scope}.${id}`;
}
```

**규칙:**
- dot(`.`)이 포함된 ID → 이미 fully qualified → prefix 안 함
- scope가 없음 → Canvas 직접 자식 → prefix 안 함
- scope가 있고 dot 없음 → prefix 적용

### Import

```tsx
import { Canvas, EmbedScope, Shape, Edge } from 'magam';
```

### Props 명세

| Prop | 타입 | 필수 | 설명 |
|------|------|------|------|
| `id` | string | **O** | 스코프 식별자. 내부 노드의 네임스페이스 접두사로 사용 |
| `children` | ReactNode | **O** | 스코프 내부의 컴포넌트들 |

> `EmbedScope`는 좌표, 시각적 경계 등 렌더링 관련 prop이 없습니다. 포지셔닝은 내부 컴포넌트나 `Group` 래핑으로 처리합니다.

---

## 컴포넌트 통합: 누가 `useNodeId`를 쓰는가

### 변경되는 컴포넌트

각 컴포넌트에 `useNodeId` hook 호출 한 줄만 추가합니다.

**Shape.tsx**

```tsx
export const Shape: React.FC<ShapeProps> = (props) => {
  const scopedId = useNodeId(props.id);    // 추가
  // ... 기존 validation ...
  return React.createElement('graph-shape', { ...props, id: scopedId }, props.children);
};
```

**Sticky.tsx, Text.tsx, Group.tsx** - 동일 패턴

```tsx
export const Sticky: React.FC<StickyProps> = (props) => {
  const scopedId = useNodeId(props.id);
  return React.createElement('graph-sticky', { ...props, id: scopedId }, props.children);
};
```

**MindMap.tsx**

```tsx
export const MindMap: React.FC<MindMapProps> = ({ id, ...rest }) => {
  const scopedId = useNodeId(id);          // 추가
  return React.createElement('graph-mindmap', { id: scopedId, ...rest });
};
```

**Edge.tsx** - `from`과 `to`를 스코핑

```tsx
export const Edge: React.FC<EdgeProps> = (props) => {
  const scopedFrom = useNodeId(props.from);  // 추가
  const scopedTo = useNodeId(props.to);      // 추가
  return React.createElement('graph-edge', { ...props, from: scopedFrom, to: scopedTo });
};
```

### 변경하지 않는 컴포넌트

| 컴포넌트 | 이유 |
|----------|------|
| **Node** | MindMap 내부 전용. ID 스코핑은 `processChildren`의 MindMap 메커니즘이 처리. MindMap의 ID가 이미 prefixed이므로 자연스럽게 `auth.map.root` 형태로 해석됨 |
| **Canvas** | 루트 컨테이너. 스코프 대상 아님 |
| **Code, Table, Markdown, Link** | 콘텐츠 컴포넌트. 외부에서 참조하는 ID를 가지지 않음 |
| **EdgePort** | Edge 연결점 전용. 부모 노드의 ID 범위 내에서 동작 |

### 작동 흐름 다이어그램

```
사용자 코드:
  <EmbedScope id="auth">          ← Context: "auth"
    <Shape id="jwt" x={0} y={0}>  ← useNodeId("jwt") → "auth.jwt"
      <Edge to="oauth" />         ← useNodeId("oauth") → "auth.oauth"
    </Shape>                          from은 undefined → reconciler가 "auth.jwt" 주입
  </EmbedScope>

Reconciler 입력 (graph-* 트리):
  graph-shape { id: "auth.jwt" }
    graph-edge { from: "auth.jwt", to: "auth.oauth" }

processChildren 출력 (React Flow):
  Node: { id: "auth.jwt", ... }
  Edge: { source: "auth.jwt", target: "auth.oauth" }
```

---

## 파일 구조 및 임포트 패턴

### 컴포넌트 파일 작성법

컴포넌트 파일은 일반적인 React 컴포넌트입니다. EmbedScope를 의식할 필요 없이 로컬 ID만 사용합니다.

**MindMap 컴포넌트**

```tsx
// components/auth-mindmap.tsx
import { MindMap, Node } from 'magam';

export function AuthMindMap() {
  return (
    <MindMap id="map" x={0} y={0} layout="tree">
      <Node id="root">인증 시스템</Node>
      <Node id="jwt" from="root">JWT</Node>
      <Node id="oauth" from="root">OAuth</Node>
      <Node id="session" from="root">Session</Node>
    </MindMap>
  );
}
```

**Shape 컴포넌트**

```tsx
// components/data-layer.tsx
import { Shape, Edge } from 'magam';

export function DataLayer() {
  return (
    <>
      <Shape id="postgres" x={0} y={0} shape="rectangle">PostgreSQL</Shape>
      <Shape id="redis" x={0} y={120} shape="rectangle">Redis</Shape>
      <Edge from="postgres" to="redis" label="cache" />
    </>
  );
}
```

### 부모 파일에서의 import + EmbedScope 래핑

```tsx
// overview.tsx
import { Canvas, EmbedScope, Group, Edge } from 'magam';
import { AuthMindMap } from './components/auth-mindmap';
import { DataLayer } from './components/data-layer';
import { ApiArchitecture } from './components/api-architecture';

export default function Overview() {
  return (
    <Canvas>
      {/* EmbedScope만으로 ID 격리 */}
      <EmbedScope id="auth">
        <AuthMindMap />
      </EmbedScope>

      {/* Group과 조합하면 포지셔닝 + ID 격리 */}
      <EmbedScope id="data">
        <Group id="data-frame" x={100} y={400}>
          <DataLayer />
        </Group>
      </EmbedScope>

      <EmbedScope id="api">
        <ApiArchitecture />
      </EmbedScope>

      {/* 크로스 바운더리 Edge (Canvas 레벨) */}
      <Edge from="api.gateway" to="data.postgres" label="query" />
      <Edge from="auth.map.jwt" to="api.services" label="validate" />
    </Canvas>
  );
}
```

### EmbedScope 없이 import만 하기 (ID 충돌이 없는 경우)

ID가 컴포넌트 간에 겹치지 않으면 EmbedScope 없이 직접 사용해도 됩니다.

```tsx
// EmbedScope 없이 - 기존 React 방식 그대로
import { Canvas, Edge } from 'magam';
import { AuthMindMap } from './components/auth-mindmap';
import { DataLayer } from './components/data-layer';

export default function Simple() {
  return (
    <Canvas>
      <AuthMindMap />
      <DataLayer />
      <Edge from="jwt" to="postgres" />
    </Canvas>
  );
}
```

> EmbedScope는 **선택적**입니다. ID 충돌이 우려될 때만 사용하면 됩니다.

### 트랜스파일러

esbuild의 `bundle: true` 설정이 이미 상대 경로 import를 해석하므로, 트랜스파일러 변경은 불필요합니다.

```
overview.tsx  ──esbuild──>  단일 JS (모든 import resolved)
                            ──renderer──>  graph-* 트리 (ID 이미 prefixed)
```

---

## ID 스코핑 전략

### 기존 패턴과의 일관성

기존 MindMap은 `mindmapId.nodeId` 패턴으로 ID를 네임스페이싱합니다.

```
Canvas 노드:     nodeId                (예: "api-server")
MindMap 노드:    mindmapId.nodeId      (예: "auth-map.jwt")
```

EmbedScope는 이 패턴을 확장합니다.

```
EmbedScope 내부 노드:           scope.nodeId          (예: "auth.jwt")
EmbedScope 내부 MindMap 노드:   scope.mmId.nodeId      (예: "auth.map.root")
```

### ID 해석 규칙 (`useNodeId`)

| 입력 ID | EmbedScope | 결과 | 이유 |
|---------|-----------|------|------|
| `"jwt"` | 없음 | `"jwt"` | scope 없음 → 그대로 |
| `"jwt"` | `id="auth"` | `"auth.jwt"` | scope + id |
| `"root"` | `id="auth"` 중첩 `id="social"` | `"auth.social.root"` | 체이닝된 scope |
| `"backend.api"` | `id="auth"` | `"backend.api"` | dot 포함 → 이미 qualified |

### MindMap과의 상호작용

EmbedScope 안에 MindMap이 있을 때, ID가 2단계로 해석되는 과정:

```tsx
<EmbedScope id="auth">              // scope: "auth"
  <MindMap id="map" x={0} y={0}>    // useNodeId("map") → "auth.map"
    <Node id="root">Root</Node>     // (useNodeId 안 씀)
    <Node id="jwt" from="root" />   // (useNodeId 안 씀)
  </MindMap>
</EmbedScope>
```

```
Step 1 - 컴포넌트 렌더링:
  MindMap: useNodeId("map") → "auth.map"
  Node:    id="root", from="root" (원본 그대로)

Step 2 - processChildren (기존 로직, 변경 없음):
  mindmapId = "auth.map" (MindMap의 이미 prefixed된 ID)
  resolveNodeId("root", "auth.map") → "auth.map.root"
  resolveNodeId("root", "auth.map") → "auth.map.root" (from 해석)

결과: Node ID = "auth.map.root", Edge = "auth.map.root" → "auth.map.jwt"
```

기존 `processChildren`과 `resolveNodeId`는 **변경 없이** 동작합니다. MindMap의 ID가 이미 embed scope를 포함하고 있기 때문입니다.

### 중첩 EmbedScope

Context 체이닝으로 자연스럽게 동작합니다.

```tsx
<EmbedScope id="infra">
  <EmbedScope id="aws">
    <Shape id="ec2" x={0} y={0}>EC2</Shape>
    {/* id = "infra.aws.ec2" */}
  </EmbedScope>
  <EmbedScope id="gcp">
    <Shape id="gce" x={200} y={0}>GCE</Shape>
    {/* id = "infra.gcp.gce" */}
  </EmbedScope>
</EmbedScope>
```

---

## 크로스 바운더리 Edge

### 연결 패턴

**Canvas에서 EmbedScope 내부로**

```tsx
<Canvas>
  <Shape id="external" x={0} y={0} shape="circle">External</Shape>
  <EmbedScope id="auth">
    <Shape id="jwt" x={200} y={0} shape="rectangle">JWT</Shape>
  </EmbedScope>

  {/* Canvas 레벨 Edge: scope 밖이므로 dot notation으로 직접 참조 */}
  <Edge from="external" to="auth.jwt" />
</Canvas>
```

**EmbedScope 간 연결**

```tsx
<Canvas>
  <EmbedScope id="frontend">
    <Shape id="app" x={0} y={0} shape="rectangle">React App</Shape>
  </EmbedScope>
  <EmbedScope id="backend">
    <Shape id="api" x={400} y={0} shape="rectangle">API Server</Shape>
  </EmbedScope>

  <Edge from="frontend.app" to="backend.api" label="HTTP" />
</Canvas>
```

**EmbedScope 내부에서 외부로**

```tsx
// components/auth-flow.tsx
export function AuthFlow() {
  return (
    <>
      <Shape id="login" x={0} y={0} shape="rectangle">Login</Shape>
      {/* dot이 포함된 ID → useNodeId가 prefix 안 함 → 외부 참조 */}
      <Edge from="login" to="backend.api" label="authenticate" />
    </>
  );
}
```

### 작동 원리

`useNodeId`의 `id.includes('.')` 체크가 핵심입니다.

```
EmbedScope id="auth" 안에서:
  <Edge from="login" to="backend.api" />

  useNodeId("login")       → "auth.login"    (dot 없음 → prefix)
  useNodeId("backend.api") → "backend.api"   (dot 있음 → 그대로)
```

기존 `resolveNodeId`의 동일한 규칙을 컴포넌트 레벨에서 재사용합니다.

---

## 렌더링 파이프라인 변경 요약

### Context 방식의 최대 장점: 기존 파이프라인 변경 없음

```
┌─────────────────────────────────────────────────────────┐
│                    변경 범위                              │
├──────────────────────┬──────────────────────────────────┤
│  Core                │  EmbedScope.tsx 신규 추가         │
│  (libs/core/src/)    │  useNodeId.ts 신규 추가          │
│                      │  기존 컴포넌트에 hook 1줄 추가     │
│                      │  index.ts에 export 추가          │
├──────────────────────┼──────────────────────────────────┤
│  Reconciler          │  변경 없음                        │
│  (hostConfig.ts)     │                                  │
├──────────────────────┼──────────────────────────────────┤
│  Frontend            │  변경 없음                        │
│  (page.tsx)          │  processChildren 그대로           │
│                      │  resolveNodeId 그대로             │
├──────────────────────┼──────────────────────────────────┤
│  Transpiler          │  변경 없음                        │
│                      │  esbuild bundle: true가          │
│                      │  이미 상대 import 처리            │
└──────────────────────┴──────────────────────────────────┘
```

### 커스텀 엘리먼트 방식과 비교

| 항목 | 커스텀 엘리먼트 | Context |
|------|---------------|---------|
| 신규 파일 | 1 (`Embed.tsx`) | 2 (`EmbedScope.tsx`, `useNodeId.ts`) |
| 기존 파일 변경 | 3 (`hostConfig.ts`, `page.tsx`, `index.ts`) | 8 (6 컴포넌트 + `context/` + `index.ts`) |
| 변경 줄 수/파일 | 10~50줄씩 | **1줄씩** (hook 호출 추가) |
| Reconciler 변경 | O | **X** |
| Frontend 변경 | O | **X** |
| 테스트 범위 | 파이프라인 전체 | **컴포넌트 단위** |

변경 파일 수는 많지만, **각 변경이 hook 1줄 추가로 극도로 단순**합니다. 반면 Reconciler/Frontend 같은 핵심 파이프라인은 전혀 건드리지 않아 회귀 위험이 낮습니다.

---

## 시각적 경계 (선택적)

EmbedScope는 순수 Context이므로 시각적 요소가 없습니다. 경계 표시가 필요하면 `Group`으로 래핑합니다.

### Group 래핑 패턴

```tsx
<EmbedScope id="auth">
  <Group id="auth-frame" x={100} y={100}
         className="border border-dashed border-slate-300 rounded-lg p-4">
    <Text id="auth-label" x={4} y={-16} className="text-xs text-slate-400">
      Authentication
    </Text>
    <AuthMindMap />
  </Group>
</EmbedScope>
```

```
┌ · · · · · · · · · · · · · ┐
  Authentication
· ┌─────────┐  ┌──────────┐ ·
· │  JWT     │──│  OAuth   │ ·
· └─────────┘  └──────────┘ ·
└ · · · · · · · · · · · · · ┘
```

### 시각적 경계 없이 (기본)

```tsx
<EmbedScope id="auth">
  <AuthMindMap />
</EmbedScope>
```

캔버스에서 EmbedScope의 존재는 보이지 않습니다. 내부 요소만 렌더링됩니다.

---

## MCP 도구 확장

### 추가 도구

```typescript
// 컴포넌트 목록 조회 (기존 project.listComponents 활용)
project.listComponents(): Component[]
// 응답: [{ id: "auth-mindmap", filepath: "./components/auth-mindmap.tsx" }]

// 컴포넌트 코드 읽기
code.readComponent(componentId: string): { filepath: string, content: string }

// 컴포넌트 코드 쓰기
code.writeComponent(componentId: string, content: string): { success: boolean }
```

> 기존 `page-group` 설계의 `project.listComponents`, `code.readComponent`와 동일한 MCP 인터페이스를 재사용합니다. EmbedScope 전용 도구를 추가할 필요가 없습니다.

### AI 워크플로우 시나리오

```
사용자: "인증 컴포넌트에 2FA 노드 추가해줘"

AI:
1. project.listComponents() → auth-mindmap 컴포넌트 확인
2. code.readComponent("auth-mindmap") → 현재 코드 확인
3. auth-mindmap.tsx에 <Node id="2fa" from="root">2FA</Node> 추가
4. code.writeComponent("auth-mindmap", newCode)
→ overview.tsx 수정 불필요. 파일 단위 편집.
```

```
사용자: "data와 api를 연결해줘"

AI:
1. code.read("overview") → 현재 코드 확인
2. EmbedScope ID 확인: "data", "api"
3. overview.tsx에 <Edge from="api.gateway" to="data.postgres" /> 추가
4. code.write("overview", newCode)
```

---

## 확장된 컴포넌트 계층 다이어그램

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
├── 스코프 (신규 - 순수 논리 컴포넌트)
│   └── EmbedScope (ID 네임스페이스 격리)
│       ├── Sticky, Shape, Text (ID가 자동 prefixed)
│       ├── Group (ID가 자동 prefixed)
│       ├── MindMap (ID가 자동 prefixed)
│       │   └── Node (MindMap이 처리)
│       └── EmbedScope (중첩 → 스코프 체이닝)
│
├── 연결선
│   └── Edge (from/to가 자동 prefixed, 크로스 바운더리 지원)
│
└── 마인드맵
    └── MindMap (자동 레이아웃)
        └── Node
```

---

## 제약 사항

### Phase 1 제약

| 제약 | 설명 |
|------|------|
| 순환 import 불허 | A가 B를 import하고 B가 A를 import하면 esbuild 에러 |
| 동일 scope ID 불허 | 같은 레벨에서 동일한 EmbedScope `id`는 충돌 |
| Node에는 적용 안됨 | MindMap 내부 Node의 ID는 processChildren이 관리 |

### Phase 1에서 불필요해진 제약 (Context 방식 장점)

| 이전 제약 | 이유 |
|----------|------|
| ~~Embed 중첩 불허~~ | Context 체이닝으로 자연스럽게 동작 |
| ~~Canvas 안에서만 사용~~ | Context는 아무 곳에나 배치 가능 |
| ~~최대 2단계~~ | 제한 없음 (단, 가독성을 위해 2~3단계 권장) |

### 향후 확장 가능 항목

| 항목 | 설명 |
|------|------|
| `EmbedFrame` 편의 컴포넌트 | EmbedScope + Group + border/label을 한 번에 제공 |
| 뷰어 사이드바 scope 표시 | EmbedScope 기반으로 컴포넌트 트리 시각화 |
| collapsed 지원 | scope 내부 요소를 뷰어에서 접기/펼치기 |
| scope 기반 선택 | 뷰어에서 scope 단위로 요소 일괄 선택 |

---

## 구현 단계 (Phases)

### Phase 1: EmbedScope + useNodeId + 컴포넌트 통합

| 작업 | 파일 |
|------|------|
| `EmbedScopeContext.tsx` 생성 | `libs/core/src/context/EmbedScopeContext.tsx` |
| `useNodeId.ts` 생성 | `libs/core/src/hooks/useNodeId.ts` |
| `EmbedScope.tsx` 생성 | `libs/core/src/components/EmbedScope.tsx` |
| `Shape.tsx`에 `useNodeId` 적용 | `libs/core/src/components/Shape.tsx` |
| `Sticky.tsx`에 `useNodeId` 적용 | `libs/core/src/components/Sticky.tsx` |
| `Text.tsx`에 `useNodeId` 적용 | `libs/core/src/components/Text.tsx` |
| `Group.tsx`에 `useNodeId` 적용 | `libs/core/src/components/Group.tsx` |
| `MindMap.tsx`에 `useNodeId` 적용 | `libs/core/src/components/MindMap.tsx` |
| `Edge.tsx`에 `useNodeId` 적용 (from, to) | `libs/core/src/components/Edge.tsx` |
| `index.ts`에 export 추가 | `libs/core/src/index.ts` |
| 기본 EmbedScope 렌더링 테스트 | `examples/` |

**변경량**: 신규 3파일 + 기존 7파일 각 1~2줄 수정

**완료 기준**: EmbedScope로 감싼 컴포넌트가 올바른 ID prefix로 렌더링되고, 크로스 바운더리 Edge가 동작함.

### Phase 2: 크로스 바운더리 Edge 검증 + 포지셔닝

| 작업 | 파일 |
|------|------|
| EmbedScope + MindMap 조합 테스트 | `examples/` |
| 크로스 바운더리 Edge 다양한 패턴 검증 | `examples/` |
| Group + EmbedScope 조합 포지셔닝 검증 | `examples/` |

**완료 기준**: `<Edge from="embed1.nodeA" to="embed2.nodeB" />`와 MindMap 내부 참조가 모두 올바르게 연결됨.

### Phase 3: `EmbedFrame` 편의 컴포넌트 (선택)

| 작업 | 파일 |
|------|------|
| `EmbedFrame.tsx` 생성 (EmbedScope + Group + border/label) | `libs/core/src/components/EmbedFrame.tsx` |
| collapsed 플레이스홀더 구현 | `app/components/` |

**완료 기준**: `<EmbedFrame id="auth" x={100} y={100} border label="Auth">` 단축 문법이 동작함.

### Phase 4: MCP 도구 확장

| 작업 | 파일 |
|------|------|
| `project.listComponents()` 구현 | MCP server |
| `code.readComponent()` 구현 | MCP server |
| `code.writeComponent()` 구현 | MCP server |

**완료 기준**: AI 에이전트가 MCP를 통해 개별 컴포넌트 파일을 읽고 쓸 수 있음.

---

## 핵심 설계 결정

| 결정 | 선택 | 근거 |
|------|------|------|
| 메커니즘 | React Context + Hook | 표준 React 패턴, Reconciler/Frontend 변경 불필요 |
| 컴포넌트 이름 | `EmbedScope` | 역할(스코프 제공)을 명확히 표현 |
| ID 스코핑 | dot notation (`scope.node`) | 기존 MindMap 패턴 (`mindmap.node`)과 일관성 |
| qualified ID 판별 | `id.includes('.')` | 기존 `resolveNodeId`와 동일한 규칙 재사용 |
| 시각적 경계 | EmbedScope와 분리 (Group으로 래핑) | 단일 책임 원칙. 로직(스코프)과 프레젠테이션(경계) 분리 |
| 중첩 지원 | Phase 1부터 지원 | Context 체이닝이 자연스럽게 처리하므로 별도 구현 불필요 |
| 트랜스파일러 | 변경 없음 | esbuild `bundle: true`가 이미 상대 import 해석 |
| Node 컴포넌트 | `useNodeId` 미적용 | MindMap의 processChildren이 이미 처리 |
