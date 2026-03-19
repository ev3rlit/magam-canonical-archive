# R2-P1 Composable Block Body v2

## 개요

R1에서 연 object-local mixed block body를 1.0 수준의 편집 경험으로 다듬는다.

## 왜 이 마일스톤인가

shape-local composable block body는 제품 차별점이므로, R2에서 polish 없이 남겨두면 1.0의 핵심 경험이 약해진다.

## 범위

- richer slash command UX
- block drag reorder polish
- block-level copy/paste
- block-level selection behavior

## 비범위

- block marketplace
- 무제한 custom block schema
- full Notion clone

## 핵심 결정 / 계약

- canonical truth는 계속 ordered `contentBlocks`다.
- built-in `text`, `markdown`, `chart`, `table` block 중심으로 polish한다.
- mobile full editing과 desktop authoring shell 모두에서 같은 block body 모델을 사용한다.

## 의존성

- `../../R1-external-agent-beta/R1-P1-composable-block-body-v1/README.md`

## 완료 기준

- slash command UX가 자연스럽다.
- block reorder/copy/paste/selection이 제품 핵심 경험으로 보인다.
- object-local block body가 1.0 차별점으로 설명 가능하다.
