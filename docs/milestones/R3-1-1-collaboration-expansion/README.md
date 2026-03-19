# R3 1.1 Collaboration Expansion

## 개요

- Target Date: `post-1.0`
- 기준 문서: `docs/milestones/README.md`, `docs/reports/magam-completion-architecture-roadmap/README.md`
- 이 마일스톤은 1.0 이후 validated demand가 있을 때 collaboration scale-up을 담당한다.

## 목표

- presence-lite와 realtime pilot을 별도 버전으로 분리한다.
- legacy TSX migration/import tooling을 후속 작업으로 다룬다.
- 1.0 핵심 경로를 흔들지 않고 확장 기능만 올린다.

## 포함 피쳐

| Priority | Folder | Goal |
| --- | --- | --- |
| `P1` | `R3-P1-presence-lite` | light presence와 follow 기초를 연다 |
| `P1` | `R3-P1-realtime-pilot-for-shared-document` | shared document 대상 realtime pilot을 검증한다 |
| `P2` | `R3-P2-legacy-tsx-migration-and-import-tooling` | legacy TSX import/migration 도구를 분리 구현한다 |

## 완료 기준

- realtime collaboration이 1.0 경로와 분리된 별도 버전으로 관리된다.
- presence-lite와 pilot scope가 문서화되고 검증 가능하다.
- legacy TSX migration이 canonical DB truth를 흔들지 않는 별도 경로로 정의된다.

## 이번 마일스톤에서 하지 않는 것

- provider proxy
- in-app AI chat/session 복귀
- canvas primary truth의 file-first 회귀
- marketplace 상용화
