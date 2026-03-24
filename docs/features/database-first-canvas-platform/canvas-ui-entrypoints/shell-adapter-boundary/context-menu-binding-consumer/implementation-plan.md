# Context Menu Binding Consumer 구현 계획서

## 1. 문서 목적

이 문서는 `useContextMenu.ts`에서 pane/node registry 해석과 session 조립을 runtime binding으로 이동한 adoption 내용을 정리한다.

- 기준 문서: `docs/features/database-first-canvas-platform/canvas-ui-entrypoints/shell-adapter-boundary/context-menu-binding-consumer/README.md`
- 상위 문서: `docs/features/database-first-canvas-platform/canvas-ui-entrypoints/shell-adapter-boundary/README.md`
- 직접 binding: `app/processes/canvas-runtime/bindings/contextMenu.ts`

## 2. 이전 문제

이전 `useContextMenu.ts`는 아래를 함께 소유했다.

1. pane/node inventory import
2. surface kind 결정
3. anchor id 생성
4. openSurface descriptor 생성
5. sanitized item 리스트 생성

즉 hook가 lifecycle consumer이면서 registry resolver도 같이 맡고 있었다.

## 3. 현재 목표

1. `useContextMenu.ts`는 overlay/session consumer가 된다.
2. registry 해석과 session 조립은 `contextMenu.ts` binding이 소유한다.
3. 후속 pane/node feature lane은 runtime slot item inventory를 바꾸되 hook file 자체는 덜 건드리게 한다.

## 4. 핵심 결정

### 결정 1. session은 binding이 한 번에 계산한다

binding은 아래를 묶어서 반환한다.

- anchor
- openSurface
- normalized context
- sanitized items

### 결정 2. fallback registry는 binding 내부에 둔다

runtime slot이 비어 있어도 pane/node menu가 최소한의 기본 동작을 유지하도록 fallback registry를 binding이 관리한다.

### 결정 3. hook는 overlay host lifecycle만 유지한다

hook는 overlay 열기/닫기와 local React state 동기화만 책임진다.

## 5. 실제 모듈 배치

1. `app/processes/canvas-runtime/bindings/contextMenu.ts`
2. `app/hooks/useContextMenu.ts`

## 6. Adoption 단계

### 단계 1. registry resolution helper 도입

- pane/node slot item 목록 선택
- fallback registry 처리

### 단계 2. session assembly helper 도입

- `ContextMenuContext`
- anchor
- open surface
- sanitized items

### 단계 3. hook lifecycle consumer 전환

- hook는 binding 결과를 overlay contribution으로 넘긴다.

## 7. 완료 정의

1. `useContextMenu.ts`는 registry owner가 아니다.
2. pane/node inventory와 session assembly는 `contextMenu.ts`를 통해서만 확장된다.
3. 후속 pane/node 작업이 hook file보다 feature-owned inventory를 우선 수정한다.
