# R0-P0 Personal Agent Host

## 개요

사용자 소유 원격 실행 환경을 만든다. 이 호스트는 mobile/web에서 온 작업 envelope를 받아 사용자의 AI 도구를 직접 실행하고, 결과를 canonical mutation proposal로 반환한다.

## 왜 이 마일스톤인가

R0의 usable path는 `share -> host -> proposal -> approval`로 정의된다. 그중 host가 없으면 외부 AI 입력 경로가 성립하지 않는다.

## 범위

- trusted device 등록
- pairing token 또는 로컬 credential
- job intake
- job status 조회
- result callback
- Codex/Claude Code 계열 adapter entry

## 비범위

- provider proxy
- GUI app 원격 제어 일반화
- multi-host orchestration
- plugin/runtime 확장 기능

## 핵심 결정 / 계약

- 앱 내부 AI chat/session은 없다.
- AI 입력은 외부 host를 통해서만 들어온다.
- host는 사용자의 도구를 직접 실행한다.
- 결과는 raw file patch가 아니라 canonical mutation proposal이다.
- mobile full editing 지원과 별개로, AI 활용성은 host가 보강한다.

## 의존성

- `docs/reports/magam-completion-architecture-roadmap/README.md`
- `../R0-P0-mutation-proposal-flow/README.md`

## 완료 기준

- 하나의 host가 pair 될 수 있다.
- host가 job을 수신하고 adapter를 실행할 수 있다.
- host가 proposal payload를 반환할 수 있다.
- 문서가 provider proxy 없이도 외부 AI 실행 경로를 가진다.
