# Canvas Toolbar 구현 계획서

## 1. 문서 목적

이 문서는 `canvas-toolbar` slice를 `GraphCanvas` 직접 수정 없이 `canvas-runtime` contribution으로 붙는 전역 surface로 정의한다.

- 기준 문서: `docs/features/database-first-canvas-platform/canvas-ui-entrypoints/canvas-toolbar/README.md`
- 상위 문서: `docs/features/database-first-canvas-platform/canvas-ui-entrypoints/shell-adapter-boundary/README.md`
- 직접 선행 기반: `shell-adapter-boundary`, `canonical-mutation-query-core`

핵심은 toolbar가 `GraphCanvas.tsx`에 새 branching을 추가하는 방식이 아니라, fixed slot에 section contribution을 채우는 방식으로 들어오게 만드는 것이다.

## 2. 현재 상태 요약

1. `app/components/FloatingToolbar.tsx`
- interaction mode, create menu, zoom in/out, fit view, washi preset UI를 함께 소유한다.
- presenter와 selection-owned branching이 섞여 있다.

2. `app/components/GraphCanvas.tsx`
- toolbar overlay contribution과 pane-click create flow를 직접 연결한다.
- toolbar feature가 shell host에 강결합돼 있다.

3. `app/components/editor/WorkspaceClient.tsx`
- toolbar create action은 결국 `node.create` bridge intent로 normalize된다.

현재 문제는 toolbar action이 없는 것이 아니라, toolbar integration이 feature-owned contribution이 아니라 shell file에 박혀 있다는 점이다.

## 3. 목표

1. toolbar는 `app/features/canvas-ui-entrypoints/canvas-toolbar/contribution.ts` 하나로 runtime에 등록된다.
2. toolbar가 소유하는 것은 section inventory와 action contract뿐이다.
3. create tool 선택은 기존 `node.create` bridge 경로를 그대로 사용한다.
4. selection-owned preset 책임은 toolbar 밖으로 밀어낸다.

## 4. 핵심 설계 결정

### 결정 1. toolbar는 section contribution을 export한다

권장 export는 아래와 같다.

- `canvasToolbarContribution`
- toolbar group / section inventory
- toolbar action resolver

이 contribution은 `processes/canvas-runtime/builtin-slots/canvasToolbar.ts`가 고정 경로로 소비한다.

### 결정 2. `FloatingToolbar.tsx`는 generic presenter만 남긴다

toolbar lane이 presenter를 owner로 가져가면 다시 merge hotspot이 된다.

따라서 toolbar lane은 가능한 한 아래 파일만 주로 소유한다.

- `types.ts`
- `toolbarModel.ts`
- `toolbarSections.ts`
- `toolbarActions.ts`
- `contribution.ts`

### 결정 3. create와 viewport control은 서로 다른 contribution facet로 다룬다

- create: canonical mutation bridge intent
- viewport: runtime-only action callback

둘을 같은 toolbar section에서 보이더라도 model에서는 서로 다른 action kind로 남겨야 한다.

## 5. 권장 모듈 배치

1. `app/features/canvas-ui-entrypoints/canvas-toolbar/types.ts`
2. `app/features/canvas-ui-entrypoints/canvas-toolbar/toolbarModel.ts`
3. `app/features/canvas-ui-entrypoints/canvas-toolbar/toolbarSections.ts`
4. `app/features/canvas-ui-entrypoints/canvas-toolbar/toolbarActions.ts`
5. `app/features/canvas-ui-entrypoints/canvas-toolbar/contribution.ts`

## 6. 병렬 작업 경계

toolbar lane의 기본 수정 경로:

- `app/features/canvas-ui-entrypoints/canvas-toolbar/**`

허용되는 shared 파일:

- `app/features/editing/actionRoutingBridge/registry.ts`
- `app/features/editing/actionRoutingBridge/types.ts`

가능하면 피해야 하는 파일:

- `app/components/GraphCanvas.tsx`
- `app/components/FloatingToolbar.tsx`
- `app/components/editor/WorkspaceClient.tsx`

이 파일들은 shell-adapter-boundary 단계에서 one-time adoption으로 끝내는 것이 목표다.

## 7. Phase 상세

## Phase 0. Section ownership 고정

### 목표

- toolbar가 소유할 control과 넘길 control을 먼저 잠근다.

### 작업

1. interaction / create / viewport / canvas-global section을 고정한다.
2. selection-owned preset 및 style control을 toolbar 범위 밖으로 명시한다.

## Phase 1. Contribution 구현

### 목표

- toolbar feature가 runtime slot에 들어갈 contribution을 export한다.

### 작업

1. toolbar section inventory를 정의한다.
2. runtime state와 callback을 합쳐 toolbar model을 만든다.
3. `contribution.ts`가 section과 action resolver를 export하게 만든다.

## Phase 2. Bridge 정렬

### 목표

- toolbar action이 기존 write path를 그대로 쓰는지 고정한다.

### 작업

1. create action은 `toolbar -> node.create` bridge를 유지한다.
2. viewport quick control은 runtime callback으로만 연결한다.
3. 실제 런타임 source of truth는 `routeIntent -> actionRoutingBridge/registry.ts`로 두고, legacy catalog는 기본 수정 경로로 두지 않는다.

## 8. 리스크와 대응

1. presenter contract가 toolbar section을 충분히 렌더하지 못할 위험
- 대응: presenter 변경은 shell-adapter-boundary에서 끝내고, toolbar slice는 section model만 바꾼다.

2. selection-floating-menu와 ownership 충돌
- 대응: selection-owned preset은 toolbar contribution 범위에서 제외한다.

## 9. 완료 정의

1. toolbar는 fixed slot이 소비하는 `contribution.ts`를 통해 runtime에 연결된다.
2. toolbar lane이 `GraphCanvas.tsx`나 `WorkspaceClient.tsx`를 기본 수정 경로로 사용하지 않는다.
3. create action은 기존 canonical mutation bridge를 그대로 사용한다.
