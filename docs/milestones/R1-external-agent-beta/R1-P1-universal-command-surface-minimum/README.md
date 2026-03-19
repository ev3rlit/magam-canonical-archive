# R1-P1 Universal Command Surface Minimum

## 개요

search, quick open, external handoff entry를 하나의 최소 command surface로 묶는다.

## 왜 이 마일스톤인가

R1에서 사용자는 탐색과 외부 AI handoff를 분리된 진입점이 아니라 한 surface에서 다뤄야 한다. 다만 이 버전은 minimum에 집중한다.

## 범위

- search entry
- quick open entry
- external handoff entry
- 최소 keyboard trigger

## 비범위

- planner-style 자연어 대형 변경 UI
- 내장 AI chat
- 복잡한 multi-surface palette

## 핵심 결정 / 계약

- 앱 내부 AI chat/session은 없다.
- command surface는 external handoff의 진입점이 된다.
- canonical query/navigation과 외부 AI handoff가 같은 surface에서 만난다.

## 의존성

- `R1-P0-external-proposal-console/README.md`
- `R1-P0-canonical-app-convergence/README.md`

## 완료 기준

- search와 quick open, external handoff가 하나의 surface에서 열린다.
- 별도의 in-app AI chat 진입점 없이도 외부 AI 입력 경로를 찾을 수 있다.
