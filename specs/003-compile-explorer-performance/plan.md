# Implementation Plan: Compile & Explorer Performance

**Branch**: `003-compile-explorer-performance` | **Date**: 2026-03-02 | **Spec**: `/Users/danghamo/Documents/gituhb/magam-compile-time-improvement/specs/003-compile-explorer-performance/spec.md`
**Input**: Feature specification from `/specs/003-compile-explorer-performance/spec.md` and `/Users/danghamo/Documents/gituhb/magam-compile-time-improvement/docs/features/compile-explorer-performance/README.md`

## Summary

현재 체감 지연의 핵심 병목은 `libs/*`가 아니라 `app`의 Next route compile 및 대형 클라이언트 엔트리(`app/app/page.tsx`)이다. 기술 접근은 다음 3축으로 구성한다: (1) `page.tsx` 클라이언트 경계 축소 및 optional UI lazy boundary 도입, (2) `jspdf`/markdown/syntax-highlighter의 on-demand 로딩, (3) dev 기동 후 선택적 워밍업(`GET /`, `GET /api/file-tree`) 자동화. 동시에 기존 렌더/Explorer 정확성을 유지하기 위해 성능 계측 계약과 검증 루프를 고정한다.

## Technical Context

**Language/Version**: TypeScript 5.9.x, React 18, Bun 1.3.x, Next.js 15.x  
**Primary Dependencies**: Next.js App Router, React Flow 11, Zustand, `jspdf`, `react-markdown`, `react-syntax-highlighter`, `fast-glob`  
**Storage**: 파일 기반 설정/코드 + 메모리 상태(Zustand), 신규 DB 없음  
**Testing**: `bun run build`, `next build`, `bun test`, `bunx tsc --noEmit`, API latency script(curl)  
**Target Platform**: 로컬 개발 환경(Desktop, macOS/Linux), Next dev/build + Bun runtime
**Project Type**: monorepo web application + local CLI/HTTP server  
**Performance Goals**: `POST /render` p95 <= 2.0s, no-change rerender p95 <= 500ms, `GET /file-tree` 초기 p95 <= 700ms, refresh p95 <= 400ms  
**Constraints**: 기존 렌더/Explorer 결과 정확성 유지, `sticker`/기존 노드 회귀 금지, 기본 dev UX 유지(워밍업은 opt-in)  
**Scale/Scope**: `app/app/page.tsx`, `app/components/*`, `app/hooks/useExportImage.ts`, `cli.ts`, `app/app/api/file-tree/route.ts`, 성능 문서/계측 자산

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- Principle I (Think Before Coding): 측정 기반 baseline(빌드/route/API)을 확보했고 가설을 명시했다.
- Principle II (Simplicity First): 신규 인프라 없이 경계 분리, 동적 로딩, 워밍업 옵션만 추가한다.
- Principle III (Surgical Changes): 성능 경로 파일 중심으로 제한, 무관한 리팩터링 금지.
- Principle IV (Goal-Driven Execution): 각 단계에 수치 검증 지표(`Compiled / in`, p95, route size)를 연결한다.
- Technical Constraints:
  - Bun 기반 명령 유지
  - Zustand 상태체계 유지
  - React Reconciler 경로(`@magam/core`) 의미 불변

Pre-Phase-0 Gate: **PASS**  
Post-Phase-1 Gate: **PASS** (research/data-model/contracts/quickstart가 모두 수치 검증 루프와 최소 변경 원칙을 충족)

## Project Structure

### Documentation (this feature)

```text
specs/003-compile-explorer-performance/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── dev-warmup-contract.md
│   └── performance-instrumentation-contract.md
└── tasks.md
```

### Source Code (repository root)

```text
app/
├── app/
│   ├── page.tsx
│   └── api/file-tree/route.ts
├── components/
│   ├── GraphCanvas.tsx
│   ├── nodes/MarkdownNode.tsx
│   └── ui/CodeBlock.tsx
├── hooks/useExportImage.ts
└── store/
    ├── graph.ts
    └── graph.ts

libs/
└── cli/src/server/http.ts

cli.ts
docs/features/compile-explorer-performance/README.md
```

**Structure Decision**: 기존 monorepo 구조를 유지하며, route/client 경계와 lazy loading 경계만 재배치한다. 서버 API 계약은 유지하고 계측/워밍업 계약만 확장한다.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| 없음 | N/A | N/A |

## Implementation Status (2026-03-02)

- `app/app/page.tsx`는 thin shell로 축소되었고 `WorkspaceClient` 경계로 분리됨.
- optional panel 경계(`SearchOverlay`, `StickerInspector`, `QuickOpenDialog`)를 lazy 모듈로 전환함.
- render parsing 로직을 `app/features/render/parseRenderGraph.ts`로 분리함.
- `libs/cli/src/server/http.ts`에 render pipeline 계측 + sourceVersion 캐시 + in-flight dedupe를 적용함.
- `cli.ts` warm-up 옵션/환경변수/strict 정책을 구현함.
- `scripts/perf/*` 계측/검증 스크립트를 추가해 재현 가능한 측정 루프를 구성함.
