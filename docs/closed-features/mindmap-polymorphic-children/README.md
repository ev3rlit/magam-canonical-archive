# MindMap Polymorphic Children

MindMap의 자식으로 `Node`뿐 아니라 **임의의 컴포넌트**가 계층 구조에 참여할 수 있도록 개선합니다.

## 동기

현재 MindMap은 `Node` 컴포넌트만 계층 관계(`from`)를 가질 수 있습니다.
하지만 계층 관계는 시각적 표현과 직교하는 개념입니다.

- `from` prop은 "이 요소가 어디로부터 왔는지"를 표현
- `Node`의 외형(둥근 박스)은 시각적 스타일일 뿐

이 둘이 불필요하게 결합되어 있어 표현의 자유도가 제한됩니다.

## 목표

**`id`와 `from`을 가진 모든 컴포넌트가 MindMap 노드로 동작한다.**

```tsx
// Before: Node만 가능, from/edgeLabel/edgeClassName 별도 props
<MindMap id="map">
  <Node id="root">Central Idea</Node>
  <Node id="b1" from="root" edgeLabel="분기" edgeClassName="dashed">Branch 1</Node>
</MindMap>

// After: 어떤 컴포넌트든 가능, from이 엣지 설정을 포함
<MindMap id="map">
  <Sticky id="root">Central Idea</Sticky>
  <Node id="b1" from="root">Branch 1</Node>
  <Shape id="decision" from={{
    node: "root",
    edge: { label: { text: "판단", color: "#fff", bg: "#ef4444" }, pattern: "dashed", stroke: "#ef4444" }
  }} shape="diamond">
    Yes or No?
  </Shape>
  <Sequence id="flow" from={{ node: "b1", edge: { type: "step" } }}>
    <Participant id="a" label="A" />
    <Participant id="b" label="B" />
    <Message from="a" to="b" label="call" />
  </Sequence>
</MindMap>
```

중첩 MindMap은 지원하지 않는다. 대신 하나의 Canvas에서 여러 MindMap을 나란히 두는 것은 지원한다.

## `from` prop 설계

### 핵심 원칙

**자식이 자신의 출처를 선언한다.**

- "나는 root**로부터** 왔다" — 의존 방향이 자식 → 부모로 단방향
- 부모는 자식을 몰라도 됨 → 자식 추가/삭제가 자유로움
- 기존 `from`, `edgeLabel`, `edgeClassName` 3개 props를 `from` 하나로 통합

### API

```tsx
// 단순 연결 (80% 케이스)
<Node id="child" from="root">...</Node>

// 엣지 스타일링
<Shape id="decision" from={{
  node: "root",
  edge: { label: "Yes", stroke: "#ef4444", strokeWidth: 3, pattern: "dashed" }
}}>...</Shape>

// 방향 + 라벨 스타일링
<Sticky id="idea" from={{
  node: "root",
  edge: {
    type: "curved",
    stroke: "#3b82f6",
    direction: "forward",
    label: { text: "핵심", color: "#fff", bg: "#3b82f6", fontSize: 14 },
  }
}} color="blue">...</Sticky>

// 포트 지정
<Shape id="sub" from={{ node: "root:bottom", edge: { type: "step" } }}>...</Shape>
```

### 타입 정의

```typescript
type FromProp =
  | string                      // 부모 노드 ID (엣지 기본 스타일)
  | {
      node: string;             // 부모 노드 ID (포트 지정: "nodeId:portId")
      edge?: EdgeStyle;         // 엣지 시각 설정
    };
```

`from`은 **관계**(node)와 **시각**(edge) 두 관심사로만 나뉜다.

`EdgeStyle` 타입의 전체 정의는 [Edge Style](../edge-style/README.md) 참조.

## 현재 커플링 포인트

MindMap-Node 결합이 하드코딩된 위치 3곳:

| 위치 | 파일 | 내용 |
|------|------|------|
| 클라이언트 파싱 | `app/app/page.tsx` | `child.type === 'graph-node'` 체크로 MindMap 노드 인식 |
| ReactFlow 노드 생성 | `app/app/page.tsx` | `graph-node`일 때만 `groupId`, edge 생성 |
| ELK 레이아웃 | `app/hooks/useLayout.ts` | `groupId` 기반 그룹핑 |

## 디커플링 전략

### 판별 기준 전환: 타입 체크 → `from` 유무

현재 MindMap 컨텍스트 안에서 자식을 인식하는 기준이 `child.type === 'graph-node'`이다.
이것을 **`from` prop 유무** 기반으로 전환한다.

```
Before: MindMap 안의 graph-node만 트리에 참여
After:  MindMap 안에서 from을 가진 모든 자식이 트리에 참여
        + from이 없는 자식은 예외(파싱 에러)로 처리
```

