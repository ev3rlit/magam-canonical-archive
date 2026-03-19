# R1-P0 Canonical App Convergence

## 개요

앱의 primary path를 DB-backed document flow로 수렴시킨다. legacy file-first 편집 경로는 compatibility mode로 격하한다.

## 왜 이 마일스톤인가

beta 단계에서 아직도 file-first UX가 주 경로로 남아 있으면 roadmap 전체가 흔들린다. R1에서 앱의 중심을 canonical DB로 명확히 바꿔야 한다.

## 범위

- DB-backed open/save 기본 경로
- legacy file path compatibility mode
- file-first 가정 제거
- canonical revision path 정리

## 비범위

- legacy TSX migration tool 완성
- file-first round-trip 유지
- fallback canonical truth 이원화

## 핵심 결정 / 계약

- canonical DB만 primary source of truth다.
- `.tsx`는 canonical editable artifact가 아니다.
- legacy file patch path는 compatibility/transition adapter다.
- external AI 입력도 같은 canonical mutation path를 쓴다.

## 의존성

- `docs/features/database-first-canvas-platform/canonical-object-persistence/README.md`
- `docs/features/database-first-canvas-platform/canonical-mutation-query-core/README.md`

## 완료 기준

- DB-backed open/save가 앱의 기본 경로다.
- legacy file path는 secondary compatibility path로 문서화된다.
- primary UX가 canonical DB 기준으로 설명된다.
