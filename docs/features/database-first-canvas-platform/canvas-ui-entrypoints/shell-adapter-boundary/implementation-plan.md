# Shell Adapter Boundary 구현 계획서

## 1. 문서 목적

이 문서는 `shell-adapter-boundary`를 단순 adapter 파일 추가가 아니라, `processes/canvas-runtime` composition root를 여는 선행 구조 변경으로 정의한다.

- 기준 문서: `docs/features/database-first-canvas-platform/canvas-ui-entrypoints/shell-adapter-boundary/README.md`
- 상위 문서: `docs/features/database-first-canvas-platform/canvas-ui-entrypoints/README.md`
- 직접 선행 기반: `entrypoint-foundation`

핵심은 `GraphCanvas.tsx`에 기능을 더 붙이는 대신, runtime이 fixed slot에서 feature contribution을 조립하도록 만드는 것이다.

## 2. 현재 상태 요약

현재 병렬 작업을 어렵게 만드는 hot spot은 네 군데다.

1. `app/components/GraphCanvas.tsx`
- selection anchor, pane/node menu open, pane click create, toolbar host, shortcut, layout lifecycle을 함께 소유한다.

2. `app/components/FloatingToolbar.tsx`
- toolbar presenter와 selection-owned preset branching이 섞여 있다.

3. `app/hooks/useContextMenu.ts`
- registry resolution과 overlay lifecycle을 동시에 소유한다.

4. `app/components/editor/WorkspaceClient.tsx`
- surface-specific dispatch wiring이 한 파일에 집중돼 있다.

5. shared entrypoint type coupling
- `ui-runtime-state`, `GraphCanvas.drag.ts`, `contextMenu.ts`가 create/surface contract를 서로 간접 참조하고 있어 후속 lane이 shared type file에서 다시 만날 수 있다.

6. runtime action routing source of truth
- 실제 런타임 경로는 `WorkspaceClient -> routeIntent -> actionRoutingBridge/registry.ts`이며, surface lane 문서는 이 경로를 기본 기준으로 삼아야 한다.

즉 문제는 feature가 없어서가 아니라, feature가 shared shell 파일과 shared type file을 통해서만 앱에 연결된다는 점이다.

## 3. 목표

1. `processes/canvas-runtime`가 feature contribution을 조립하는 composition root가 된다.
2. `GraphCanvas.tsx`는 host, `FloatingToolbar.tsx`는 presenter, `useContextMenu.ts`는 registry consumer, `WorkspaceClient.tsx`는 dispatch consumer가 된다.
3. 후속 surface lane은 자기 `contribution.ts`와 feature-owned model만 수정한다.
4. 중앙 register 파일 하나를 계속 같이 편집하지 않도록 fixed slot을 만든다.

## 4. 비목표

1. toolbar/floating/pane/node action inventory 확정
2. overlay host 자체 리팩터링
3. canonical mutation/query contract 추가 설계
4. 전체 app을 한 번에 FSD 디렉터리로 이동

## 5. 핵심 설계 결정

### 결정 1. `processes/canvas-runtime`를 새 composition root로 둔다

이 slice가 새로 여는 가장 중요한 레이어는 `app/processes/canvas-runtime`다.

이 레이어는 아래를 소유한다.

- contribution contract 타입
- built-in slot wiring
- shell consumer binding
- runtime assembly

feature는 이 레이어를 import하지 않고, runtime이 feature contribution을 import한다.

### 결정 2. 중앙 register 대신 fixed slot + no-op stub을 사용한다

후속 4개 워크트리가 동시에 하나의 `registerBuiltInCanvasFeatures.ts`를 편집하면 다시 merge hotspot이 된다.

따라서 shell-adapter-boundary는 아래 둘을 먼저 만든다.

1. fixed slot 파일
2. 각 feature 폴더의 placeholder `contribution.ts`

이 구조라면 surface lane은 자기 placeholder만 채우면 된다.

### 결정 3. shared shell file은 one-time adoption만 허용한다

아래 파일은 shell-adapter-boundary 단계에서 한 번만 크게 수정한다.

- `app/components/GraphCanvas.tsx`
- `app/components/FloatingToolbar.tsx`
- `app/hooks/useContextMenu.ts`
- `app/components/editor/WorkspaceClient.tsx`

그 이후 surface lane은 이 파일들을 기본 수정 경로로 사용하지 않는다.

## 6. 권장 모듈 배치

1. `app/processes/canvas-runtime/types.ts`
- `CanvasRuntimeContribution`, slot contract, binding contract 정의

2. `app/processes/canvas-runtime/createCanvasRuntime.ts`
- built-in slot을 조립해 runtime object 생성

3. `app/processes/canvas-runtime/builtin-slots/canvasToolbar.ts`
4. `app/processes/canvas-runtime/builtin-slots/selectionFloatingMenu.ts`
5. `app/processes/canvas-runtime/builtin-slots/paneContextMenu.ts`
6. `app/processes/canvas-runtime/builtin-slots/nodeContextMenu.ts`
- 고정 slot wiring

