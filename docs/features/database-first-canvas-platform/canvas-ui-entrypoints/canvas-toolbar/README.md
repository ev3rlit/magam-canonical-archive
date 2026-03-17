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
- `canonical-mutation-query-core`

## 완료 기준

- 사용자는 empty canvas에서도 toolbar만으로 첫 오브젝트를 만들 수 있다.
- toolbar는 floating menu나 node context menu와 책임이 겹치지 않는다.
