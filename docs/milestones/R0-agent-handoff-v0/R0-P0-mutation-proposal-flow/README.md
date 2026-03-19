# R0-P0 Mutation Proposal Flow

## 개요

외부 agent 실행 결과를 즉시 적용하지 않고, proposal로 받아 승인/거절 후 revision으로 append하는 흐름을 정의한다.

## 왜 이 마일스톤인가

R0의 핵심은 AI 실행 그 자체가 아니라, external input을 canonical mutation proposal로 안전하게 받아들이는 것이다.

## 범위

- dry-run proposal 생성
- diff summary
- approve / reject
- revision append
- proposal 상태 전이

## 비범위

- rollback/hardening 전체
- revision compare
- audit UI 전체

## 핵심 결정 / 계약

- 모든 AI 변경은 direct write가 아니라 proposal을 거친다.
- proposal은 canonical mutation contract를 따른다.
- 승인 전에는 문서 truth를 바꾸지 않는다.
- 앱 내부 chat/session 없이 review/approval surface만 남긴다.

## 의존성

- `../R0-P0-personal-agent-host/README.md`

## 완료 기준

- 외부 실행 결과가 proposal로 저장된다.
- proposal을 승인/거절할 수 있다.
- 승인 시 document revision이 append된다.
- 거절 시 문서 truth는 바뀌지 않는다.
