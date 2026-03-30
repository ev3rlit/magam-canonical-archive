# Floating Toolbar Presenter Consumer 구현 계획서

## 1. 문서 목적

이 문서는 `FloatingToolbar.tsx`의 presenter state와 surface toggle policy를 runtime binding으로 이동한 adoption 내용을 정리한다.

- 기준 문서: `docs/features/database-first-canvas-platform/canvas-ui-entrypoints/shell-adapter-boundary/floating-toolbar-presenter-consumer/README.md`
- 상위 문서: `docs/features/database-first-canvas-platform/canvas-ui-entrypoints/shell-adapter-boundary/README.md`
- 직접 binding: `app/processes/canvas-runtime/bindings/toolbarPresenter.ts`

## 2. 이전 문제

이전 `FloatingToolbar.tsx`는 아래를 함께 소유했다.

1. toolbar active state 계산
2. create/preset menu open 여부 계산
3. anchor 생성
4. surface open/close policy
5. create/preset 선택 후 close 정책

즉 presenter file이 단순 렌더러가 아니라 toolbar runtime policy owner였다.

## 3. 현재 목표

1. `FloatingToolbar.tsx`는 presenter consumer가 된다.
2. toolbar runtime policy는 `toolbarPresenter.ts` helper가 소유한다.
3. 후속 `canvas-toolbar` lane은 presenter file 대신 feature-owned model을 우선 수정한다.

## 4. 핵심 결정

### 결정 1. presenter-derived state를 helper로 분리한다

`activeCreateLabel`, `activeWashiPresetLabel`, open surface 여부 같은 값은 helper가 계산한다.

### 결정 2. toggle policy는 host-independent helper로 분리한다

surface open/close는 DOM ref와 runtime surface api만 받는 helper로 이동한다.

### 결정 3. selection-owned preset branching을 presenter file에 다시 늘리지 않는다

selection-aware 제어가 필요하면 presenter file이 아니라 surface feature 또는 binding helper에서 처리한다.

## 5. 실제 모듈 배치

1. `app/processes/canvas-runtime/bindings/toolbarPresenter.ts`
2. `app/components/FloatingToolbar.tsx`

## 6. Adoption 단계

### 단계 1. presenter state helper 도입

- runtime state와 props를 합쳐 presenter state를 계산한다.

### 단계 2. surface toggle helper 도입

- create/preset menu toggle
- anchor registration
- close policy

### 단계 3. selection helper 도입

- interaction mode 선택
- create mode 선택
- preset 선택 후 close

## 7. 완료 정의

1. `FloatingToolbar.tsx`가 surface policy owner가 아니다.
2. toolbar presenter contract 변경은 우선 `toolbarPresenter.ts`에서 일어난다.
3. `canvas-toolbar` feature가 presenter file을 기본 수정 경로로 삼지 않는다.
