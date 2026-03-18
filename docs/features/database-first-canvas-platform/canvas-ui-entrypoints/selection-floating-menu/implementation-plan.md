# Selection Floating Menu 구현 계획서

## 1. 문서 목적

이 문서는 선택 기반 고빈도 편집 surface를 `canvas-runtime` fixed slot에 연결되는 contribution으로 정의한다.

- 기준 문서: `docs/features/database-first-canvas-platform/canvas-ui-entrypoints/selection-floating-menu/README.md`
- 상위 문서: `docs/features/database-first-canvas-platform/canvas-ui-entrypoints/shell-adapter-boundary/README.md`
- 직접 선행 기반: `shell-adapter-boundary`, `canonical-mutation-query-core`

핵심은 selection floating menu가 `GraphCanvas.tsx`에 직접 달라붙는 overlay가 아니라, selection slot을 채우는 feature contribution이 되는 것이다.

## 2. 현재 상태 요약

1. selection anchor vocabulary
- `GraphCanvas.tsx`는 이미 selection bounds anchor를 계산해 foundation runtime state에 등록한다.

2. bridge path
- `WorkspaceClient`와 action routing bridge는 `selection.style.update`, `selection.content.update`를 이미 지원한다.

3. missing feature surface
- 실제 floating menu component, control inventory, homogeneous selection model, contribution export는 없다.
- selection-owned preset 일부는 여전히 toolbar 쪽에 남아 있다.

## 3. 목표

1. single selection 또는 homogeneous multi-selection에서 자동 노출되는 floating action bar를 만든다.
2. 노출 기준을 selection summary, semantic metadata, capability/editability summary로 정리한다.
3. 고빈도 style/content edit를 canonical mutation bridge 경로로만 실행한다.
4. feature는 `contribution.ts` 하나로 runtime slot에 등록된다.

## 4. 핵심 설계 결정

### 결정 1. floating menu는 selection slot contribution을 export한다

feature가 export해야 하는 핵심은 아래다.

- selection menu item inventory
- selection summary 기반 gating
- overlay body renderer
- action dispatch binding consumption

### 결정 2. selection anchor는 host가 계속 소유한다

selection bounds 계산과 anchor registration은 shell host가 계속 소유한다.

floating menu feature는 아래만 수행한다.

- anchor snapshot을 읽는다.
- 현재 selection summary와 함께 render model을 만든다.
- fixed slot contribution을 export한다.

### 결정 3. style/content/object-type action은 bridge 또는 explicit placeholder만 사용한다

ad-hoc local mutation은 금지한다.

- style/content: existing bridge 재사용
- object type change: 새 intent 추가 또는 explicit placeholder

## 5. 권장 모듈 배치

1. `app/features/canvas-ui-entrypoints/selection-floating-menu/types.ts`
2. `app/features/canvas-ui-entrypoints/selection-floating-menu/selectionModel.ts`
3. `app/features/canvas-ui-entrypoints/selection-floating-menu/controlInventory.ts`
4. `app/features/canvas-ui-entrypoints/selection-floating-menu/SelectionFloatingMenu.tsx`
5. `app/features/canvas-ui-entrypoints/selection-floating-menu/contribution.ts`

## 6. 병렬 작업 경계

selection-floating-menu lane의 기본 수정 경로:

- `app/features/canvas-ui-entrypoints/selection-floating-menu/**`

허용되는 shared 파일:

- `app/features/editing/actionRoutingBridge/registry.ts`
- `app/features/editing/actionRoutingBridge/types.ts`
- `app/components/editor/workspaceEditUtils.ts`

가능하면 피해야 하는 파일:

- `app/components/GraphCanvas.tsx`
- `app/components/FloatingToolbar.tsx`
- `app/components/editor/WorkspaceClient.tsx`

## 7. Phase 상세

## Phase 0. Selection contract 고정

1. single selection / homogeneous multi-selection 기준을 고정한다.
2. heterogenous selection에서 숨길 control과 disable로 남길 control을 구분한다.
3. pending mutation / selection drift / viewport drift 규칙을 명확히 한다.

## Phase 1. Feature model 구현

1. selection summary model을 만든다.
2. control inventory와 hidden/disable 규칙을 정리한다.
3. `SelectionFloatingMenu.tsx`와 `contribution.ts`를 추가한다.

## Phase 2. Bridge 정렬

1. style patch control은 existing bridge를 사용한다.
2. content 계열 action은 content update bridge를 사용한다.
3. object type change는 새 intent 또는 explicit placeholder로 처리한다.
4. 실제 런타임 source of truth는 `routeIntent -> actionRoutingBridge/registry.ts`로 둔다.

## Phase 3. Toolbar ownership handoff

1. selection-owned preset/control을 toolbar에서 회수한다.
2. floating menu contribution이 해당 control을 selection gating 기준으로 다시 노출한다.

## 8. 리스크와 대응

1. object type change contract 부재
- 대응: contribution에 disabled placeholder를 둘 수는 있지만 local mutation을 추가하지 않는다.

2. toolbar와 ownership 충돌
- 대응: toolbar와 floating menu의 공통 경계는 `selection-owned control` 하나로 문서에 고정한다.

## 9. 완료 정의

1. floating menu는 fixed slot이 읽는 `contribution.ts`로 runtime에 붙는다.
2. style/content action은 shared bridge 경로로만 실행된다.
3. selection-floating-menu lane은 `GraphCanvas.tsx`나 `WorkspaceClient.tsx`를 기본 수정 경로로 사용하지 않는다.
