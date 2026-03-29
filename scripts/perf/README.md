# Performance Tooling

`compile-explorer-performance` 기능의 정량 측정을 위한 스크립트 모음입니다.

## Quick Start

```bash
# 빌드 단계 측정
bash scripts/perf/measure-build.sh --label current

# dev route 요청 측정 (dev 서버 별도 실행 필요)
bash scripts/perf/measure-dev-routes.sh --label current --base-url http://localhost:3000 --touch-file editor/src/app/page.tsx

# API latency 측정 (Next + CLI 서버 실행 필요)
bash scripts/perf/measure-api-latency.sh --label current --samples 20

# baseline/current 비교 리포트 생성
bash scripts/perf/report.sh --baseline-label baseline --current-label current
```

## Directory Layout

- `scripts/perf/lib/metrics.sh`: 공통 타이밍/통계 helper
- `scripts/perf/measure-build.sh`: cold/warm 빌드 시간 측정
- `scripts/perf/measure-dev-routes.sh`: `/`, `/api/file-tree` 요청 시간 측정
- `scripts/perf/measure-api-latency.sh`: `/render`, `/file-tree` 직접/프록시 p95 측정
- `scripts/perf/report.sh`: baseline/current delta markdown 리포트 생성
- `scripts/perf/verify-render-consistency.sh`: render 결과 정합성 검증
- `scripts/perf/verify-filetree-consistency.sh`: file-tree 정합성 검증

## Artifacts

기본 출력 위치는 `scripts/perf/artifacts/<label>/` 입니다.

- `build-metrics.ndjson`
- `dev-route-metrics.ndjson`
- `api-metrics.ndjson`
- `report.md`

NDJSON 포맷은 `specs/003-compile-explorer-performance/contracts/performance-instrumentation-contract.md` 계약을 따릅니다.
