# Canvas Toolbar

## 개요

이 sub-slice는 canvas 전체에 대한 전역 toolbar를 담당한다.

## 범위

- interaction mode 전환
- create tool 선택
- viewport quick control
- canvas-global quick action

## 비범위

- 선택 node 고빈도 스타일 편집
- node 구조 변경 action
- 빈 공간 우클릭 메뉴

## 선행조건

- `entrypoint-foundation`
- `shell-adapter-boundary`
- `canonical-mutation-query-core`

## 통합 방식

- 이 slice는 `app/features/canvas-ui-entrypoints/canvas-toolbar/contribution.ts`를 통해 `processes/canvas-runtime`의 toolbar fixed slot에 연결된다.
- `GraphCanvas.tsx`나 `WorkspaceClient.tsx`를 직접 수정해 붙이는 방식은 기본 경로가 아니다.

## 완료 기준

- 사용자는 empty canvas에서도 toolbar만으로 첫 오브젝트를 만들 수 있다.
- toolbar는 floating menu나 node context menu와 책임이 겹치지 않는다.

## 관련 문서

- `./implementation-plan.md`
- `./tasks.md`
