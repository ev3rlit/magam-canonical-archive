# Tasks: Compile & Explorer Performance

**Input**: Design documents from `/Users/danghamo/Documents/gituhb/magam-compile-time-improvement/specs/003-compile-explorer-performance/`  
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: 명시적 TDD 요구는 없으므로 테스트-퍼스트 전용 태스크는 생성하지 않고, 각 사용자 스토리의 독립 검증 기준(측정/빌드/요청 시간)을 구현 태스크에 포함한다.

**Organization**: 사용자 스토리(P1 -> P2 -> P3) 기준으로 독립 구현/검증이 가능하도록 Phase를 분리한다.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 성능 측정 자동화를 위한 실행 골격 준비

- [X] T001 Create performance tooling directory and guide in `scripts/perf/README.md`
- [X] T002 [P] Create measurement script stubs in `scripts/perf/measure-build.sh`, `scripts/perf/measure-dev-routes.sh`, `scripts/perf/measure-api-latency.sh`, `scripts/perf/report.sh`
- [X] T003 [P] Register performance command aliases in `package.json`
- [X] T004 Add measurement artifact ignore rules in `.gitignore`, `scripts/perf/.gitignore`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 모든 사용자 스토리에서 공통으로 재사용할 측정/리포트 기반 구축

**⚠️ CRITICAL**: 이 단계 완료 전에는 사용자 스토리 구현을 시작하지 않는다.

- [X] T005 Implement shared metric serialization helpers in `scripts/perf/lib/metrics.sh`
- [X] T006 [P] Implement cold/warm build timing collector in `scripts/perf/measure-build.sh`
- [X] T007 [P] Implement dev route timing collector for `/` and `/api/file-tree` in `scripts/perf/measure-dev-routes.sh`
- [X] T008 [P] Implement direct/proxy API latency collector for `/render` and `/file-tree` in `scripts/perf/measure-api-latency.sh`
- [X] T009 Implement baseline-vs-current comparison report generator in `scripts/perf/report.sh`
- [X] T010 Sync measurement workflow documentation with contracts in `specs/003-compile-explorer-performance/contracts/performance-instrumentation-contract.md`, `specs/003-compile-explorer-performance/quickstart.md`

**Checkpoint**: 측정/리포트 기반 준비 완료 - 사용자 스토리 구현 시작 가능

---

## Phase 3: User Story 1 - 빠른 초기 진입 (Priority: P1) 🎯 MVP

**Goal**: 첫 화면/Explorer 진입 지연의 핵심 원인인 대형 클라이언트 라우트 부담을 줄인다.

**Independent Test**: `next dev`에서 첫 `GET /`, 첫 `GET /api/file-tree`를 재측정하고 절대값/변화량(delta)을 사후 기록해 개선 여부를 판단한다.

### Implementation for User Story 1

- [X] T011 [US1] Move existing Home orchestration into workspace client component in `app/components/editor/WorkspaceClient.tsx`
- [X] T012 [US1] Convert route entry to thin shell component in `app/app/page.tsx`
- [X] T013 [US1] Extract render-graph parsing logic into dedicated module in `app/features/render/parseRenderGraph.ts`
- [X] T014 [US1] Wire extracted parsing module into workspace flow in `app/components/editor/WorkspaceClient.tsx`
- [X] T015 [P] [US1] Introduce lazy optional panel loader module in `app/components/editor/LazyPanels.tsx`
- [X] T016 [US1] Replace static optional panel imports with lazy boundaries in `app/components/editor/WorkspaceClient.tsx`
- [X] T018 [US1] Record first-load route compile/request improvements in `docs/features/compile-explorer-performance/README.md`

**Checkpoint**: US1 단독으로 초기 진입 성능 개선 검증 가능(MVP)

---

## Phase 4: User Story 2 - 빠른 반복 편집 피드백 (Priority: P2)

**Goal**: 파일 변경 후 재컴파일/재렌더 루프와 무거운 의존성 초기 로딩 비용을 줄인다.

**Independent Test**: `app/page.tsx` 변경 후 첫 요청 시간, `/render` no-change rerender p95를 재측정하고 절대값/변화량(delta)을 사후 기록한다.

### Implementation for User Story 2

- [X] T019 [US2] Add render pipeline stage timing instrumentation (`transpile/execute/hash`) in `libs/cli/src/server/http.ts`
- [X] T020 [US2] Implement sourceVersion-keyed render cache and in-flight dedupe in `libs/cli/src/server/http.ts`
- [X] T021 [US2] Add render cache hit/miss telemetry logging in `libs/cli/src/server/http.ts`
- [X] T022 [US2] Add render correctness regression verification for node/edge/sourceMeta parity before vs after optimization in `scripts/perf/verify-render-consistency.sh`, `docs/features/compile-explorer-performance/README.md`
- [X] T023 [P] [US2] Replace eager jsPDF import with on-demand loading in `app/hooks/useExportImage.ts`
- [X] T024 [P] [US2] Replace eager syntax-highlighter imports with on-demand loading in `app/components/ui/CodeBlock.tsx`
- [X] T025 [US2] Create shared lazy markdown renderer wrapper in `app/components/markdown/LazyMarkdownRenderer.tsx`
- [X] T026 [US2] Migrate markdown render call sites to lazy wrapper in `app/components/nodes/MarkdownNode.tsx`, `app/components/nodes/StickerNode.tsx`, `app/components/nodes/renderableContent.tsx`
- [X] T027 [US2] Add loading fallback styles for lazy markdown/code rendering in `app/app/globals.css`
- [X] T028 [US2] Record rerender/API latency improvements in `docs/features/compile-explorer-performance/README.md`

