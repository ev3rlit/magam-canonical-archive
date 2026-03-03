# Compile & Explorer Performance

## 1. 문제 정의

현재 병목은 크게 두 축입니다.

1. `next dev` 첫 진입 route compile (`/`, `/api/file-tree`) 지연
2. 대형 클라이언트 엔트리 + 무거운 의존성 초기 로딩 + render pipeline 중복 연산

정량 기준은 **사전 추정이 아니라 사후 측정값으로 기록**하는 방식으로 운영합니다.

---

## 2. 이번 구현 반영 범위

### US1 - 초기 진입 경계 축소

- `app/app/page.tsx`를 thin shell로 축소
- 실제 오케스트레이션을 `app/components/editor/WorkspaceClient.tsx`로 이동
- render graph 파싱 로직을 `app/features/render/parseRenderGraph.ts`로 분리
- optional panel을 lazy boundary로 분리
  - `app/components/editor/LazyPanels.tsx`
  - `ChatPanel`, `SearchOverlay`, `StickerInspector`, `QuickOpenDialog` on-demand 로딩
- 채팅 UI 토글 상태를 경량 스토어로 분리
  - `app/store/chatUi.ts`
  - `Header`, `ChatPanel`, `WorkspaceClient` 연동

### US2 - 반복 편집/렌더 경량화

- `libs/cli/src/server/http.ts`
  - `render` 단계별 타이밍 계측(`hash/transpile/execute/total`)
  - `sourceVersion` 키 캐시 도입
  - in-flight dedupe 도입
  - cache hit/miss/dedupe telemetry 로그 추가 (`[Perf][render]`)
- `app/hooks/useExportImage.ts`
  - `jspdf` top-level import 제거, PDF 생성 시점 동적 import
- `app/components/ui/CodeBlock.tsx`
  - syntax highlighter 동적 로딩
- markdown 렌더 공통 lazy wrapper 추가
  - `app/components/markdown/LazyMarkdownRenderer.tsx`
  - `MarkdownNode`, `StickerNode`, `renderableContent` 마이그레이션
- lazy fallback 스타일 추가
  - `app/app/globals.css`

### US3 - 운영/계측 자동화

- `cli.ts`
  - `--warmup`, `--no-warmup`, `--warmup-strict`, `--warmup-timeout`, `--warmup-retries`, `--warmup-paths`
  - `MAGAM_WARMUP*` env 파싱
  - 순차 warm-up (`/` -> `/api/file-tree`) + timeout/retry + strict 실패 종료 정책
- `app/app/api/file-tree/route.ts`
  - `force-dynamic`, `force-no-store`, `revalidate=0`로 일관 동작 고정
- 성능 스크립트 신설
  - `scripts/perf/measure-build.sh`
  - `scripts/perf/measure-dev-routes.sh`
  - `scripts/perf/measure-api-latency.sh`
  - `scripts/perf/report.sh`
  - `scripts/perf/verify-render-consistency.sh`
  - `scripts/perf/verify-filetree-consistency.sh`
  - `scripts/perf/lib/metrics.sh`

---

## 3. 측정 명령

```bash
# build cold/warm + 단계별
bash scripts/perf/measure-build.sh --label current --mode both

# dev route 요청 시간 (dev 서버 실행 중)
bash scripts/perf/measure-dev-routes.sh \
  --label current \
  --base-url http://localhost:3050 \
  --touch-file app/app/page.tsx \
  --dev-log /tmp/magam-dev-perf.log

# API direct/proxy latency
bash scripts/perf/measure-api-latency.sh \
  --label current \
  --samples 20 \
  --direct-base-url http://localhost:3003 \
  --proxy-base-url http://localhost:3050/api \
  --render-file examples/overview.tsx

# 리포트
bash scripts/perf/report.sh --baseline-label baseline --current-label current
```

산출물:

- `scripts/perf/artifacts/current/build-metrics.ndjson`
- `scripts/perf/artifacts/current/dev-route-metrics.ndjson`
- `scripts/perf/artifacts/current/api-metrics.ndjson`
- `scripts/perf/artifacts/current/report.md`

---

## 4. 실측 결과 (2026-03-02)

