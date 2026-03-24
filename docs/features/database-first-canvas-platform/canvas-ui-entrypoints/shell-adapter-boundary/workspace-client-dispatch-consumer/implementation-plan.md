# Workspace Client Dispatch Consumer 구현 계획서

## 1. 문서 목적

이 문서는 `WorkspaceClient.tsx`에서 surface-specific dispatch orchestration을 runtime binding으로 이동한 adoption 내용을 정리한다.

- 기준 문서: `docs/features/database-first-canvas-platform/canvas-ui-entrypoints/shell-adapter-boundary/workspace-client-dispatch-consumer/README.md`
- 상위 문서: `docs/features/database-first-canvas-platform/canvas-ui-entrypoints/shell-adapter-boundary/README.md`
- 직접 binding: `app/processes/canvas-runtime/bindings/actionDispatch.ts`

## 2. 이전 문제

이전 `WorkspaceClient.tsx`는 아래를 함께 소유했다.

1. `surface -> ActionRoutingSurfaceId` 정규화
2. legacy surface 문자열 해석
3. `intent -> intentId / optimistic` 결정
4. `UIIntentEnvelope` 조립
5. runtime action/rollback/pending/history orchestration

즉 app-shell component가 dispatch policy와 executor wiring을 동시에 맡고 있었다.

## 3. 현재 목표

1. `WorkspaceClient.tsx`는 binding consumer가 된다.
2. surface normalization과 dispatch orchestration은 `actionDispatch.ts`가 소유한다.
3. 후속 surface lane은 `WorkspaceClient.tsx` 대신 binding과 feature-owned action contract를 우선 수정한다.

## 4. 핵심 결정

### 결정 1. binding이 intent envelope meta를 결정한다

`style-update`, `rename-node`, `create-node`, `content-update`가 어떤 `intentId`와 optimistic policy를 쓰는지는 binding이 결정한다.

### 결정 2. runtime executor dependency만 host가 제공한다

host는 runtime snapshot과 mutation executor를 제공하고, orchestration은 binding이 수행한다.

### 결정 3. legacy surface alias 해석도 binding helper로 둔다

`canvas-toolbar`와 `toolbar` 같은 alias normalization은 shared helper로 이동한다.

## 5. 실제 모듈 배치

1. `app/processes/canvas-runtime/bindings/actionDispatch.ts`
2. `app/components/editor/WorkspaceClient.tsx`

## 6. Adoption 단계

### 단계 1. dispatch binding 생성

- runtime snapshot getter
- mutation executor
- runtime action applier

### 단계 2. consumer handler 전환

- style commit
- rename commit
- create commit

### 단계 3. legacy surface resolution helper 통합

- `surfaceId` / `surface` alias를 binding helper가 정리한다.

## 7. 완료 정의

1. `WorkspaceClient.tsx`는 dispatch consumer 역할만 남긴다.
2. surface-specific dispatch policy는 `actionDispatch.ts`에서 확장된다.
3. 후속 surface lane이 `WorkspaceClient.tsx`보다 binding file을 우선 수정하게 된다.
