# Graph Canvas Host Consumer

## 개요

이 sub-task는 `shell-adapter-boundary`의 one-time adoption 중 `GraphCanvas.tsx`를 host consumer로 축소한 내용을 문서화한다.

핵심은 `GraphCanvas.tsx`가 더 이상 toolbar contribution, pane/node context menu context, surface-specific action 묶음을 직접 owner로 들지 않고 `graphCanvasHost` binding이 만든 결과를 소비하는 것이다.

## 범위

- `app/processes/canvas-runtime/bindings/graphCanvasHost.ts`
- `app/components/GraphCanvas.tsx`의 host adoption
- toolbar contribution 생성 위임
- pane/node context menu action/context 생성 위임

## 비범위

- toolbar 실제 section inventory
- pane/node menu item inventory
- action routing bridge contract 자체 정의
- keyboard host boundary

## 현재 역할

현재 구조에서 `GraphCanvas.tsx`는 아래 helper를 호출하는 consumer다.

- `createGraphCanvasContextMenuActions(...)`
- `createGraphCanvasNodeContextMenu(...)`
- `createGraphCanvasPaneContextMenu(...)`
- `createGraphCanvasToolbarContribution(...)`

즉 `GraphCanvas.tsx`는 host event와 ReactFlow state를 제공하지만, surface wiring의 세부 조립은 `graphCanvasHost.ts`가 맡는다.

## 왜 분리하는가

이 경계가 없으면 후속 `canvas-toolbar`, `pane-context-menu`, `node-context-menu` 작업이 모두 다시 `GraphCanvas.tsx`에 직접 분기를 추가하게 된다.

host consumer 경계의 목적은 다음 둘이다.

- `GraphCanvas.tsx`를 shared shell file hot spot에서 host file로 축소
- menu/toolbar wiring 책임을 feature surface가 아니라 runtime binding에 고정

## 완료 기준

- `GraphCanvas.tsx`는 surface-specific action object를 inline owner로 확장하지 않는다.
- pane/node context menu context shape는 binding helper를 통해서만 생성된다.
- toolbar overlay contribution은 host binding 결과를 mount하는 수준으로 유지된다.

## 관련 문서

- `./implementation-plan.md`
- `./tasks.md`
- `../README.md`
- `../implementation-plan.md`
