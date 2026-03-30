# UI Runtime State 구현 계획서

## 1. 문서 목적

이 문서는 `docs/features/database-first-canvas-platform/canvas-ui-entrypoints/entrypoint-foundation/ui-runtime-state/README.md`를 기준으로, canvas entrypoint foundation의 runtime-only UI state를 실제 구현 가능한 작업 단위로 분해한 실행 계획이다.

- 기준 문서: `docs/features/database-first-canvas-platform/canvas-ui-entrypoints/entrypoint-foundation/ui-runtime-state/README.md`
- 상위 문서: `docs/features/database-first-canvas-platform/canvas-ui-entrypoints/entrypoint-foundation/README.md`
- 상위 실행 계획: `docs/features/database-first-canvas-platform/implementation-plan.md`

이 문서의 초점은 persisted canvas/document/object state를 더 만들거나 바꾸는 것이 아니라, session 동안만 존재하는 UI state의 ownership과 소비 경로를 고정하는 데 있다.

## 2. 현재 상태 요약

현재 runtime-only UI state는 한 곳에 모여 있지 않다.

1. `app/store/graph.ts`
- selection, search, text edit, tab snapshot, group hover 같은 session state가 이미 함께 존재한다.
- 그러나 entrypoint foundation 관점의 `active tool`, `open overlay`, `anchor registry`, `optimistic pending`은 별도 shape로 정리돼 있지 않다.

2. `app/components/GraphCanvas.tsx`
- `interactionMode`, `createMode`, export dialog, toast, drag feedback, context menu opening이 로컬 state로 흩어져 있다.
- 이 상태는 추후 `canvas-toolbar`, `pane-context-menu`, `node-context-menu`, `selection-floating-menu`가 공유해야 하는 foundation state와 섞여 있다.

3. `app/hooks/useContextMenu.ts` + `app/components/ContextMenu.tsx`
- node/pane context menu open state와 visible item 계산이 별도 훅으로 존재한다.
- overlay host나 selection resolver와 연결되는 공통 state contract는 아직 없다.

4. `app/components/FloatingToolbar.tsx`
- create menu, washi preset menu open state가 컴포넌트 내부에 갇혀 있다.
- active tool과 open surface를 다른 entrypoint surface와 함께 조정하기 어렵다.

5. `app/contexts/BubbleContext.tsx`
- viewport 기준 overlay registry 성격의 runtime context가 이미 별도로 존재한다.
- 이 registry를 foundation state에 즉시 흡수할지는 별도 판단이 필요하다.

즉, 현재 문제는 "state가 없다"가 아니라 "foundation이 소유해야 할 runtime state가 공통 contract 없이 흩어져 있다"는 점이다.

## 3. 목표

1. persisted state와 runtime-only UI state의 경계를 코드 레벨에서도 분명히 만든다.
2. `canvas-toolbar`, `selection-floating-menu`, `pane-context-menu`, `node-context-menu`가 공유할 foundation-owned session state shape를 만든다.
3. selection, hover, open overlay, floating anchor, active tool, optimistic pending을 ad-hoc local state가 아니라 공통 selector/action으로 소비하게 만든다.
4. `selection-context-resolver`, `overlay-host`, `action-routing-bridge`와 연결 가능한 이벤트 경계를 먼저 고정한다.
5. 기존 `useGraphStore`와 충돌하는 두 번째 전역 store를 만들지 않고, 기존 session store와 자연스럽게 결합한다.

## 4. 비목표

이번 계획 범위에 포함하지 않는 항목은 아래와 같다.

1. persisted `canvas_nodes`, `objects`, `surface viewport` schema 자체 변경
2. canonical mutation schema 또는 action contract 정의
3. search UI (`isSearchOpen`, `searchQuery`, `searchResults`) 재설계
4. text edit draft/session 전체 재설계
5. export dialog, chat, app-wide modal 체계 통합
6. `BubbleContext` 전체를 foundation overlay host로 즉시 흡수하는 작업

## 5. 핵심 설계 결정

### 결정 1. 별도 전역 store를 추가하지 않고 `useGraphStore` 내부 sub-slice로 정리한다

권장 방향은 `app/store/graph.ts` 내부에 `entrypointRuntime` 같은 중첩 sub-state를 두고, 타입/selector/action 정의만 신규 feature 모듈로 분리하는 것이다.

이유:

