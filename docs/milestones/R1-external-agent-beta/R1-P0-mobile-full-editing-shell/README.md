# R1-P0 Mobile Full Editing Shell

## 개요

mobile을 review-only companion이 아니라 full editing shell로 정리한다. 문서 열기, selection, move, create, delete, quick style/content edit가 mobile에서도 정상 경로가 된다.

## 왜 이 마일스톤인가

mobile full editing 지원은 제품 원칙이다. R1에서는 이를 beta 수준의 shell로 고정해야 이후 AI handoff와 review flow가 자연스럽게 붙는다.

## 범위

- full canvas editing shell
- selection / move / create / delete
- quick style / content edit
- proposal inbox와 상태 확인
- external handoff entry 연결

## 비범위

- gesture polish 전체
- advanced inspector parity
- realtime collaboration

## 핵심 결정 / 계약

- mobile은 desktop 축소판이 아니라 별도 shell이다.
- 하지만 editing capability 자체는 full path를 지원한다.
- mobile의 AI 입력은 내장 chat이 아니라 external handoff가 기본이다.
- shape-local composable block body는 mobile에서도 열 수 있어야 한다.

## 의존성

- `R1-P0-canonical-app-convergence/README.md`
- `R1-P1-composable-block-body-v1/README.md`

## 완료 기준

- mobile에서 full canvas editing이 가능하다.
- proposal inbox와 handoff entry가 같은 shell 안에 있다.
- desktop 전용이 아닌 모바일 기본 편집 경로가 문서화된다.
