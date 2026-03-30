# Pane Context Menu

## 개요

이 sub-slice는 빈 canvas 영역에서 여는 context menu를 담당한다.

## 범위

- blank-area create
- surface-level view action
- selection 비의존 action

## 비범위

- 선택 node 스타일 편집
- 관계 기반 node action

## 선행조건

- `entrypoint-foundation`
- `shell-adapter-boundary`
- `canonical-mutation-query-core`

## 통합 방식

- 이 slice는 `app/features/canvas-ui-entrypoints/pane-context-menu/contribution.ts`를 통해 `processes/canvas-runtime`의 pane fixed slot에 연결된다.
- pane menu item inventory는 feature-owned 파일에 두고, shared hook를 직접 owner로 삼지 않는다.

## 완료 기준

- 사용자는 빈 canvas에서 바로 생성과 뷰 조작을 시작할 수 있다.
- pane menu는 node menu와 action 의미가 겹치지 않는다.

## 관련 문서

- `./implementation-plan.md`
- `./tasks.md`
