# Tasks: Electron Desktop Host

**Input**: Design documents from `/Users/danghamo/Documents/gituhb/magam-feature-electron-desktop-host/specs/010-electron-desktop-host/`  
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`

**Tests**: 별도 테스트 태스크는 포함하지 않는다. 본 스펙은 테스트 구현을 명시적으로 요구하지 않으므로 구현 태스크 중심으로 분해하고, 최종 검증은 Polish 단계에서 수행한다.

**Organization**: 작업은 사용자 스토리별로 구성해 각 스토리를 독립적으로 구현/검증할 수 있게 유지한다.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 서로 다른 파일을 다루며 선행 미완료 의존성이 없는 병렬 가능 작업
- **[Story]**: 해당 작업이 속한 사용자 스토리 (`US1`~`US4`)
- 모든 작업은 구체적인 파일 경로를 포함한다.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: desktop host 전환을 위한 공통 문맥과 실행 엔트리 뼈대를 준비한다.

- [x] T001 Create desktop host feature module scaffold in `app/features/desktop-host/index.ts`
- [x] T002 [P] Create host contracts module scaffold in `app/features/host/contracts/index.ts`
- [x] T003 [P] Create RPC adapter module scaffold in `app/features/host/rpc/index.ts`
- [x] T004 [P] Create renderer host adapter entry scaffold in `app/features/host/renderer/index.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 모든 스토리가 공유하는 host interface, RPC logical method, bootstrap 상태 모델을 먼저 고정한다.

**⚠️ CRITICAL**: 이 단계가 완료되기 전에는 사용자 스토리 구현을 시작하지 않는다.

- [x] T005 Define canonical RPC logical methods in `app/features/host/contracts/rpcMethods.ts`
- [x] T006 [P] Define host capability surface types in `app/features/host/contracts/hostCapabilities.ts`
- [x] T007 [P] Define desktop bootstrap session model in `app/features/desktop-host/bootstrapSession.ts`
- [x] T008 [P] Implement shared adapter parity validator in `app/features/host/rpc/validateParity.ts`
- [x] T009 [P] Add host boundary guard utilities in `app/features/host/contracts/boundaryGuards.ts`
- [x] T010 Export foundational contracts from `app/features/host/contracts/index.ts` and `app/features/host/rpc/index.ts`

**Checkpoint**: host capability/RPC contract/bootstrap 모델이 고정되어 모든 스토리 작업의 공통 선행 조건을 충족한다.

---

## Phase 3: User Story 1 - 데스크톱 직접 진입 경로 확보 (Priority: P1) 🎯 MVP

**Goal**: Next.js route handler 없이 desktop renderer가 workspace authoring 화면으로 직접 진입하는 경로를 만든다.

**Independent Test**: desktop startup 명령으로 workspace authoring 진입 시 `app/app/api/*` 경로 의존 없이 초기 렌더가 완료되는지 확인한다.

### Implementation for User Story 1

- [x] T011 [US1] Implement desktop main process bootstrap entry in `app/features/desktop-host/main.ts`
- [x] T012 [P] [US1] Implement desktop preload bridge entry in `app/features/desktop-host/preload.ts`
- [x] T013 [P] [US1] Implement renderer startup handshake adapter in `app/features/desktop-host/rendererBootstrap.ts`
- [x] T014 [US1] Add desktop bootstrap runner script in `scripts/dev/desktop-dev.ts`
- [x] T015 [US1] Wire desktop dev script and Electron runtime dependency entry in `package.json`
- [x] T016 [US1] Add desktop startup orchestration service in `app/features/desktop-host/orchestrator.ts`
- [x] T017 [US1] Integrate renderer startup gate with workspace readiness in `app/components/editor/WorkspaceClient.tsx`

**Checkpoint**: desktop primary path에서 workspace authoring 화면 진입이 가능하고 Next.js route handler가 필수 경로가 아니다.

---

## Phase 4: User Story 2 - Host-agnostic Renderer 경계 고정 (Priority: P1)

**Goal**: renderer product logic을 host-neutral 경계로 분리하고 `/api/*` 직접 의존을 RPC interface 호출로 대체한다.

**Independent Test**: renderer domain 코드에서 `/api/*` 직접 호출과 `electron` 직접 import 없이 동일 기능(files/file-tree/render/edit/sync/chat)을 수행할 수 있어야 한다.

### Implementation for User Story 2

