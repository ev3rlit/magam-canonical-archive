# Node Context Menu 구현 계획서

## 1. 문서 목적

이 문서는 node context menu를 canonical metadata + relation context 기반 contribution으로 정의한다.

- 기준 문서: `docs/features/database-first-canvas-platform/canvas-ui-entrypoints/node-context-menu/README.md`
- 상위 문서: `docs/features/database-first-canvas-platform/canvas-ui-entrypoints/shell-adapter-boundary/README.md`
- 직접 선행 기반: `shell-adapter-boundary`, `canonical-mutation-query-core`

핵심은 node menu가 `GraphCanvas.tsx`나 `useContextMenu.ts`에 직접 로직을 추가하는 방식이 아니라, fixed slot에 들어가는 structural action contribution이 되는 것이다.

## 2. 현재 상태 요약

1. shared menu config
- node menu item inventory가 pane menu와 함께 shared static config에 남아 있다.

2. `GraphCanvas.tsx`
- node 우클릭 시 아직 `nodeFamily` 중심의 얇은 context만 전달한다.

3. existing bridge path
- rename, child create, sibling create는 이미 `node-context-menu` surface로 normalize된다.

4. richer metadata source
- `resolveNodeActionRoutingContext()`는 semanticRole, primaryContentKind, capability keys, allowed commands를 이미 계산할 수 있다.

## 3. 목표

1. node context menu item inventory와 gating을 feature-owned 모듈로 분리한다.
2. menu 노출 기준을 renderer type이 아니라 canonical metadata + relation context로 바꾼다.
3. feature는 `contribution.ts` 하나로 fixed slot에 등록된다.
4. 구조적/저빈도 action만 node context menu에 남긴다.

## 4. 핵심 설계 결정

### 결정 1. node menu는 canonical context contribution을 export한다

feature가 export해야 하는 것은 아래다.

- node relation summary
- canonical metadata 기반 gating model
- item inventory
- contribution export

### 결정 2. `nodeFamily`는 transition helper일 뿐 최종 contract가 아니다

최종 gating 입력은 아래여야 한다.

- semantic role
- primary content kind
- capability keys
- allowed commands
- relation summary
- selection homogeneous 여부

### 결정 3. unsupported low-frequency action도 placeholder 또는 bridge intent로만 다룬다

duplicate/delete/lock 같은 action이 아직 contract에 없다면, explicit placeholder로만 남긴다.

## 5. 권장 모듈 배치

1. `app/features/canvas-ui-entrypoints/node-context-menu/types.ts`
2. `app/features/canvas-ui-entrypoints/node-context-menu/buildNodeRelationSummary.ts`
3. `app/features/canvas-ui-entrypoints/node-context-menu/buildNodeContextMenuModel.ts`
4. `app/features/canvas-ui-entrypoints/node-context-menu/nodeMenuItems.ts`
5. `app/features/canvas-ui-entrypoints/node-context-menu/contribution.ts`
6. `app/features/canvas-ui-entrypoints/node-context-menu/index.ts`

## 6. 병렬 작업 경계

node lane의 기본 수정 경로:

- `app/features/canvas-ui-entrypoints/node-context-menu/**`

허용되는 shared 파일:

- `app/components/editor/workspaceEditUtils.ts`
- `app/features/editing/actionIntentCatalog.ts`
- `app/features/editing/actionRoutingBridge/registry.ts`
- `app/types/contextMenu.ts`

가능하면 피해야 하는 파일:

- `app/hooks/useContextMenu.ts`
- `app/components/GraphCanvas.tsx`
- `app/components/editor/WorkspaceClient.tsx`

## 7. Phase 상세

## Phase 0. Canonical gating contract 고정

1. relation summary와 canonical metadata input을 고정한다.
2. `nodeFamily` fallback을 transitional helper로만 문서화한다.

## Phase 1. Feature model 구현

1. relation summary helper를 만든다.
2. canonical metadata + relation summary로 menu model을 만든다.
3. `nodeMenuItems.ts`와 `contribution.ts`를 추가한다.

## Phase 2. Structural action 정렬

1. rename, child create, sibling create는 existing bridge를 재사용한다.
2. duplicate/delete/lock/group action은 bridge intent 또는 explicit placeholder로 정리한다.

## 8. 리스크와 대응

1. `nodeFamily` fallback이 장기화되는 위험
- 대응: richer metadata snapshot을 feature model 입력으로 고정하고, `nodeFamily` 의존은 transition helper로만 남긴다.

2. pane와 다시 shared config를 가지는 위험
- 대응: node item inventory는 자기 feature 폴더 안에서만 관리한다.

## 9. 완료 정의

1. node menu는 fixed slot이 읽는 `contribution.ts`로 runtime에 붙는다.
2. node menu 노출 기준이 canonical metadata + relation context로 바뀐다.
3. node lane은 `GraphCanvas.tsx`, `useContextMenu.ts`, `WorkspaceClient.tsx`를 기본 수정 경로로 사용하지 않는다.
