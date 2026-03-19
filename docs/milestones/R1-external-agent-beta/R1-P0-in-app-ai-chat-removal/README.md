# R1-P0 In-App AI Chat Removal

## 개요

기존에 개발한 내장 AI chat/session 기능을 제품 범위에서 제거한다. 앱 내부 AI 접근은 제공하지 않고, 외부 agent 입력만 허용한다.

## 왜 이 마일스톤인가

external proposal console을 주 AI surface로 올리려면 기존 chat/session 경로를 같은 마일스톤에서 제거해야 제품 메시지와 구현 방향이 흔들리지 않는다.

## 범위

- header/chat 진입점 제거
- chat panel 제거
- chat/session state 제거
- local AI chat API surface 제거
- 관련 문서/용어 정리

## 비범위

- external agent host 제거
- CLI/MCP 제거
- proposal review/approval surface 제거

## 핵심 결정 / 계약

- 앱 내부 AI chat/session/model picker는 제공하지 않는다.
- AI 입력은 외부 agent host, CLI, MCP, mobile share handoff만 허용한다.
- 앱 안에는 입력용 chat UI 대신 proposal review/approval surface만 남긴다.
- provider proxy fallback은 만들지 않는다.

## 의존성

- `R1-P0-external-proposal-console/README.md`

## 완료 기준

- 앱 내부에 AI chat/session 진입점이 없다.
- chat/session state가 제품 범위에서 제거된다.
- external proposal flow만 남는다.