- selection, current file, viewport snapshot, edit completion event가 이미 `useGraphStore`에 있다.
- 여기에 맞물리는 foundation state를 별도 zustand store로 분리하면 selection과 open overlay 사이에 sync 문제가 생긴다.
- 현재 변경 범위에서 중요한 것은 state backend 교체가 아니라 ownership 정리다.

### 결정 2. foundation state는 "cross-surface coordination"에 필요한 항목만 가진다

공통 runtime state에 포함할 항목:

- active interaction tool / create mode
- 현재 열린 primary surface
- floating / pane / node / toolbar trigger anchor snapshot
- foundation이 소비하는 hover registry
- optimistic pending action registry

공통 runtime state에 포함하지 않을 항목:

- 단순 애니메이션 토글
- purely visual submenu hover
- 한 컴포넌트 안에서만 소비하는 임시 local boolean
- raw rendered menu item 배열

즉 "다른 entrypoint surface가 읽거나 닫아야 하는 상태"만 foundation state로 승격한다.

### 결정 3. selection 자체는 중복 저장하지 않고 기존 graph store를 input으로 사용한다

`selectedNodeIds`는 이미 `app/store/graph.ts`에 존재한다. `ui-runtime-state`는 selection의 owner가 아니라 consumer다.

따라서 foundation state에는 아래만 둔다.

- selection을 기준으로 열린 surface의 descriptor
- selection 변경 시 invalidate할 overlay state
- selection 기반 floating anchor snapshot

선택 자체를 다시 복제 저장하면 drift 가능성이 커진다.

### 결정 4. anchor는 DOM ref가 아니라 serializable snapshot으로 저장한다

store에는 `HTMLElement`나 `DOMRect` reference를 넣지 않는다. 대신 아래 같은 serializable snapshot을 권장한다.

- anchor kind (`pointer`, `node`, `selection-bounds`, `toolbar-trigger`)
- flow 좌표 또는 screen 좌표
- viewport snapshot version
- target node ids / owner id

이렇게 해야 viewport 변경, selection 변경, overlay reposition을 순수 selector로 다시 계산할 수 있다.

### 결정 5. optimistic pending state는 command/request id 기준으로 정규화한다

`app/store/graph.ts`의 `EditCompletionEvent`와 `app/features/editing/commands.ts`의 command envelope를 기준으로, UI pending state도 `commandId` 또는 request id를 key로 가진 registry로 관리한다.

이 registry는 아래 목적만 가진다.

- 버튼 disable
- progress/spinner 노출
- rollback 시 surface 상태 정리
- 실패 토스트/diagnostic 연결 포인트 제공

mutation payload 자체를 store에 장기 보관하는 것은 비권장이다.

## 6. 권장 상태 모델

아래 shape는 구현 시점의 기준안이다.

```ts
export type EntrypointSurfaceKind =
  | 'toolbar-create-menu'
  | 'toolbar-preset-menu'
  | 'pane-context-menu'
  | 'node-context-menu'
  | 'selection-floating-menu';

export type EntrypointAnchorKind =
  | 'pointer'
  | 'node'
  | 'selection-bounds'
  | 'toolbar-trigger';

export interface EntrypointAnchorSnapshot {
  anchorId: string;
  kind: EntrypointAnchorKind;
  ownerId?: string;
  nodeIds?: string[];
  screen?: { x: number; y: number; width?: number; height?: number };
  flow?: { x: number; y: number };
  viewport?: { x: number; y: number; zoom: number };
}

export interface PendingUiAction {
  requestId: string;
  actionType: string;
  targetIds: string[];
  status: 'pending' | 'rollback' | 'committed' | 'failed';
  startedAt: number;
  errorMessage?: string;
}

export interface EntrypointRuntimeState {
  activeTool: {
    interactionMode: 'pointer' | 'hand';
    createMode: GraphCanvasCreateMode;
  };
  openSurface: null | {
    kind: EntrypointSurfaceKind;
    anchorId: string;
    ownerId?: string;
    dismissOnSelectionChange: boolean;
    dismissOnViewportChange: boolean;
  };
  anchorsById: Record<string, EntrypointAnchorSnapshot>;
  hover: {
    nodeIdsByGroupId: Record<string, string[]>;
    targetNodeId: string | null;
  };
  pendingByRequestId: Record<string, PendingUiAction>;
}
```

주의:

- `selectedNodeIds`, `currentFile`, `searchQuery`, `textEditDraft`는 이 shape로 옮기지 않는다.
- `hoveredNodeIdsByGroupId`는 foundation hover registry로 옮길 후보지만, 다른 consumer가 있으면 adapter 기간을 둔다.

