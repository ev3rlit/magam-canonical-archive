# R1-P0 Host Reliability and Queue

## 개요

R0의 minimal reliability를 beta 수준으로 확장해 reconnect, queued job, resume을 지원한다.

## 왜 이 마일스톤인가

external agent path가 반복 사용 가능한 beta가 되려면 host 불안정성을 견디는 최소 queue/reconnect 구조가 필요하다.

## 범위

- reconnect
- queued jobs
- resume
- host health 표시

## 비범위

- multi-host orchestration
- distributed scheduler
- enterprise HA

## 핵심 결정 / 계약

- provider proxy fallback은 두지 않는다.
- host 실패는 명시적으로 표면화한다.
- job queue는 proposal flow와 연결된 상태 머신을 따른다.
- 앱 내부 chat/session 복귀는 허용하지 않는다.

## 의존성

- `../../R0-agent-handoff-v0/R0-P0-personal-agent-host/README.md`
- `../../R0-agent-handoff-v0/R0-P1-minimal-reliability/README.md`

## 완료 기준

- host 재연결이 가능하다.
- job이 queue에 남는다.
- 중단된 작업을 resume할 수 있다.
- 상태가 desktop/mobile에서 일관되게 보인다.