**Checkpoint**: US2 단독으로 반복 편집/재렌더 성능 개선 검증 가능

---

## Phase 5: User Story 3 - 예측 가능한 빌드 성능 (Priority: P3)

**Goal**: 빌드/개발 성능을 반복 가능한 방식으로 계측하고 dev 워밍업으로 첫 요청 지연을 제어한다.

**Independent Test**: `bun run build` 단계별 측정 + `--warmup` 적용 전/후 첫 요청 측정값과 변화량(delta)을 사후 기록한다.

### Implementation for User Story 3

- [X] T029 [US3] Add warm-up CLI option and env parsing (`--warmup`, `--no-warmup`, strict/timeouts) in `cli.ts`
- [X] T030 [US3] Implement sequential warm-up runner (`/` -> `/api/file-tree`) with timeout/retry in `cli.ts`
- [X] T031 [US3] Implement strict failure shutdown policy for warm-up in `cli.ts`
- [X] T032 [US3] Harden file-tree proxy route behavior for warm-up consistency in `app/app/api/file-tree/route.ts`
- [X] T033 [US3] Add explorer correctness regression verification for tree completeness/sort/filter invariants in `scripts/perf/verify-filetree-consistency.sh`, `docs/features/compile-explorer-performance/README.md`
- [X] T034 [P] [US3] Add end-to-end performance report command wrappers in `package.json`, `specs/003-compile-explorer-performance/quickstart.md`
- [X] T035 [US3] Run cold/warm build measurements and publish comparison results in `docs/features/compile-explorer-performance/README.md`
- [X] T036 [US3] Run warm-up validation measurements and document usage examples in `docs/features/compile-explorer-performance/README.md`, `cli.ts`

**Checkpoint**: US3 단독으로 예측 가능한 빌드/워밍업 운영 검증 가능

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: 전체 스토리 공통 문서 정합성 및 최종 검증 정리

- [X] T037 [P] Reconcile planning artifacts with implemented task scope in `specs/003-compile-explorer-performance/plan.md`, `specs/003-compile-explorer-performance/research.md`, `specs/003-compile-explorer-performance/data-model.md`
- [X] T038 Validate quickstart command sequence and capture caveats in `specs/003-compile-explorer-performance/quickstart.md`
- [X] T039 [P] Run final verification commands and record outcomes in `docs/features/compile-explorer-performance/README.md`
- [X] T040 Finalize measurement artifact hygiene rules in `.gitignore`, `scripts/perf/.gitignore`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: 즉시 시작 가능
- **Phase 2 (Foundational)**: Phase 1 완료 후 진행, 모든 사용자 스토리의 선행 조건
- **Phase 3~5 (User Stories)**: 모두 Phase 2 완료 후 시작 가능
- **Phase 6 (Polish)**: 선택한 사용자 스토리 완료 후 진행

### User Story Dependencies

- **US1 (P1)**: Foundational 이후 바로 시작 가능, MVP
- **US2 (P2)**: Foundational 이후 시작 가능, US1과 독립 검증 가능
- **US3 (P3)**: Foundational 이후 시작 가능, US1/US2와 독립 검증 가능

### Within Each User Story

- 구조 변경 -> 기능 통합 -> 측정 반영 순으로 진행
- `[P]` 태스크만 병렬 수행
- 각 스토리의 Independent Test 기준 충족 후 다음 우선순위로 진행

---

## Parallel Execution Examples

### User Story 1

```bash
Task: "T013 [US1] Extract parser module in app/features/render/parseRenderGraph.ts"
Task: "T015 [US1] Create lazy panel loader in app/components/editor/LazyPanels.tsx"
```

### User Story 2

```bash
Task: "T023 [US2] Dynamic import jsPDF in app/hooks/useExportImage.ts"
Task: "T024 [US2] Dynamic import syntax highlighter in app/components/ui/CodeBlock.tsx"
Task: "T025 [US2] Create lazy markdown wrapper in app/components/markdown/LazyMarkdownRenderer.tsx"
```

### User Story 3

```bash
Task: "T032 [US3] Harden file-tree proxy route in app/app/api/file-tree/route.ts"
Task: "T034 [US3] Add performance report command wrappers in package.json and specs/003-compile-explorer-performance/quickstart.md"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1~2 완료
2. Phase 3(US1) 완료
3. 초기 진입 측정값 개선 확인 후 MVP 확정

### Incremental Delivery

1. US1: route 경계 축소 및 optional UI lazy boundary
2. US2: 반복 편집/재렌더 최적화 + 무거운 의존성 지연 로딩
3. US3: 워밍업 + 빌드 성능 운영 자동화
4. 각 단계에서 문서 지표 갱신

### Parallel Team Strategy

1. 팀 공통으로 Phase 1~2 완료
2. 이후 담당 분리:
   - A: US1 (client boundary split)
   - B: US2 (render cache + lazy deps)
   - C: US3 (warm-up + reporting)
3. Phase 6에서 통합 검증 및 문서 정리

---

## Notes

- 모든 태스크는 `- [X] Txxx [P?] [US?] 설명 + 파일 경로` 형식을 따른다.
- `[US#]` 라벨은 사용자 스토리 Phase(3~5)에만 부여했다.
- 권장 MVP 범위는 **US1(Phase 3)** 이다.