## 7. 권장 모듈 배치

신규 코드 배치는 아래처럼 두는 편이 안전하다.

1. `app/features/canvas-ui-entrypoints/ui-runtime-state/types.ts`
- state shape, surface kind, anchor kind, pending descriptor 정의

2. `app/features/canvas-ui-entrypoints/ui-runtime-state/selectors.ts`
- active tool, open surface, anchor lookup, pending lookup selector

3. `app/features/canvas-ui-entrypoints/ui-runtime-state/actions.ts`
- open/close surface, set active tool, register anchor, clear invalid anchors, begin/commit/fail pending action

4. `app/features/canvas-ui-entrypoints/ui-runtime-state/reducer.ts`
- `useGraphStore`에 붙일 pure update helper

5. `app/store/graph.ts`
- 실제 zustand wiring
- 기존 top-level state와 새 sub-slice 연결

초기 변경 후보 파일:

- `app/store/graph.ts`
- `app/components/GraphCanvas.tsx`
- `app/components/FloatingToolbar.tsx`
- `app/hooks/useContextMenu.ts`
- `app/components/ContextMenu.tsx`
- `app/types/contextMenu.ts`

보류 후보:

- `app/contexts/BubbleContext.tsx`

이 파일은 overlay host와 책임이 겹칠 여지가 있지만, 첫 단계에서 반드시 옮길 필요는 없다.

## 8. Phase 상세

## Phase 0. 계약 고정

### 목표

- foundation이 소유할 runtime state와 개별 surface local state의 경계를 먼저 고정한다.

### 작업

1. 본 계획서와 `README.md`에 ownership 기준을 남긴다.
2. `EntrypointSurfaceKind`, `EntrypointAnchorKind`, `PendingUiAction` 초안 타입을 고정한다.
3. `selection-context-resolver`, `overlay-host`, `action-routing-bridge`가 각각 무엇을 생산/소비하는지 문서에 명시한다.

### 완료 기준

- 어떤 상태가 foundation-owned인지 구현자가 혼동하지 않는다.
- selection/search/text-edit/export-dialog 같은 인접 상태가 범위 밖이라는 점이 문서에 명확하다.

## Phase 1. Store Slice 도입

### 목표

- `useGraphStore` 안에 foundation runtime state의 단일 소스를 만든다.

### 작업

1. 신규 `ui-runtime-state` feature 모듈을 추가한다.
2. `app/store/graph.ts`에 `entrypointRuntime` sub-slice를 도입한다.
3. 기존 `hoveredNodeIdsByGroupId`를 새 hover registry로 이동하거나 adapter로 이중 노출한다.
4. `interactionMode`, `createMode`를 `GraphCanvas.tsx` local state에서 sub-slice로 승격한다.

### 완료 기준

- toolbar와 canvas shell이 같은 active tool state를 읽는다.
- foundation hover registry가 store 기준으로 조회된다.
- 기존 persisted graph state와 충돌하지 않는다.

## Phase 2. Open Surface / Dismiss 규칙 정규화

### 목표

- toolbar/menu 계열 overlay의 open/close 상태를 공통 descriptor 하나로 정리한다.

### 작업

1. `useContextMenu.ts`를 state owner가 아니라 adapter/select helper로 축소한다.
2. `ContextMenu.tsx`는 render + dismiss 처리만 담당하게 단순화한다.
3. `FloatingToolbar.tsx`의 create menu / preset menu open 상태를 `openSurface` 기반으로 연결한다.
4. primary surface 동시 열림 규칙을 고정한다.

권장 규칙:

- 같은 시점에 primary surface는 1개만 열린다.
- `pane-context-menu`와 `node-context-menu`는 상호 배타적이다.
- selection이 바뀌면 `selection-floating-menu`, `node-context-menu`는 닫힌다.
- pointer 기준 pane menu는 viewport 이동 또는 canvas click에 닫힌다.

### 완료 기준

- surface별로 제각각 outside click/dismiss logic을 중복 구현하지 않는다.
- context menu와 toolbar menu가 같은 runtime descriptor를 통해 충돌 없이 열린다.

## Phase 3. Anchor Registry와 Resolver Handshake

### 목표

- overlay 위치 계산에 필요한 anchor 정보를 foundation state로 정규화한다.

### 작업

1. `GraphCanvas.tsx`에서 pane pointer anchor, node anchor, selection bounds anchor를 등록한다.
2. `selection-context-resolver`가 소비할 selection snapshot과 anchor snapshot 연결 규칙을 정의한다.
3. stale anchor 정리 규칙을 넣는다.

