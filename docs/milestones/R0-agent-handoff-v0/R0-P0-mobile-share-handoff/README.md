# R0-P0 Mobile Share Handoff

## 개요

mobile/web에서 현재 문서, 선택 영역, 사용자 요청을 외부 agent host로 넘기는 share entry를 정의한다.

## 왜 이 마일스톤인가

mobile full editing은 지원하지만 AI 활용성이 약하다. 따라서 R0에서 가장 먼저 필요한 것은 앱 내부 chat이 아니라 external handoff entry다.

## 범위

- document share payload
- selection share payload
- free-text instruction share
- host 대상 전달
- handoff 성공/실패 상태 표시

## 비범위

- mobile 전용 AI chat UI
- handoff 이후 queue/reconnect/resume 고도화
- review shell 전체 polish

## 핵심 결정 / 계약

- AI 입력은 mobile share handoff 같은 외부 경로로만 들어온다.
- handoff payload는 canonical query/mutation에 필요한 문맥만 담는다.
- 앱 내부에는 model picker나 session UI를 두지 않는다.
- mobile은 full editing을 지원하지만 AI 요청 입력은 handoff가 기본이다.

## 의존성

- `../R0-P0-personal-agent-host/README.md`
- `../R0-P0-mutation-proposal-flow/README.md`

## 완료 기준

- mobile/web에서 현재 문서 또는 selection을 share 할 수 있다.
- 사용자 요청이 함께 host로 전달된다.
- handoff 결과를 사용자가 인지할 수 있다.
- proposal 흐름으로 자연스럽게 이어진다.
