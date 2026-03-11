# Contract: MindMap Layout Runtime Pipeline

## 목적

`MindMap.layout="compact"`가 parser, store, strategy registry, layout hook을 따라 일관되게 전달되는 런타임 계약을 정의한다.

## Pipeline

```text
MindMap prop
  -> parseRenderGraph
  -> graph store (MindMapGroup / GraphState)
  -> useLayout
  -> strategy registry
  -> compact dense strategy
  -> global group offsets
```

## 계약

### 1) Parser contract

- `parseRenderGraph`는 `layout="compact"`를 MindMap group의 `layoutType: 'compact'`로 파싱해야 한다.
- group-level `spacing` 값이 있으면 함께 전달해야 한다.
- `spacing`이 없으면 parser/store/runtime은 기본 spacing 값 `50`을 기준으로 동작해야 한다.
- dense layout은 내부 group topology만 바꾸며, edge/source-target 연결은 parser가 만든 관계를 그대로 사용한다.

### 2) Store contract

- `graph` store는 `layoutType: 'compact'`를 안정형 값으로 유지해야 한다.
- store는 dense layout을 위해 별도의 경쟁 state system을 도입하지 않는다.
- 자동 재배치 guard 상태가 필요하면 기존 graph/layout state에 국소적으로 추가한다.

### 3) Strategy registry contract

- registry는 `'compact'` 요청에 dense layout strategy를 반환해야 한다.
- 기존 실험용 `compact-bidir`, `depth-hybrid`, `quadrant-pack`, `voronoi-pack`는 별도 실험 값으로 남을 수 있지만 dense stable path를 대체해서는 안 된다.

### 4) Layout execution contract

- `useLayout`는 그룹 내부 좌표 계산에 dense compact strategy를 사용하고, 이후 전역 group offset 계산은 기존 `globalLayoutResolver`를 그대로 적용한다.
- 내부 dense layout의 결과 좌표는 group origin 기준 상대 좌표여야 한다.
- dense compact strategy는 단일 루트와 멀티 루트 그룹을 모두 지원해야 하며, 멀티 루트 그룹에서는 각 root subtree와 top-level root cluster를 같은 compact 규칙으로 배치해야 한다.
- 다중 MindMap 그룹은 서로 독립적으로 내부 layout을 계산해야 한다.

### 5) Relayout contract

- post-render size change가 감지되면 동일 group/sourceVersion 범위 안에서 guarded relayout을 예약할 수 있다.
- relayout은 debounce, signature threshold, max retry로 제한되어야 한다.
- guard가 중단되어도 마지막 안정 좌표는 유지되어야 한다.
