# Compile & Explorer Performance 개선 결과 보고서

- 작성일: 2026-03-03
- 기준선(Baseline): 2026-03-02 수동/기록값 (`docs/features/compile-explorer-performance/README.md`)
- 개선 후(Current): 2026-03-02 자동 계측값 (`scripts/perf/artifacts/current/*.ndjson`)
- 원칙: 정량 기준은 사전 추정이 아니라 사후 측정값으로 기록

---

## 1) 구현 요약

이번 사이클에서 반영된 핵심 개선은 다음과 같습니다.

1. route 경계 축소
- `app/app/page.tsx` thin shell화
- `app/components/editor/WorkspaceClient.tsx`로 오케스트레이션 이동
- render graph 파싱 분리: `app/features/render/parseRenderGraph.ts`

2. 초기 번들 부담 완화
- optional 패널 lazy 로딩(`ChatPanel`, `SearchOverlay`, `StickerInspector`, `QuickOpenDialog`)
- `jspdf` on-demand import
- syntax highlighter on-demand import
- markdown 렌더러 lazy wrapper 공통화

3. 반복 렌더 경량화
- `sourceVersion` 키 기반 render 캐시
- in-flight dedupe
- `hash/transpile/execute/total` 단계별 계측 + telemetry

4. 운영 측정 체계 구축
- warm-up 옵션/정책(`--warmup`, strict, timeout/retry, paths)
- 성능/정합성 스크립트(`scripts/perf/*`) 신설
- 산출물 정리 규칙(.gitignore, artifacts) 확립

---

## 2) 정량 결과 (Baseline vs Current)

> 수치 단위: build/dev는 `sec`, API는 `ms`.
> Delta는 `current - baseline` 기준이며 음수일수록 개선입니다.

### A. Build

| 지표 | Baseline | Current | Delta | 판정 |
|---|---:|---:|---:|---|
| `bun run build` cold | 41.980 | 35.379 | -6.601 | 개선 |
| `bun run build` warm | 22.050 | 25.468 | +3.418 | 악화 |
| `bun run build:app` warm | 19.260 | 21.168 | +1.908 | 악화 |

### B. Dev Route

| 지표 | Baseline | Current | Delta | 판정 |
|---|---:|---:|---:|---|
| `GET /` first-load | 15.400 | 17.454931 | +2.054931 | 악화 |
| `GET /api/file-tree` first-load | 3.390 | 5.978590 | +2.588590 | 악화 |
| `GET /` after-change (file touch) | 5.000 | 0.393402 | -4.606598 | 크게 개선 |
| `GET /` warm repeat | 0.530 | 0.668643 | +0.138643 | 악화 |

### C. API (Direct CLI)

| 지표 | Baseline | Current | Delta | 판정 |
|---|---:|---:|---:|---|
| `/render` warm p95 | 10.900 | 1.000 | -9.900 | 크게 개선 |
| `/file-tree` warm p95 | 44.300 | 3.149 | -41.151 | 크게 개선 |

### D. API (Next Proxy)

> 해당 축은 baseline 동일 포맷 데이터가 없어 current만 기록합니다.

| 지표 | Current |
|---|---:|
| `/render` warm p95 | 586.848 |
| `/file-tree` warm p95 | 2423.395 |

---

## 3) warm-up 검증 결과

실행 명령:

```bash
bun run cli.ts dev ./examples --port 3060 --warmup --warmup-timeout 15000 --warmup-retries 1
```

결과:

| route | attempt | durationMs | result |
|---|---:|---:|---|
| `/` | 1 | 4959.5 | success |
| `/api/file-tree` | 1 | 5739.3 | success |

해석:
- warm-up 자체는 정책대로 성공 수행됨.
- 다만 route compile 비용이 여전히 커서 cold 진입 체감은 추가 개선이 필요.

---

## 4) 품질/정합성 검증

- `scripts/perf/verify-render-consistency.sh`: pass (`nodes=4`, `edges=2`)
- `scripts/perf/verify-filetree-consistency.sh`: pass (`entries=36`)
- `bun test libs/cli/src/server/http.spec.ts`: pass
- `bun test app/components/nodes/renderableContent.test.tsx`: pass
- `cd app && bunx tsc -p tsconfig.json --noEmit`: fail (기존 `Buffer`/`BlobPart` 타입 이슈 1건, 이번 변경 신규 회귀 아님)

---

## 5) 결론

- 개선 확정:
  - 반복 편집 루프(`after-change /`)는 큰 폭 개선
  - direct CLI API latency(`/render`, `/file-tree`)는 큰 폭 개선
  - cold full build는 개선

- 추가 최적화 필요:
  - `first-load /`, `first-load /api/file-tree` 지연
  - `build warm`, `build:app warm` 악화 구간
  - `next-proxy /file-tree warm p95` 고지연 구간

즉, 이번 사이클은 **반복 작업 성능과 백엔드 직접 경로 최적화에는 유의미한 성과**, 반면 **cold 진입 및 프록시 경로에는 후속 최적화 과제**가 남아 있습니다.

---

## 6) 다음 분석 우선순위

1. `first-load /`와 `first-load /api/file-tree` compile/handler 시간 분리 계측
2. `next-proxy /file-tree` 고지연 원인 분해(compile, middleware, handler, serialization)
3. `build warm`/`build:app warm` 악화 요인 회귀 분석(엔트리 분할 영향, lint/type step 영향)
4. render cache hit ratio를 정량화해 실제 체감과 상관관계 확인
5. `scripts/perf/artifacts/baseline` 고정 생성 후 `report.sh` delta 자동 비교 운영
