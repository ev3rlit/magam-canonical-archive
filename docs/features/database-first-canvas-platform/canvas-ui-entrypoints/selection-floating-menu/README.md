# Selection Floating Menu

## 개요

이 sub-slice는 선택된 node 위에 붙는 고빈도 직접 편집 액션 바를 담당한다.

Miro benchmark 기준으로, 이 메뉴는 우클릭 메뉴보다 먼저 보이는 1차 조작 surface다.

## v1 액션

- 오브젝트 유형 변경
- 폰트 스타일
- 폰트 크기
  - 자동
  - 수동 선택
- 볼드
- 텍스트 정렬
- 컬러
- 더보기

## 비범위

- child/sibling create
- group/container action
- duplicate/delete/lock 같은 저빈도 contextual action

## 선행조건

- `entrypoint-foundation`
- `canonical-mutation-query-core`

## 완료 기준

- single selection 또는 homogeneous multi-selection에서 빠른 직접 편집이 가능하다.
- 적용 불가능한 control은 숨기거나 disable된다.
