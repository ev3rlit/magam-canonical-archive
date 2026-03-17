# AI CLI Headless Surface

## 개요

이 slice는 앱이 실행 중이지 않아도 동작하는 AI-first CLI surface를 정의하고 구현하는 단계다.

목표는 canonical persistence와 mutation/query core를 shell-friendly JSON contract로 노출하는 것이다.

## 왜 세 번째인가

- CLI가 먼저 나오면 persistence와 mutation contract가 역으로 굳어질 위험이 있다.
- headless CLI는 canonical service가 먼저 안정되어야 얇은 transport로 유지할 수 있다.

## 범위

- headless CLI bootstrap
- workspace/document/object/surface query 명령
- object update-content / patch-capability 명령
- canvas node move/reparent 명령
- `--json` 중심 응답
- `jq` 친화 envelope
- `mutation apply` / `--dry-run`

## 비범위

- live selection/session access
- app-attached bridge
- plugin source authoring/publish

## 핵심 계약

- 앱 비실행 상태에서도 동작
- raw DB access 금지
- domain command만 노출
- canonical filter 우선
  - `semantic-role`
  - `content-kind`
  - `has-capability`
- query/mutation 결과는 구조화된 JSON envelope 반환

## 선행조건

- `docs/features/database-first-canvas-platform/canonical-object-persistence/README.md`
- `docs/features/database-first-canvas-platform/canonical-mutation-query-core/README.md`
- `docs/features/database-first-canvas-platform/ai-cli-tooling.md`

## 다음 slice에 넘겨야 할 것

- app-attached mode와 공유할 command surface
- MCP wrapper가 재사용할 service contract

## 완료 기준

- headless mode에서 representative workspace query가 동작한다.
- canonical object content/capability patch가 CLI로 수행된다.
- `mutation apply --dry-run`이 structured result를 반환한다.
- `jq` 파이프를 전제로 해도 core query partiality는 CLI 인자가 담당한다.
