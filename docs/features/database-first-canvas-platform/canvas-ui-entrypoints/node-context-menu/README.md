# Node Context Menu

## 개요

이 sub-slice는 선택 node 기준의 구조적 / 저빈도 contextual action을 담당한다.

## 범위

- rename
- child create / sibling create
- group or container scoped action
- object/content edit 진입
- duplicate / delete / lock

## 비범위

- 고빈도 스타일 편집
- canvas-global action
- 빈 공간 create action

## 선행조건

- `entrypoint-foundation`
- `canonical-mutation-query-core`

## 완료 기준

- 고빈도 스타일 편집은 floating menu에 남기고, 구조적 / 저빈도 action만 node context menu에 남는다.
- 메뉴 노출은 renderer type이 아니라 canonical metadata와 relation context로 결정된다.
