# R0 Agent Handoff V0

## 개요

- Target Date: `2026-03-26`
- 기준 문서: `docs/milestones/README.md`, `docs/reports/magam-completion-architecture-roadmap/README.md`
- 이 마일스톤은 `BYO Agent Runtime + Mobile Share Handoff`의 첫 usable path를 연다.

## 목표

- mobile/web에서 외부 agent host로 작업을 넘기고 proposal 승인까지 닫는다.
- provider proxy 없이 사용자 소유 AI 도구를 연결한다.
- 결과를 file patch가 아니라 canonical mutation proposal로 다룬다.

## 포함 피쳐

| Priority | Folder | Goal |
| --- | --- | --- |
| `P0` | `R0-P0-personal-agent-host` | 사용자 소유 원격 실행 환경을 연다 |
| `P0` | `R0-P0-mobile-share-handoff` | mobile/web share payload를 host로 보낸다 |
| `P0` | `R0-P0-mutation-proposal-flow` | dry-run proposal, 승인/거절, revision append를 고정한다 |
| `P1` | `R0-P1-minimal-reliability` | timeout, retry, offline 상태 같은 최소 안정성을 넣는다 |

## 완료 기준

- mobile 또는 web에서 현재 문서/선택 영역/요청을 share로 보낼 수 있다.
- `Personal Agent Host`가 작업 envelope를 수신한다.
- Host가 사용자의 AI 도구를 직접 실행한다.
- 결과가 `canonical mutation proposal`로 돌아온다.
- mobile 또는 desktop에서 proposal을 승인/거절할 수 있다.
- 승인된 결과가 document revision으로 append된다.

## 이번 마일스톤에서 하지 않는 것

- GUI 앱 원격 제어 일반화
- 실시간 cursor collaboration
- plugin marketplace
- 완전한 mobile 편집 parity 추가 polish