권장 정리 규칙:

- node가 삭제되거나 selection에서 빠지면 관련 anchor를 제거한다.
- viewport zoom/pan 이후 재계산 가능한 anchor만 유지한다.
- DOM ref는 저장하지 않고 필요한 경우 렌더 단계에서 재측정한다.

### 완료 기준

- selection floating menu와 context menu가 같은 anchor vocabulary를 재사용할 수 있다.
- viewport 변화 후에도 잘못된 screen 좌표가 남지 않는다.

## Phase 4. Optimistic Pending 연결

### 목표

- action-routing-bridge와 편집 명령 실행 결과를 runtime UI state에 연결한다.

### 작업

1. `beginPendingAction`, `commitPendingAction`, `failPendingAction`, `clearPendingAction` action을 추가한다.
2. `app/features/editing/commands.ts`의 command/request id와 연결한다.
3. `app/store/graph.ts`의 `EditCompletionEvent`와 연동해 성공/실패 후 pending state를 정리한다.
4. UI surface에서 disable/loading/rollback UI를 읽을 selector를 만든다.

### 완료 기준

- pending mutation이 있는 동안 중복 실행 버튼을 막을 수 있다.
- 실패 후 rollback/diagnostic UI가 같은 registry를 통해 정리된다.
- persisted state와 runtime pending state가 섞이지 않는다.

## Phase 5. Surface Consumer 마이그레이션

### 목표

- foundation을 소비하는 entrypoint surface가 ad-hoc local state 없이 공통 contract를 읽도록 만든다.

### 작업

1. `canvas-toolbar`가 active tool과 open surface를 foundation selector로 읽는다.
2. `pane-context-menu`, `node-context-menu`가 공통 open surface + anchor registry를 사용한다.
3. future `selection-floating-menu`가 같은 selector/action 집합 위에서 구현 가능하도록 contract를 확정한다.
4. search, text-edit, export dialog처럼 범위 밖 상태는 기존 경로를 유지한다.

### 완료 기준

- toolbar / pane menu / node menu가 서로 다른 local owner를 두지 않는다.
- 후속 surface 구현이 foundation contract 재사용만으로 가능하다.

## Phase 6. 검증 및 하드닝

### 테스트 권장 범위

1. `app/store/graph.test.ts`
- runtime slice action/selector 단위 테스트

2. `app/components/GraphCanvas.test.tsx`
- selection 변경, context menu open/close, anchor invalidation smoke test

3. 신규 `ui-runtime-state` selector/action 테스트
- open surface 상호 배타성
- pending action lifecycle
- stale anchor cleanup

### 수동 검증 시나리오

1. toolbar create mode를 켠 뒤 pane context menu를 열면 create menu가 닫히고 pane menu만 남는다.
2. node context menu를 연 상태에서 selection이 바뀌면 menu가 닫힌다.
3. pointer/hand/create mode 전환은 새로고침 후 persisted되지 않는다.
4. optimistic command 실패 시 loading state가 풀리고 stale pending entry가 남지 않는다.
5. node 삭제 후 관련 floating anchor가 남지 않는다.

## 9. 리스크와 대응

1. `useGraphStore` 비대화
- 대응: top-level field를 계속 늘리기보다 `entrypointRuntime` sub-slice로 묶고 selector/action 파일을 분리한다.

2. local state와 global state의 이중 owner 발생
- 대응: surface migration 단계에서 owner를 명시하고, adapter 기간이 끝나면 local boolean을 제거한다.

3. stale anchor 누적
- 대응: selection/node lifecycle과 viewport change에 맞춘 cleanup action을 기본 제공한다.

4. pending state와 실제 command completion 간 불일치
- 대응: `commandId` 기준 정규화를 강제하고, 성공/실패 모두 명시적으로 clear한다.

## 10. 완료 정의

아래 조건을 만족하면 `ui-runtime-state` sub-slice가 완료된 것으로 본다.

1. active tool, open overlay, anchor registry, optimistic pending이 foundation-owned runtime contract로 존재한다.
2. `canvas-toolbar`, `pane-context-menu`, `node-context-menu`가 동일한 runtime contract를 소비한다.
3. persisted state와 runtime-only state가 코드 구조와 문서 모두에서 분리된다.
4. selection과 canonical metadata는 중복 저장되지 않고, resolver 입력으로만 소비된다.
5. 후속 `selection-floating-menu`가 foundation contract 위에서 추가 가능하다.