- [x] T018 [US2] Introduce renderer-facing RPC client interface in `app/features/host/renderer/rpcClient.ts`
- [x] T019 [P] [US2] Introduce renderer-facing host capability interface in `app/features/host/renderer/hostCapabilities.ts`
- [x] T020 [US2] Replace files/file-tree API usage with RPC client interface in `app/components/editor/WorkspaceClient.tsx`
- [x] T021 [US2] Replace render API usage with RPC client interface in `app/components/editor/WorkspaceClient.tsx`
- [x] T022 [P] [US2] Replace chat API usage with RPC client interface in `app/store/chat.ts`
- [x] T023 [P] [US2] Replace sidebar file-tree API usage with RPC client interface in `app/components/ui/Sidebar.tsx`
- [x] T024 [US2] Centralize renderer host adapter wiring (including `edit.apply` and `sync.watch` bindings) in `app/features/host/renderer/createHostRuntime.ts`
- [x] T025 [US2] Convert `app/app/page.tsx` to thin host wrapper around renderer entry in `app/app/page.tsx`

**Checkpoint**: renderer product 계층이 host interface만 참조하고 필수 `/api/*` direct dependency가 제거된다.

---

## Phase 5: User Story 3 - Desktop Host Lifecycle/Capability 분리 (Priority: P2)

**Goal**: Electron main/preload 책임을 lifecycle/orchestration/capability bridge로 제한하고 도메인 로직 ownership을 분리한다.

**Independent Test**: preload가 최소 권한 capability surface만 노출하고 main/preload가 editability/command/domain mutation 로직을 직접 소유하지 않는지 확인한다.

### Implementation for User Story 3

- [x] T026 [US3] Implement capability-scoped preload API map in `app/features/desktop-host/preloadCapabilities.ts`
- [x] T027 [P] [US3] Implement desktop lifecycle event bridge in `app/features/desktop-host/lifecycleEvents.ts`
- [x] T028 [P] [US3] Implement backend process lifecycle controller in `app/features/desktop-host/backendLifecycle.ts`
- [x] T029 [US3] Enforce capability boundary assertions in `app/features/desktop-host/preload.ts`
- [x] T030 [US3] Move desktop-only orchestration out of renderer modules into `app/features/desktop-host/orchestrator.ts`
- [x] T031 [US3] Add host boundary diagnostic logging for invalid capability access in `app/features/desktop-host/diagnostics.ts`

**Checkpoint**: main/preload는 host adapter 역할만 수행하고 renderer/backend 도메인 경계 침범이 없다.

---

## Phase 6: User Story 4 - Next.js Secondary Surface 강등 (Priority: P2)

**Goal**: Next.js를 optional compatibility adapter로 유지하되 primary authoring runtime 의존성을 제거한다.

**Independent Test**: Next.js surface 비가동 상태에서도 desktop authoring 흐름이 유지되고, Next.js surface는 desktop과 동일 logical RPC contract를 소비한다.

### Implementation for User Story 4

- [x] T032 [US4] Implement web RPC adapter using canonical logical methods in `app/features/host/rpc/webAdapter.ts`
- [x] T033 [P] [US4] Implement desktop RPC adapter using canonical logical methods in `app/features/host/rpc/desktopAdapter.ts`
- [x] T034 [US4] Align Next.js API route handlers to compatibility adapter role in `app/app/api/files/route.ts`, `app/app/api/file-tree/route.ts`, and `app/app/api/render/route.ts`
- [x] T035 [US4] Add explicit secondary-surface boundary notes in `docs/features/electron-desktop-host/README.md`
- [x] T036 [US4] Add adapter parity checklist for desktop/web method sets in `specs/010-electron-desktop-host/quickstart.md`

**Checkpoint**: Next.js는 secondary adapter 역할로 제한되고 desktop primary path와 contract parity가 유지된다.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: 문서/검증 경로를 마무리하고 implementation handoff 상태를 확정한다.