7. `app/processes/canvas-runtime/bindings/graphCanvasHost.ts`
- `GraphCanvas`가 읽는 host binding

8. `app/processes/canvas-runtime/bindings/toolbarPresenter.ts`
- `FloatingToolbar` presenter binding

9. `app/processes/canvas-runtime/bindings/contextMenu.ts`
- pane/node menu registry binding

10. `app/processes/canvas-runtime/bindings/actionDispatch.ts`
- `WorkspaceClient` dispatch binding

11. feature placeholder export
- `app/features/canvas-ui-entrypoints/canvas-toolbar/contribution.ts`
- `app/features/canvas-ui-entrypoints/selection-floating-menu/contribution.ts`
- `app/features/canvas-ui-entrypoints/pane-context-menu/contribution.ts`
- `app/features/canvas-ui-entrypoints/node-context-menu/contribution.ts`

12. `app/features/canvas-ui-entrypoints/contracts.ts`
- create mode, creatable node type, surface contract처럼 여러 surface가 함께 쓰는 낮은 안정 타입 정의

## 7. Phase 상세

## Phase 0. Contract와 slot ownership 고정

### 목표

- 후속 lane이 어떤 파일을 owner로 가져야 하는지 먼저 잠근다.

### 작업

1. runtime contribution 타입을 고정한다.
2. shared entrypoint type을 `GraphCanvas`/context-menu 구현에서 분리한다.
3. fixed slot 이름과 feature export 경로를 고정한다.
4. shared shell file이 앞으로 host/presenter/consumer 역할만 가진다는 점을 문서에 남긴다.

### 완료 기준

- 후속 lane이 중앙 register 파일을 새로 만들거나 shared shell file을 owner로 가정하지 않는다.

## Phase 1. `processes/canvas-runtime` 도입

### 목표

- contribution을 조립하는 composition root를 만든다.

### 작업

1. `contracts.ts`, `types.ts`, `createCanvasRuntime.ts`를 만든다.
2. built-in slot 파일을 만든다.
3. 각 feature의 placeholder `contribution.ts` export 경로를 예약한다.

### 완료 기준

- runtime이 고정된 경로에서 surface contribution을 모을 수 있다.

## Phase 2. Shared shell one-time adoption

### 목표

- 기존 hot spot 파일이 runtime consumer가 되도록 한 번만 마이그레이션한다.

### 작업

1. `GraphCanvas.tsx`를 host binding consumer로 바꾼다.
2. `FloatingToolbar.tsx`를 presenter binding consumer로 바꾼다.
3. `useContextMenu.ts`를 context menu binding consumer로 바꾼다.
4. `WorkspaceClient.tsx`를 action dispatch binding consumer로 바꾼다.

### 완료 기준

- 이후 surface lane이 shared shell file을 직접 건드리지 않고도 작업을 이어갈 수 있다.

### 세부 adoption 문서

- `./graph-canvas-host-consumer/README.md`
- `./floating-toolbar-presenter-consumer/README.md`
- `./context-menu-binding-consumer/README.md`
- `./workspace-client-dispatch-consumer/README.md`

## Phase 3. Slot 검증과 guardrail

### 목표

- placeholder slot과 실제 contribution 사이의 계약을 테스트로 고정한다.

### 작업

1. built-in slot이 no-op contribution으로도 안전하게 조립되는지 검증한다.
2. runtime assembly와 binding 경로를 테스트한다.
3. 후속 slice가 자기 `contribution.ts`만 채워도 동작할 수 있다는 가정을 문서와 테스트로 남긴다.

### 완료 기준

- shell-adapter-boundary가 실제 병렬 작업 guardrail 역할을 한다.

## 8. 리스크와 대응

1. `processes/canvas-runtime`가 또 다른 giant module이 되는 위험
- 대응: slot, binding, assembly를 서로 다른 파일로 나누고, feature logic은 절대 이 레이어에 넣지 않는다.

2. placeholder export가 장기적으로 비어 있는 위험
- 대응: surface task 문서가 각자의 `contribution.ts`를 첫 번째 산출물로 요구하도록 맞춘다.

3. `GraphCanvas.tsx`에 feature branching이 다시 스며드는 위험
- 대응: 새 feature onboarding 원칙을 “runtime slot 추가 또는 contribution 채우기”로 문서에 고정한다.

## 9. 완료 정의

1. `processes/canvas-runtime`가 built-in slot을 조립하는 composition root로 존재한다.
2. `GraphCanvas.tsx`, `FloatingToolbar.tsx`, `useContextMenu.ts`, `WorkspaceClient.tsx`는 runtime consumer 역할만 남긴다.
3. 후속 4개 lane은 기본적으로 자기 `contribution.ts`와 feature-owned 파일만 수정한다.
