# Plugin Runtime v1

## 개요

이 slice는 database-first canonical model과 canvas composition 위에 plugin runtime을 올리는 단계다.

목표는 chart/table/calendar/custom widget 같은 외부 시각화 요소를 문서와 분리된 runtime asset으로 안전하게 수용하는 것이다.

## 왜 마지막인가

- plugin은 canonical object persistence와 mutation/query core를 소비하는 쪽이다.
- AI/CLI와 app-attached surface가 먼저 안정되어야 plugin host API와 binding contract도 안정된다.

## 범위

- plugin manifest/registry/version/export 모델
- plugin instance persistence 연동
- sandbox runtime
- host API 최소 계약
- missing plugin fallback
- props/binding validation

## 비범위

- plugin marketplace/결제/배포 채널 확정
- arbitrary trusted code direct mount
- final security hardening 전체

## 핵심 계약

- plugin source와 plugin instance 분리
- canvas document는 plugin reference + props + binding 중심
- plugin은 host API를 통해서만 데이터 접근
- untrusted plugin은 sandbox 실행

## 선행조건

- `docs/features/database-first-canvas-platform/canonical-object-persistence/README.md`
- `docs/features/database-first-canvas-platform/canonical-mutation-query-core/README.md`
- `docs/features/database-first-canvas-platform/ai-cli-headless-surface/README.md`
- `docs/features/database-first-canvas-platform/app-attached-session-extension/README.md`

## 완료 기준

- 최소 2종 plugin 예제가 sandbox 경로로 렌더된다.
- plugin load failure가 문서 전체 failure가 되지 않는다.
- plugin instance props/binding validation이 표준 에러 계약을 따른다.
