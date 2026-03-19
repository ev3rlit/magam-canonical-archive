# R1-P1 Composable Block Body v1

## 개요

하나의 shape/sticky/note object 안에 ordered `contentBlocks`를 두고, text/markdown/chart/table block을 함께 담는 첫 제품 버전이다.

## 왜 이 마일스톤인가

이 기능은 magam의 핵심 차별점이다. R1에서는 mixed body의 첫 usable version을 열어 roadmap의 shape-local composable block 방향을 실제 surface로 만든다.

## 범위

- object-local ordered block body
- slash command insert
- built-in `text`, `markdown` block
- 기본 `chart`, `table` block
- block reorder / remove

## 비범위

- block-level copy/paste polish
- drag reorder polish 전체
- 고급 custom block marketplace

## 핵심 결정 / 계약

- block body의 canonical truth는 `contentBlocks`다.
- shape 내부 rich body는 composition이 아니라 canonical object가 소유한다.
- chart/table는 우선 shape-local block으로 취급한다.
- 작은 inline component와 independent plugin widget은 구분한다.
- mobile full editing에서도 같은 body를 다룰 수 있어야 한다.

## 의존성

- `docs/features/database-first-canvas-platform/canonical-object-persistence/README.md`
- `docs/features/database-first-canvas-platform/plugin-runtime-v1/README.md`

## 완료 기준

- 하나의 object 안에서 text/markdown/chart/table block을 함께 편집할 수 있다.
- `/` command로 block을 추가할 수 있다.
- ordered body가 canonical text/index path와 연결된다.