### 커플링 #1: 클라이언트 파싱 (`page.tsx processChildren`)

**현재**: `child.type === 'graph-node'`일 때만 MindMap 노드로 인식

**변경**: MindMap 컨텍스트(`mindmapId` 존재) 안의 모든 자식을 대상으로:
1. `child.props.from`이 있으면 → MindMap 트리의 자식 노드
2. `child.props.from`이 없으면 → 파싱 에러 (명시적 관계 강제)
3. 유효한 자식은 `child.type`에 관계없이 `groupId: mindmapId` 부여

```typescript
// Before
if (child.type === 'graph-node') {
  // MindMap 노드 처리
}

// After
if (mindmapId) {
  // MindMap 컨텍스트 안의 모든 자식 → 트리 참여
  const nodeId = resolveNodeId(child.props.id, mindmapId);
  const nodeType = resolveNodeType(child.type); // graph-node → shape, graph-sticky → sticky, ...

  if (!child.props.from) {
    throw new Error(`[MindMap:${mindmapId}] node "${nodeId}" is missing required from prop.`);
  }

  nodes.push({
    id: nodeId,
    type: nodeType,
    data: { ...child.props, groupId: mindmapId },
    position: { x: 0, y: 0 }, // ELK가 배치
  });

  const from = parseFromProp(child.props.from);
  edges.push(createEdgeFromProp(from, nodeId, mindmapId));
}
```

### 커플링 #2: `from` prop 파싱 → Edge 생성

**현재**: `child.props.from`(string), `edgeLabel`, `edgeClassName` 3개를 개별 처리

**변경**: `parseFromProp()` + `createEdgeFromProp()` 헬퍼가 통합 처리

```typescript
function parseFromProp(from: FromProp): ParsedFrom {
  if (typeof from === 'string') {
    return { node: from, edge: {} };
  }
  return { node: from.node, edge: from.edge ?? {} };
}
```

