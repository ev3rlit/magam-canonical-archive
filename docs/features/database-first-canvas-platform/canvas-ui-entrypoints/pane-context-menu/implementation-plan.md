# Pane Context Menu 구현 계획서

## 1. 문서 목적

이 문서는 빈 canvas 영역 context menu를 `canvas-runtime` fixed slot에 연결되는 feature contribution으로 정의한다.

- 기준 문서: `docs/features/database-first-canvas-platform/canvas-ui-entrypoints/pane-context-menu/README.md`
- 상위 문서: `docs/features/database-first-canvas-platform/canvas-ui-entrypoints/shell-adapter-boundary/README.md`
- 직접 선행 기반: `shell-adapter-boundary`, `canonical-mutation-query-core`

핵심은 pane menu가 shared hook를 직접 수정하는 방식이 아니라, empty-surface context를 해석하는 contribution으로 들어오게 만드는 것이다.

## 2. 현재 상태 요약

1. `useContextMenu.ts`와 `contextMenuItems.ts`
- pane/node inventory가 shared hook와 static config에 섞여 있다.

2. `GraphCanvas.tsx`
- pane 우클릭 시 pointer position과 create/view callback을 직접 만들어 menu를 연다.

3. bridge path
- pane create는 `node.create`, fit-view는 runtime-only action으로 이미 연결 가능한 기반이 있다.

## 3. 목표

1. pane menu의 item inventory와 empty-surface context model을 feature-owned 모듈로 분리한다.
2. blank-area create, surface-level view action, selection 비의존 action만 pane menu에 남긴다.
3. feature는 `contribution.ts` 하나로 fixed slot에 등록된다.

## 4. 핵심 설계 결정

### 결정 1. pane menu는 empty-surface contribution을 export한다

feature는 아래를 소유한다.

- pane context snapshot builder
- pane item inventory
- gating rule
- contribution export

shared hook와 overlay lifecycle은 shell-adapter-boundary consumer가 소유한다.

### 결정 2. pane context는 node metadata를 읽지 않는다

pane menu가 필요로 하는 것은 아래뿐이다.

- pointer position
- current file / surface readiness
- viewport callback
- selection empty 여부

semantic role, relation context, node family는 pane feature 입력이 아니다.

## 5. 권장 모듈 배치

1. `app/features/canvas-ui-entrypoints/pane-context-menu/types.ts`
2. `app/features/canvas-ui-entrypoints/pane-context-menu/buildPaneMenuContext.ts`
3. `app/features/canvas-ui-entrypoints/pane-context-menu/paneMenuItems.ts`
4. `app/features/canvas-ui-entrypoints/pane-context-menu/contribution.ts`
5. `app/features/canvas-ui-entrypoints/pane-context-menu/index.ts`

## 6. 병렬 작업 경계

pane lane의 기본 수정 경로:

- `app/features/canvas-ui-entrypoints/pane-context-menu/**`

허용되는 shared 파일:

- `app/features/editing/actionRoutingBridge/registry.ts`
- `app/features/editing/actionRoutingBridge/types.ts`
- `app/types/contextMenu.ts`

가능하면 피해야 하는 파일:

- `app/hooks/useContextMenu.ts`
- `app/components/GraphCanvas.tsx`
- `app/components/editor/WorkspaceClient.tsx`

## 7. Phase 상세

## Phase 0. Empty-surface contract 고정

1. pane context snapshot의 최소 필드를 고정한다.
2. selection 비의존 action만 pane menu에 남긴다.

## Phase 1. Feature contribution 구현

1. pane context builder를 만든다.
2. pane item inventory를 만든다.
3. `contribution.ts`가 fixed slot contribution을 export하게 만든다.

## Phase 2. Action contract 정렬

1. create action은 `node.create` bridge를 사용한다.
2. view action은 runtime-only callback을 사용한다.
3. 실제 런타임 source of truth는 `routeIntent -> actionRoutingBridge/registry.ts`로 둔다.

## 8. 리스크와 대응

1. pane와 node가 다시 같은 config를 공유하는 위험
- 대응: item inventory는 각각 자기 feature 폴더에만 둔다.

2. pane menu에 selection-aware action이 다시 들어오는 위험
- 대응: pane context 입력에서 node metadata를 제외한다.

## 9. 완료 정의

1. pane menu는 fixed slot이 읽는 `contribution.ts`로 runtime에 붙는다.
2. pane lane은 `useContextMenu.ts`, `GraphCanvas.tsx`, `WorkspaceClient.tsx`를 기본 수정 경로로 사용하지 않는다.
3. create/view action이 각각 canonical mutation / runtime-only contract로 정리된다.
