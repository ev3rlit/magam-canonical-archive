# R2-P0 Desktop Authoring UX Convergence

## 개요

desktop authoring shell의 주요 surface를 하나의 일관된 경험으로 정리한다.

## 왜 이 마일스톤인가

R2는 1.0 fast path다. desktop에서 editing, proposal review, inspector, context menu가 따로 노는 상태로는 첫 완성 버전을 선언하기 어렵다.

## 범위

- floating contextual actions
- node context menu 정리
- pane context menu 정리
- inspector hierarchy 정리

## 비범위

- 새로운 editor paradigm 실험
- realtime collaboration 전용 UI
- desktop 전용 in-app AI chat 복귀

## 핵심 결정 / 계약

- desktop도 external proposal console을 사용한다.
- object-local composable block body는 이 shell 안에서 자연스럽게 편집되어야 한다.
- canonical mutation path가 direct manipulation과 review flow를 공통으로 묶는다.

## 의존성

- `../../R1-external-agent-beta/R1-P0-external-proposal-console/README.md`
- `../../R1-external-agent-beta/R1-P1-composable-block-body-v1/README.md`

## 완료 기준

- desktop authoring의 주요 진입점이 일관된 구조를 가진다.
- 편집, review, inspector가 서로 충돌하지 않는다.
- object-local block body 편집이 desktop 기본 흐름으로 녹아든다.