`createEdgeFromProp()`의 전체 구현은 [Edge Style — ReactFlow 매핑](../edge-style/README.md#reactflow-매핑) 참조.

구현에서는 `app/app/mindmapParser.ts`의 `parseFromProp()` + `buildMindMapEdge()`를 parser 공용 경계로 사용한다.

### 커플링 #3: ELK 레이아웃 (`useLayout.ts`)

**현재 상태**: 이미 `groupId` 기반으로 필터링 — 타입 무관

```typescript
const groupNodes = nodes.filter(n => n.data?.groupId === group.id);
```

**변경 불필요**. `groupId`만 올바르게 설정하면 어떤 컴포넌트든 ELK 레이아웃에 참여한다.

단, ELK에 넘기는 노드 크기가 정확해야 한다 → 아래 "노드 크기 측정" 참조.

## 노드 크기 측정

### 핵심 문제

MindMap 레이아웃(ELK)은 각 노드의 **실제 크기**를 알아야 배치할 수 있다.
Node 컴포넌트만 쓸 때는 크기가 비교적 균일했지만, Sticky·Shape·Sequence 등이 섞이면 크기 편차가 커진다.

### 현재 측정 파이프라인

```
React Flow가 DOM 렌더 → 브라우저 측정 → node.measured에 저장
→ GraphCanvas가 모든 노드 측정 완료 확인
→ ELK에 measured 크기 전달 → 레이아웃 계산
```

크기 우선순위 (`layoutUtils.ts`):
```typescript
node.measured?.width  ??  node.width  ??  node.data?.width  ??  150
node.measured?.height ??  node.height ??  node.data?.height ??  50
```

### 컴포넌트별 기본 크기

| 컴포넌트 | 기본 크기 | 크기 결정 방식 |
|----------|----------|---------------|
| `Node` (shape) | 150×50 | 콘텐츠 기반, fallback 150×50 |
| `Sticky` | 160×96 min | `minWidth: 160, maxWidth: 360, minHeight: 96` |
| `Shape` | 144×80 min | Tailwind `min-w-36 min-h-20` |
| `Text` | 50 min width | 콘텐츠 기반 |
| `Sequence` | 콘텐츠 기반 | 내부 참여자/메시지에 따라 가변 |

### 해결 방향: DOM 측정에 위임 (변경 최소화)

현재 파이프라인이 이미 **DOM 측정 → ELK** 순서로 동작하므로, 새 컴포넌트가 MindMap에 들어와도 같은 경로를 탄다:

1. React Flow가 Sticky/Shape/Sequence를 DOM에 렌더
2. 브라우저가 각 컴포넌트의 실제 크기를 측정 (`node.measured`)
3. `GraphCanvas`가 모든 노드 측정 완료를 확인
4. ELK가 측정된 크기로 레이아웃 계산

**추가 작업 없이 동작하는 이유**: `getNodeDimensions()`가 타입이 아니라 `measured` 값을 보기 때문.

### 비동기 렌더 콘텐츠 재측정: 계산 레이어 분석

현재 구현 기준 계산 레이어는 다음 순서로 동작한다.

1. `app/app/page.tsx`가 파싱 결과를 `setGraph()`에 저장하면 `graphId`가 갱신된다.
2. `app/components/GraphCanvas.tsx`는 `graphId` 변경 시 `hasLayouted=false`로 초기화하고 relayout refs를 리셋한다.
3. 같은 파일의 레이아웃 effect는 아래 조건을 만족할 때 1회 실행된다.
   - `nodesInitialized === true`
   - 모든 노드 `width/height > 0`
   - `hasLayouted === false`
4. effect 내부에서 `requestAnimationFrame` 1프레임 대기 후 width/height를 다시 검증한다.
5. `calculateLayout()`(`app/hooks/useLayout.ts`)가 그룹별 ELK 배치와 전역 그룹 배치를 수행한다.
6. 초기 레이아웃 성공 시 `lastSizeSignatureRef`에 MindMap 시그니처를 저장하고 `hasLayouted=true`로 전환한다.
7. 이후 별도 effect가 `getMindMapSizeSignature()` 변경을 감지하면 debounce 후 auto-relayout를 실행한다.

핵심 관찰:

- React Flow 재측정 이후에도 auto-relayout는 `needsAutoLayout=true` + guard 통과 시에만 실행된다.
- auto-relayout는 `debounce + cooldown + in-flight + max-attempt`로 bounded하게 제한된다.
- auto-relayout 경로는 `fitViewOnComplete: false`로 실행되어 반복 fitView 점프를 막는다.

### 재레이아웃 트리거 구현안

목표: 초기 레이아웃 이후에도 MindMap 노드 크기 변화가 발생하면 자동으로 ELK를 재실행한다.

#### 적용 범위

- `needsAutoLayout === true`일 때만 동작 (MindMap 모드)
- 다중 MindMap 지원: `mindMapGroups` 전체를 한 번에 재레이아웃
- Canvas-only 모드(`needsAutoLayout === false`)는 기존 anchor 해석 로직 유지

#### 트리거 조건

`GraphCanvas`에서 다음 조건을 모두 만족하면 재레이아웃 예약:

1. 초기 레이아웃이 이미 1회 완료(`hasLayouted === true`)
2. 모든 노드가 측정 완료(`width/height > 0`)
3. MindMap 참여 노드(`data.groupId` 존재)의 크기 시그니처가 마지막 레이아웃 시점과 다름

크기 시그니처는 다음과 같이 계산:

```typescript
signature = sortById(
  mindMapNodes.map((n) => `${n.id}:${q(n.width)}x${q(n.height)}`)
).join('|');

function q(value: number) {
  return Math.round(value / 2) * 2; // 2px 양자화로 미세 흔들림 무시
}
```

#### 실행 정책 (초기값)

- 디바운스: `120ms`
- 최소 변화 임계값: `2px` (시그니처 양자화로 흡수)
- 그래프당 최대 자동 재레이아웃 횟수: `3회`
- 쿨다운: 직전 재레이아웃 완료 후 `250ms` 이내 중복 예약 차단

#### 상태/가드 설계 (`GraphCanvas.tsx`)

```typescript
const lastSizeSignatureRef = useRef<string | null>(null);
const relayoutCountRef = useRef<Map<string, number>>(new Map()); // key: graphId
const relayoutTimerRef = useRef<number | null>(null);
const relayoutInFlightRef = useRef(false);
const lastRelayoutAtRef = useRef(0);
```

- `graphId` 변경 시 초기화:
  - `lastSizeSignatureRef = null`
  - 해당 `graphId`의 카운터를 `0`으로 시작
  - pending timer 정리
- 초기 레이아웃 성공 직후:
  - `lastSizeSignatureRef = currentSignature`
- 이후 노드 크기 변동 감지 시:
  - 정책 가드를 통과하면 디바운스 예약
  - 예약 콜백에서 `calculateLayout({ direction: 'RIGHT', mindMapGroups, fitViewOnComplete: false })` 실행
  - 성공 시 `lastSizeSignatureRef` 갱신 + 카운터 증가

#### 무한 루프 방지

- `relayoutInFlightRef === true`이면 신규 예약 금지
- `relayoutCount >= 3`이면 자동 재레이아웃 중단하고 로그만 남김
- 레이아웃 직후 발생하는 미세 크기 떨림은 2px 양자화 + 250ms 쿨다운으로 흡수

#### 실패 처리

- 재레이아웃 실패 시에도 UI는 유지(기존 노드 표시 유지)
- `relayoutInFlightRef`와 timer 상태는 반드시 정리
- 다음 유효 트리거에서 재시도 가능 (카운터 한도 내)

#### 검증 시나리오

1. MindMap 노드 안 이미지가 늦게 로드되어 크기가 커지면 자동 재레이아웃 1회 실행
2. Markdown 코드 블록 하이라이팅 후 높이 증가 시 자동 재레이아웃 실행
3. 다중 MindMap 캔버스에서 한 그룹 크기 변화 시 전체 그룹 배치가 안정적으로 재정렬
4. 크기 흔들림이 지속되어도 3회 한도 이후 무한 재실행이 발생하지 않음

### 주의할 케이스

- **비동기 콘텐츠**: 이미지, 코드 하이라이팅 등으로 렌더 후 크기가 바뀌는 경우 → 재측정 이후 ELK 재실행 트리거가 필요
- **from 누락**: MindMap 자식이 `from` 없이 선언되면 예외로 처리되어야 함 (루트 추정 금지)
- **중첩 MindMap**: 지원하지 않는 사용 방식으로 간주하고 파싱 단계에서 에러 처리
- **다중 MindMap(캔버스 병렬 배치)**: 지원 범위. 각 그룹은 `groupId`로 분리되고 전역 배치 단계에서 함께 정렬됨
- **Sequence 등 복합 컴포넌트**: 내부 레이아웃을 가진 컴포넌트는 렌더가 완료될 때까지 크기가 불확실

## 설계 원칙

1. **자식이 출처를 선언한다** — `from`으로 자식이 부모를 지목, 부모는 자식을 모름
2. **`from`이 엣지를 소유한다** — 연결 관계와 엣지 시각 속성이 하나의 prop에 응집
3. **컴포넌트 타입이 아니라 `from` 유무가 계층 참여를 결정**
4. **각 컴포넌트는 자신의 렌더링을 유지** — Sticky는 Sticky답게, Shape는 Shape답게
5. **MindMap은 레이아웃만 담당** — 자식의 시각적 표현에 관여하지 않음
6. **크기는 DOM에 위임** — 컴포넌트가 스스로 렌더한 결과를 브라우저가 측정, ELK가 사용

## 영향 받는 컴포넌트

MindMap 자식으로 사용 가능해지는 컴포넌트:

| 컴포넌트 | 현재 위치 | MindMap 노드로서의 의미 |
|----------|----------|----------------------|
| `Node` | MindMap 전용 | 기존과 동일 (경량 노드) |
| `Sticky` | Canvas | 포스트잇 스타일의 마인드맵 노드 |
| `Shape` | Canvas | 다이아몬드, 원 등 도형 노드 |
| `Sequence` | Canvas | 시퀀스 다이어그램이 하나의 노드로 |
| `Code` | Canvas/Node 내부 | 코드 블록이 독립 노드로 |
| `Table` | Node 내부 | 테이블이 독립 노드로 |

## 관련 문서

- [Edge Style](../edge-style/README.md) — `EdgeStyle` 공용 타입, 방향, 라벨, 사용처
- [Layout Strategy 아키텍처](../layout-strategy/README.md) — 레이아웃 문제 정의, Strategy 패턴 개선, Treemap/Compact Tree 후보

## 시각적 소재로 인상 남기기

Polymorphic Children이 가능해지면, 마인드맵이 다이어리 꾸미기처럼 됩니다:

```tsx
<MindMap id="project" edgeDefaults={{ stroke: "#94a3b8" }}>
  <Sticky id="root" color="yellow">프로젝트 계획</Sticky>

  <Node id="goal" from={{
    node: "root",
    edge: { stroke: "#f59e0b", strokeWidth: 3, label: { text: "1단계", bg: "#fbbf24" } }
  }}>목표 설정</Node>

  <Sticky id="idea" from={{
    node: "root",
    edge: { type: "curved", stroke: "#ec4899" }
  }} color="pink">핵심 아이디어</Sticky>

  <Shape id="deadline" from={{
    node: "root",
    edge: { pattern: "dashed", stroke: "#dc2626", label: { text: "D-30", color: "#fff", bg: "#dc2626", fontSize: 12 } }
  }} shape="diamond">마감일</Shape>

  <WashiTape id="tape" at={attach({ target: "root", placement: "top" })} />
  <Sticker id="star" anchor="idea" position="top-right">⭐</Sticker>
</MindMap>
```

- 정보 구조는 `from`이 담당 (계층)
- 엣지 시각은 `from.edge`가 담당 → [EdgeStyle 상세](../edge-style/README.md)
- 시각적 인상은 컴포넌트 자체가 담당 (Sticky=메모, WashiTape=장식, Sticker=강조)
- 같은 정보도 시각적 인상이 있으면 기억에 남음
