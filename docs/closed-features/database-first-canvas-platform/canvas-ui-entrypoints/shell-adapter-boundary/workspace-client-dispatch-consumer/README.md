# Workspace Client Dispatch Consumer

## 개요

이 sub-task는 `WorkspaceClient.tsx`를 surface-specific dispatch owner가 아니라 action-dispatch binding consumer로 축소한 내용을 문서화한다.

핵심은 `WorkspaceClient.tsx`가 더 이상 `surface -> intentId -> envelope -> routeIntent -> mutation/runtime action -> rollback` 전체 흐름을 직접 owner로 들지 않고, `actionDispatch.ts` binding이 그 orchestration을 맡는 것이다.

## 범위

- `app/processes/canvas-runtime/bindings/actionDispatch.ts`
- `app/components/editor/WorkspaceClient.tsx`의 dispatch adoption
- surface normalization
- bridge envelope meta 결정
- mutation/runtime dispatch orchestration

## 비범위

- node/pane selection context 해석 자체
- error toast 문자열 자체 정의
- canonical mutation/query contract 자체 재설계

## 현재 역할

현재 `WorkspaceClient.tsx`는 binding에 아래 dependency를 제공하는 consumer다.

- current runtime snapshot
- runtime action 적용 함수
- mutation executor
- history effect commit
- pending action routing register/clear

그리고 실제 surface normalization, `intentId` 결정, envelope 조립, rollback orchestration은 `createCanvasActionDispatchBinding(...)`가 맡는다.

## 왜 분리하는가

이 경계가 없으면 `canvas-toolbar`, `selection-floating-menu`, `pane-context-menu`, `node-context-menu` lane이 모두 `WorkspaceClient.tsx`에 새 dispatch branching을 추가하게 된다.

dispatch consumer 경계의 목적은 다음과 같다.

- `WorkspaceClient.tsx`를 app-shell consumer로 축소
- surface-specific dispatch policy를 runtime binding으로 고정

## 완료 기준

- `WorkspaceClient.tsx`는 dispatch orchestration owner가 아니다.
- surface normalization과 envelope meta 결정은 `actionDispatch.ts`에서 일어난다.
- 후속 surface lane이 `WorkspaceClient.tsx`를 기본 수정 경로로 삼지 않는다.

## 관련 문서

- `./implementation-plan.md`
- `./tasks.md`
- `../README.md`
- `../implementation-plan.md`
