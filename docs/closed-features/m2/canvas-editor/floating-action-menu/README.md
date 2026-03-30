# Floating Action Menu

## 개요

이 feature는 canvas editor에서 선택된 node와 활성 body block 위에 붙는 floating action menu를 정의한다.

이 메뉴는 단순한 스타일 툴바가 아니라, `universal body blocks` 모델에서 node-level defaults와 block-level overrides를 분리해서 조작하는 핵심 UI surface다.

`node-create`가 "노드를 만들고 기본 body를 seed하는 기능"이라면, `floating-action-menu`는 "만들어진 node/body를 빠르게 조작하는 기능"이다.

## 왜 별도 feature인가

이 기능을 `node-create`에 같이 넣으면 다음이 섞이게 된다.

- create mutation
- body seed
- active block state
- text selection state
- anchor positioning
- menu dismiss/focus rule
- typography default/override 해석

이 조합은 persistence 문제보다 interaction state 문제에 가깝다. 따라서 별도 feature로 분리해 UI/runtime 상태 모델에 집중하는 편이 안전하다.

## 목표

1. node-level floating menu와 block-level floating menu를 분리한다.
2. node-level 메뉴는 공용 body defaults만 다룬다.
3. block-level 메뉴는 현재 block override만 다룬다.
4. 후속 단계에서 inline text toolbar를 독립 레벨로 확장할 수 있게 한다.
5. shadcn 기반 조합 패턴을 고정한다.

## 비범위

1. node create 자체
2. slash command inventory 설계
3. body block persistence schema 확정
4. plugin runtime block 실행 자체
5. inspector 전체 대체

## 핵심 모델

### 1. node-level floating menu

표시 조건:

- node selected
- active block 없음

역할:

- body default font size
- body default text align
- theme, tone, spacing 같은 body container defaults
- `/` insert 진입
- 기타 node shell 수준 quick action

중요:

- 이 메뉴는 "공용 기본값"만 바꾼다.
- block override가 이미 있는 경우 강제로 덮어쓰지 않는다.

### 2. block-level floating menu

표시 조건:

- node selected
- 특정 body block active

역할:

- 현재 markdown block font size override
- 현재 markdown block text align override
- heading/body/list/todo 같은 block style
- block duplicate/delete/move
- block type convert

중요:

- 이 메뉴는 현재 block만 수정한다.
- node-level defaults와 다른 레벨이다.

### 3. inline text toolbar

표시 조건:

- markdown block 내부 text selection 존재

역할:

- bold
- italic
- link
- inline code

초기 구현에서는 이 레벨을 바로 닫지 않고, 후속 단계로 둔다.

## 상태 우선순위

권장 우선순위:

1. `node selected, no active block`
  - node-level menu 표시
2. `node selected + active block`
  - block-level menu 표시
  - node-level menu는 축소 또는 secondary 상태
3. `text selection inside block`
  - inline text toolbar 표시

즉 하나의 floating menu가 모든 상태를 다 커버하는 방식은 피한다.

## 스타일 해석 규칙

권장 해석 순서:

1. block-level override
2. node-level body defaults
3. global editor defaults

이 규칙이 있어야 node-level의 일괄 설정과 block-level의 개별 예외 처리가 동시에 자연스럽게 동작한다.

## shadcn 기준 조합

공식 shadcn/ui에는 `Floating Action Menu` 완성 컴포넌트가 따로 있는 것은 아니고, 다음 조합을 기준으로 본다.

- node-level menu
  - `Popover` + `Button Group` + 필요 시 `Dropdown Menu`
- block-level menu
  - `Popover`
- 우클릭 메뉴
  - `Context Menu`
- 후속 inline text toolbar
  - 작은 `Popover` 또는 selection-anchored toolbar

즉 이 feature는 "단일 컴포넌트 도입"이 아니라 "anchor-aware overlay 조합 패턴"을 고정하는 성격이 강하다.

## `node-create`와의 경계

`node-create`가 소유하는 것:

- create intent
- canonical mutation
- body seed
- 생성 직후 편집 진입

`floating-action-menu`가 소유하는 것:

- selected node anchor
- active block anchor
- node-level defaults menu
- block-level override menu
- dismiss / focus / priority 규칙

즉 생성 직후 editor에 focus가 들어간 다음부터의 빠른 조작은 이 feature가 소유한다.

## 첫 milestone 범위

첫 milestone에서는 아래까지만 구현한다.

1. node-level floating menu
  - body default font size
  - body default text align
2. block-level floating menu
  - current markdown block font size override
  - current markdown block text align override

초기에는 다음을 하지 않는다.

- inline text toolbar
- heterogeneous multi-block mixed selection
- apply-to-all override overwrite
- plugin block 전용 floating menu

## 완료 기준

1. body-capable node를 선택하면 node-level floating menu가 뜬다.
2. node 내부 markdown block을 활성화하면 block-level floating menu가 뜬다.
3. node-level 메뉴는 defaults만, block-level 메뉴는 override만 수정한다.
4. menu 간 우선순위와 dismiss 규칙이 일관된다.
5. shadcn 기반 조합이 코드 경로에서 재사용 가능하게 정리된다.

## 관련 문서

- `../node-create/README.md`
- `../node-create/implementation-plan.md`