### Build (current)

| stage | mode | realSec |
|---|---|---:|
| full | cold | 35.379 |
| full | warm | 25.468 |
| app | cold | 32.094 |
| app | warm | 21.168 |
| shared | warm | 1.623 |
| core | warm | 1.551 |
| runtime | warm | 0.307 |
| cli | warm | 0.428 |

### Dev routes (current)

| route | phase | requestTimeSec |
|---|---|---:|
| `/` | first-load | 17.454931 |
| `/api/file-tree` | first-load | 5.978590 |
| `/` | after-change | 0.393402 |
| `/` | warm-repeat | 0.668643 |
| `/api/file-tree` | warm-repeat | 0.490346 |

### API latency (current)

| endpoint | pathType | scenario | p95Ms |
|---|---|---|---:|
| `/render` | direct-cli-http | warm | 1.000 |
| `/render` | next-proxy | warm | 586.848 |
| `/file-tree` | direct-cli-http | warm | 3.149 |
| `/file-tree` | next-proxy | warm | 2423.395 |

### Warm-up validation (current)

`bun run cli.ts dev ./examples --port 3060 --warmup --warmup-timeout 15000 --warmup-retries 1`

| route | attempt | durationMs | result |
|---|---:|---:|---|
| `/` | 1 | 4959.5 | success |
| `/api/file-tree` | 1 | 5739.3 | success |

### Correctness regression checks

- `verify-render-consistency.sh`: pass (`nodes=4`, `edges=2`)
- `verify-filetree-consistency.sh`: pass (`entries=36`)

---

## 5. baseline 대비 해석

기존 baseline(수동 측정) 대비 관찰:

- 긍정 신호
  - cold full build: `41.98s -> 35.379s` (감소)
  - 변경 후 첫 `/` 요청: `5.00s -> 0.393s` (큰 폭 개선)
  - direct `/render` warm p95: `10.9ms -> 1.0ms` (감소)
- 추가 분석 필요
  - first-load `/`: `15.4s -> 17.45s` (증가)
  - first-load `/api/file-tree`: `3.39s -> 5.98s` (증가)
  - next-proxy `/file-tree` warm p95가 높게 관측됨

즉, **반복 편집 루프는 개선되었지만 cold 진입과 프록시 경로는 추가 최적화가 필요**합니다.

---

## 6. 다음으로 바로 진행하면 좋은 순서 (분석 반영)

1. `first-load /`와 `first-load /api/file-tree`를 분리 계측해 compile 지연 원인을 재분해
2. `next-proxy /file-tree` 고지연 구간을 route-level 로그로 추적(compile vs handler)
3. `WorkspaceClient` 초기 렌더 시 필수/비필수 상태 접근을 추가 분리
4. render cache hit ratio(%)를 로그에 기록해 실제 체감과 상관관계 확인
5. baseline 디렉터리(`scripts/perf/artifacts/baseline`)를 고정 생성 후 `report.sh` delta 자동 비교 운영

---

## 7. 현재 이슈/주의사항

- `next build` 경고: `@magam/core`의 `renderer.ts`에서 React internal import warning이 지속됨
- app 타입체크에는 기존 테스트 파일 타입 이슈(`route.spec.ts`의 Buffer/BlobPart)가 남아 있음 (이번 작업의 신규 회귀는 아님)
- `scripts/perf`는 회귀 탐지용이며, CI 연동 전에는 로컬 환경 편차를 함께 기록해야 함

## 8. 최종 검증 실행 결과

- `bun test libs/cli/src/server/http.spec.ts` : pass
- `bun test app/components/nodes/renderableContent.test.tsx` : pass
- `bash scripts/perf/verify-render-consistency.sh --direct-base-url http://localhost:3003 --proxy-base-url http://localhost:3050/api --file-path overview.tsx --runs 2` : pass
- `bash scripts/perf/verify-filetree-consistency.sh --direct-base-url http://localhost:3003 --proxy-base-url http://localhost:3050/api` : pass
- `cd app && bunx tsc -p tsconfig.json --noEmit` : fail (기존 Buffer/BlobPart 타입 이슈 1건)