- [x] T037 [P] Update architecture decision alignment notes in `docs/adr/ADR-0010-electron-primary-host-and-nextjs-de-emphasis.md`
- [x] T038 [P] Update feature quickstart verification commands in `specs/010-electron-desktop-host/quickstart.md`
- [x] T039 Run `bun run typecheck:app` and capture output summary in `specs/010-electron-desktop-host/quickstart.md`
- [x] T040 Run `bun test app/components/editor/WorkspaceClient.test.tsx scripts/dev/app-dev.test.ts` and capture output summary in `specs/010-electron-desktop-host/quickstart.md`
- [x] T041 Add explicit guardrail note for RPC logical contract non-redesign scope in `specs/010-electron-desktop-host/quickstart.md`
- [x] T042 Add explicit guardrail note for optional web surface retention in `specs/010-electron-desktop-host/quickstart.md`
- [x] T043 Add explicit guardrail note for persistence scope exclusion in `specs/010-electron-desktop-host/quickstart.md`
- [x] T044 Add explicit guardrail note for auto-update/code-signing scope exclusion in `specs/010-electron-desktop-host/quickstart.md`
- [x] T045 Run desktop cold-start smoke and capture absence of Next.js route compile logs in `specs/010-electron-desktop-host/quickstart.md`
- [x] T046 Run desktop/web RPC method parity check and capture results in `specs/010-electron-desktop-host/quickstart.md`
- [x] T047 Run preload capability surface audit checklist and capture results in `specs/010-electron-desktop-host/quickstart.md`
- [x] T048 Run desktop dev loop with Next.js dev server intentionally stopped and capture results in `specs/010-electron-desktop-host/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: 즉시 시작 가능
- **Phase 2 (Foundational)**: Phase 1 완료 후 진행, 모든 스토리 공통 선행 조건
- **Phase 3 (US1)**: Foundational 완료 후 진행, MVP 경로
- **Phase 4 (US2)**: Foundational 완료 후 진행, US1과 병행 가능하지만 renderer wiring 충돌 시 US1 이후 권장
- **Phase 5 (US3)**: US1 기반 desktop host 파일이 준비된 뒤 진행
- **Phase 6 (US4)**: US2/US3 이후 진행, adapter parity 정렬 단계
- **Phase 7 (Polish)**: 모든 목표 스토리 완료 후 실행

### User Story Dependencies

- **US1 (P1)**: Foundational 이후 독립 시작 가능
- **US2 (P1)**: Foundational 이후 독립 시작 가능, `WorkspaceClient.tsx` 수정 충돌 회피를 위해 US1와 조율 필요
- **US3 (P2)**: US1 desktop host bootstrap 아키텍처 의존
- **US4 (P2)**: US2 renderer adapter 전환 + US3 capability 경계 정착 이후 진행

### Within Each User Story

- 계약/인터페이스 정리 후 엔트리 wiring을 수행한다.
- host 경계 파일 수정 후 consumer(WorkspaceClient/Next.js route) 연결을 수행한다.
- 각 스토리는 독립 테스트 기준을 먼저 만족한 뒤 다음 스토리로 진행한다.

### Parallel Opportunities

- Setup의 `T002`, `T003`, `T004`는 `T001` 이후 병렬 가능
- Foundational의 `T006`, `T007`, `T008`, `T009`는 `T005` 이후 병렬 가능
- US1의 `T012`, `T013` 병렬 가능
- US2의 `T019`, `T022`, `T023` 병렬 가능
- US3의 `T027`, `T028` 병렬 가능
- US4의 `T033`은 `T032`과 병렬 준비 가능
- Polish의 `T037`, `T038` 병렬 가능

---

## Parallel Example: User Story 2

```bash
Task: "T019 [US2] Introduce renderer-facing host capability interface in app/features/host/renderer/hostCapabilities.ts"
Task: "T022 [US2] Replace chat API usage with RPC client interface in app/store/chat.ts"
Task: "T023 [US2] Replace sidebar file-tree API usage with RPC client interface in app/components/ui/Sidebar.tsx"
```

## Parallel Example: User Story 3

```bash
Task: "T027 [US3] Implement desktop lifecycle event bridge in app/features/desktop-host/lifecycleEvents.ts"
Task: "T028 [US3] Implement backend process lifecycle controller in app/features/desktop-host/backendLifecycle.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1~2 완료
2. US1 desktop direct startup path 구현
3. desktop authoring 진입 독립 검증 후 MVP 판정

### Incremental Delivery

1. US1: desktop direct entry path
2. US2: renderer host-neutralization and `/api/*` dependency removal
3. US3: capability-limited preload and lifecycle ownership separation
4. US4: Next.js secondary adapter alignment and parity completion
5. Polish: 검증 결과/문서 정리

### Parallel Team Strategy

1. Worker A: `app/features/host/contracts/*` + `app/features/host/rpc/*`
2. Worker B: `app/features/desktop-host/{main,preload,orchestrator}.ts`
3. Worker C: `app/components/editor/WorkspaceClient.tsx` + `app/store/chat.ts`
4. Worker D: `app/app/page.tsx` + `app/app/api/*/route.ts`
5. Worker E: `scripts/dev/desktop-dev.ts` + verification/docs sync

---

## Notes

- 전체 작업 수: 48
- US1 작업 수: 7
- US2 작업 수: 8
- US3 작업 수: 6
- US4 작업 수: 5
- 병렬 가능 작업 수: 16
- Suggested MVP scope: Phase 1~3 (US1)
