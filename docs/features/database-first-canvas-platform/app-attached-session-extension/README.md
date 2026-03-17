# App Attached Session Extension

## 개요

이 slice는 headless CLI 위에 app-attached session 기능을 확장하는 단계다.

목표는 앱이 실행 중일 때 selection, live viewport, session-local state 같은 runtime context를 같은 CLI surface에서 사용할 수 있게 하는 것이다.

## 왜 네 번째인가

- session-aware command는 canonical query/mutation core가 먼저 있어야 의미가 있다.
- app-attached mode는 headless CLI의 대체가 아니라 선택적 확장이어야 한다.

## 범위

- app-attached bridge
- local app session discovery
- auto mode에서 session-aware command 자동 attach
- selection query
- selection 대상 mutation apply
- `APP_SESSION_REQUIRED` 같은 구조화된 실패 응답

## 비범위

- persistence core 재설계
- plugin runtime 실행
- collaborative presence/CRDT 확정

## 핵심 계약

- core query/mutation은 계속 headless fallback 가능
- session-aware command만 app-attached 전용
- command 이름, 인자, JSON 응답 형식은 실행 모드와 무관하게 유지

## 선행조건

- `docs/features/database-first-canvas-platform/canonical-mutation-query-core/README.md`
- `docs/features/database-first-canvas-platform/ai-cli-headless-surface/README.md`
- `docs/features/database-first-canvas-platform/ai-cli-tooling.md`

## 다음 slice에 넘겨야 할 것

- plugin runtime이 필요로 하는 live host/session access 패턴
- auto/headless/attach 실행 정책 정리

## 완료 기준

- 앱 실행 중에는 selection-aware 명령이 자동 attach된다.
- 앱 비실행 상태에서는 session 전용 명령이 구조화된 에러를 반환한다.
- core headless 명령과 session-aware 명령이 같은 CLI surface 안에서 공존한다.
