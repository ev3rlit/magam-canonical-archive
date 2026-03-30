# Legacy TSX Migration

## 상태

이 feature는 **후속 작업으로 분리된 상태**다. 현재 `database-first-canvas-platform` 범위에는 포함하지 않는다.

## 배경

Magam의 장기 방향은 database-first canvas platform이지만, 기존 `.tsx` 자산을 어떻게 읽고 변환하고 provenance를 남길지는 별도의 문제다.

이 문제는 다음 이유로 분리한다.

- storage 전환과 legacy migration tool은 설계 관심사가 다르다.
- 현재 우선순위는 DB-backed canonical model, canvas composition, plugin runtime을 고정하는 것이다.
- importer/migration tool을 같은 feature에 넣으면 현재 스코프가 빠르게 커진다.

## 이 feature가 다룰 것

- 기존 `.tsx` 자산을 database-first document로 변환하는 importer
- 변환 성공/실패/부분 변환에 대한 provenance 기록
- legacy custom component를 native node 또는 plugin instance로 매핑하는 규칙
- read-only reference, one-time import, re-import 정책
- migration용 CLI/agent tooling

## 현재 단계에서 다루지 않을 것

- database-first canonical schema 자체
- plugin runtime 자체
- canvas 직접 편집 mutation core
- DB schema migration/backup/export 일반론

## 다음 단계 질문

- importer의 입력 범위를 “known native components only”로 제한할지
- 모르는 custom TSX component를 opaque reference로 둘지, plugin scaffold로 만들지
- re-import를 diff 기반으로 할지, one-shot import로 제한할지
- import provenance를 document revision과 어떻게 연결할지

## 관련 문서

- `docs/features/database-first-canvas-platform/README.md`
- `docs/features/database-first-canvas-platform/implementation-plan.md`
- `docs/adr/ADR-0005-database-first-canvas-platform.md`
