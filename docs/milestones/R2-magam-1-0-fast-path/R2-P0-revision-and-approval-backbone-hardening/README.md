# R2-P0 Revision and Approval Backbone Hardening

## 개요

proposal 기반 제품 흐름을 1.0 수준으로 끌어올리기 위해 rollback, audit, revision compare를 정리한다.

## 왜 이 마일스톤인가

R2는 첫 제품 완성 버전이다. 이 단계에서는 proposal이 단순 승인 버튼이 아니라 운영 가능한 revision backbone으로 보여야 한다.

## 범위

- rollback
- audit
- revision compare
- approval event 정리

## 비범위

- enterprise workflow engine
- 복잡한 approval policy matrix
- realtime collaborative merge UX

## 핵심 결정 / 계약

- AI 입력은 계속 외부 agent에서만 들어온다.
- 앱 내부 chat/session UI는 복귀하지 않는다.
- canonical revision이 모든 승인/거절/되돌리기의 기준이다.

## 의존성

- `../../R1-external-agent-beta/R1-P0-external-proposal-console/README.md`

## 완료 기준

- proposal 승인 결과를 revision 기준으로 비교할 수 있다.
- rollback 경로가 명확하다.
- audit trail이 제품 운영 수준으로 보인다.
