# R1-P0 External Proposal Console

## 개요

앱 내부 AI chat을 대체하는 주 AI surface다. 사용자는 대화 로그가 아니라 proposal 목록, 영향 범위, 승인/거절, retry/rollback 중심으로 외부 agent 결과를 다룬다.

## 왜 이 마일스톤인가

R1의 핵심은 demo path를 beta로 바꾸는 것이다. 이를 위해 AI surface를 chat이 아니라 proposal console로 재정의해야 한다.

## 범위

- proposal list
- proposal detail
- 영향 범위 표시
- approve / reject
- retry
- rollback entry

## 비범위

- conversation UI
- model picker
- chat session/history

## 핵심 결정 / 계약

- 앱 내부 AI chat/session UI는 제공하지 않는다.
- 외부 agent 입력 결과는 proposal console에서만 다룬다.
- canonical mutation proposal이 유일한 AI write 경로다.
- mobile full editing 지원과 분리해서 AI review surface를 둔다.

## 의존성

- `../../R0-agent-handoff-v0/R0-P0-mutation-proposal-flow/README.md`

## 완료 기준

- proposal list와 detail을 볼 수 있다.
- 승인/거절/retry가 한 surface에서 동작한다.
- 기존 chat UI 없이도 외부 agent 결과를 운영할 수 있다.
