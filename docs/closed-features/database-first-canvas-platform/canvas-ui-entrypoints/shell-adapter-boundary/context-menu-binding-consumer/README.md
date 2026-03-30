# Context Menu Binding Consumer

## 개요

이 sub-task는 `useContextMenu.ts`를 pane/node menu registry owner가 아니라 context-menu binding consumer로 축소한 내용을 문서화한다.

핵심은 `useContextMenu.ts`가 더 이상 직접 pane/node inventory를 import하고 anchor/openSurface/session을 조립하지 않고, `contextMenu.ts`가 계산한 session을 소비하는 것이다.

## 범위

- `app/processes/canvas-runtime/bindings/contextMenu.ts`
- `app/hooks/useContextMenu.ts`의 binding adoption
- pane/node menu inventory resolution
- anchor/openSurface/session 계산

## 비범위

- pane/node menu item inventory의 feature ownership
- overlay host lifecycle 자체 구현
- `ContextMenu` presenter UI 자체 리팩터링

## 현재 역할

현재 `useContextMenu.ts`는 다음을 직접 owner로 들지 않는다.

- pane/node registry import
- raw item selection
- anchor id 생성
- openSurface descriptor 생성
- sanitized item list 생성

이 값들은 `resolveCanvasContextMenuSession(...)`이 반환하고, hook은 overlay lifecycle과 local React state만 관리한다.

## 왜 분리하는가

이 경계가 없으면 `pane-context-menu`, `node-context-menu` lane이 모두 `useContextMenu.ts`와 shared config를 직접 수정하게 된다.

binding consumer 경계의 목적은 다음과 같다.

- registry 해석 책임을 runtime binding에 고정
- hook를 overlay/session consumer로 축소

## 완료 기준

- `useContextMenu.ts`는 pane/node inventory owner가 아니다.
- session 계산은 `contextMenu.ts` binding을 통해서만 이뤄진다.
- pane/node feature lane이 hook 파일을 기본 수정 경로로 삼지 않는다.

## 관련 문서

- `./implementation-plan.md`
- `./tasks.md`
- `../README.md`
- `../implementation-plan.md`
