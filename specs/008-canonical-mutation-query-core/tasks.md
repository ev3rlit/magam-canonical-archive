# Tasks: Canonical Mutation Query Core

**Input**: Design documents from `/Users/danghamo/Documents/gituhb/magam-feature-canonical-mutation-query-core/specs/008-canonical-mutation-query-core/`  
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`

**Tests**: 포함. 이 feature는 deterministic replay, explicit validation failure, concurrency conflict를 핵심 완료 기준으로 가지므로 story별 회귀 테스트 태스크를 포함한다.

**Organization**: 작업은 사용자 스토리별로 묶어 독립 구현/검증이 가능하도록 구성한다.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 서로 다른 파일을 다루며 선행 미완료 의존성이 없는 병렬 가능 작업
- **[Story]**: 해당 작업이 속한 사용자 스토리 (`US1`~`US4`)
- 모든 작업은 정확한 파일 경로를 포함한다.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: canonical mutation/query core 모듈과 문서/검증 베이스를 준비한다.

- [X] T001 Create module directory and barrel exports in `libs/shared/src/lib/canonical-mutation-query/index.ts`
- [X] T002 [P] Create base contract skeleton in `libs/shared/src/lib/canonical-mutation-query/contracts.ts`
- [X] T003 [P] Create base error code mapping in `libs/shared/src/lib/canonical-mutation-query/errors.ts`
- [X] T004 [P] Add initial module smoke spec in `libs/shared/src/lib/canonical-mutation-query/index.spec.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 모든 사용자 스토리에 공통으로 필요한 persistence/query/mutation 기반을 먼저 잠근다.

**⚠️ CRITICAL**: 이 단계가 끝나기 전에는 사용자 스토리 구현을 시작하지 않는다.

- [X] T005 Extend canonical persistence records for query/mutation envelopes in `libs/shared/src/lib/canonical-persistence/records.ts`
- [X] T006 [P] Extend repository primitives for filtered object query and surface load in `libs/shared/src/lib/canonical-persistence/repository.ts`
- [X] T007 [P] Add repository regression coverage for new query primitives in `libs/shared/src/lib/canonical-persistence/repository.spec.ts`
- [X] T008 Add revision-token conflict helper primitives in `libs/shared/src/lib/canonical-persistence/repository.ts`
- [X] T009 [P] Add shared validator helpers for capability/content/block constraints in `libs/shared/src/lib/canonical-mutation-query/validators.ts`
- [X] T010 [P] Add validator regression coverage in `libs/shared/src/lib/canonical-mutation-query/validators.spec.ts`

**Checkpoint**: query/mutation core가 의존할 persistence/query/validator 기반이 준비된다.

---

## Phase 3: User Story 1 - Shared Canonical Mutation Surface (Priority: P1) 🎯 MVP

**Goal**: UI/AI가 같은 mutation executor와 validation 규칙을 재사용하도록 canonical mutation surface를 고정한다.

**Independent Test**: 동일 mutation intent를 두 경로로 실행했을 때 결과 envelope와 validation code가 동일하다.

### Tests for User Story 1

- [X] T011 [P] [US1] Add mutation executor deterministic replay tests in `libs/shared/src/lib/canonical-mutation-query/mutation-executor.spec.ts`
- [X] T012 [P] [US1] Add validation-failure envelope tests in `libs/shared/src/lib/canonical-mutation-query/mutation-executor.spec.ts`

### Implementation for User Story 1

- [X] T013 [US1] Implement mutation operation union and envelope types in `libs/shared/src/lib/canonical-mutation-query/contracts.ts`
- [X] T014 [US1] Implement mutation executor orchestration in `libs/shared/src/lib/canonical-mutation-query/mutation-executor.ts`
- [X] T015 [US1] Implement structured failure mapping in `libs/shared/src/lib/canonical-mutation-query/errors.ts`
- [X] T016 [US1] Route object/relation/canvas operations through repository primitives in `libs/shared/src/lib/canonical-mutation-query/mutation-executor.ts`
- [X] T017 [US1] Integrate executor into WS update/create/reparent/remove handlers in `app/ws/methods.ts`
- [X] T018 [US1] Keep WS response compatibility (`commandId`, envelope shape) in `app/ws/methods.ts`

**Checkpoint**: User Story 1 완료 시 canonical mutation executor가 WS adapter에서 실제 실행 경로가 된다.

---

## Phase 4: User Story 2 - Partial Query and Surface Load (Priority: P1)

**Goal**: canonical filter + partial read 계약으로 필요한 데이터만 조회하는 query service를 제공한다.

**Independent Test**: include/filter/cursor/bounds 조합으로 요청한 subset만 반환되고, 지원되지 않는 include 요청은 부분 성공 없이 거부된다.

### Tests for User Story 2

- [X] T019 [P] [US2] Add query include/filter and unsupported-include rejection regression tests in `libs/shared/src/lib/canonical-mutation-query/query-service.spec.ts`
- [X] T020 [P] [US2] Add surface-load read-model regression tests in `libs/shared/src/lib/canonical-mutation-query/query-service.spec.ts`

### Implementation for User Story 2

- [X] T021 [US2] Implement query request/result contracts in `libs/shared/src/lib/canonical-mutation-query/contracts.ts`
- [X] T022 [US2] Implement canonical filter + pagination validation and unsupported-include rejection in `libs/shared/src/lib/canonical-mutation-query/validators.ts`
- [X] T023 [US2] Implement query service with include/limit/cursor/bounds in `libs/shared/src/lib/canonical-mutation-query/query-service.ts`
- [X] T024 [US2] Implement document/surface load read-model join in `libs/shared/src/lib/canonical-mutation-query/query-service.ts`
- [X] T025 [US2] Add WS query method adapter for canonical query envelope in `app/ws/methods.ts`

**Checkpoint**: User Story 2 완료 시 partial query contract가 UI/CLI adapter에서 공통으로 재사용 가능하다.

---

## Phase 5: User Story 3 - Note Body Block Mutation and Clone Safety (Priority: P1)

**Goal**: note body block mutation의 안정성과 clone-on-create safety를 mutation core에서 강제한다.

**Independent Test**: body block replace/insert/update/remove/reorder 및 clone safety 시나리오가 deterministic하게 통과한다.

### Tests for User Story 3

- [X] T026 [P] [US3] Add body block operation regression tests in `libs/shared/src/lib/canonical-mutation-query/mutation-executor.spec.ts`
- [X] T027 [P] [US3] Add clone-on-create enforcement tests in `libs/shared/src/lib/canonical-mutation-query/mutation-executor.spec.ts`
- [X] T028 [P] [US3] Add content-kind mismatch adapter tests in `app/ws/methods.test.ts`

### Implementation for User Story 3

- [X] T029 [US3] Implement block operation handlers with stable-id ordering in `libs/shared/src/lib/canonical-mutation-query/mutation-executor.ts`
- [X] T030 [US3] Recompute canonicalText/primaryContentKind after body operations in `libs/shared/src/lib/canonical-mutation-query/mutation-executor.ts`
- [X] T031 [US3] Enforce clone-vs-share mutation policy in `libs/shared/src/lib/canonical-mutation-query/mutation-executor.ts`
- [X] T032 [US3] Map body/capability/content violations to explicit failure codes in `libs/shared/src/lib/canonical-mutation-query/errors.ts`

**Checkpoint**: User Story 3 완료 시 note body mutation과 clone safety가 domain executor에서 강제된다.

---

## Phase 6: User Story 4 - Transport-Neutral Handoff and Concurrency (Priority: P2)

**Goal**: revision-token concurrency와 통일된 결과 envelope를 확정해 next slice가 그대로 소비할 수 있게 한다.

**Independent Test**: stale base revision은 conflict를 반환하고, missing base revision은 validation failure를 반환하며, 성공 시 revision/changed-set이 항상 포함된다.

### Tests for User Story 4

- [X] T033 [P] [US4] Add revision conflict and missing-base-revision regression tests in `libs/shared/src/lib/canonical-mutation-query/mutation-executor.spec.ts`
- [X] T034 [P] [US4] Add useFileSync revision-token retry regression tests in `app/hooks/useFileSync.test.ts`
- [X] T035 [P] [US4] Add WS conflict and invalid-base envelope regression tests in `app/ws/methods.test.ts`

### Implementation for User Story 4

- [X] T036 [US4] Implement revision conflict/append contract and missing-base-revision validation handling in `libs/shared/src/lib/canonical-mutation-query/mutation-executor.ts`
- [X] T037 [US4] Expose CLI-ready structured JSON result types in `libs/shared/src/lib/canonical-mutation-query/contracts.ts`
- [X] T038 [US4] Migrate WS `baseVersion` handling to revision-token semantics with explicit missing-base rejection in `app/ws/methods.ts`
- [X] T039 [US4] Align file-sync mutation queue metadata with revision-token contract in `app/hooks/useFileSync.shared.ts`
- [X] T040 [US4] Wire revision-token fields through sync hook transport params in `app/hooks/useFileSync.ts`

**Checkpoint**: User Story 4 완료 시 concurrency/response contract가 WS와 future CLI에서 공통으로 사용 가능하다.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: story 간 통합 검증과 문서 정합성을 마무리한다.

- [X] T041 [P] Refresh feature quickstart verification notes in `specs/008-canonical-mutation-query-core/quickstart.md`
- [X] T042 [P] Add cross-story regression cases in `libs/shared/src/lib/canonical-mutation-query/mutation-executor.spec.ts`
- [X] T043 Run focused verification commands listed in `specs/008-canonical-mutation-query-core/quickstart.md`
- [X] T044 [P] Add explicit out-of-scope guard checks for CLI UX/session/plugin runtime in `specs/008-canonical-mutation-query-core/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: 바로 시작 가능
- **Phase 2 (Foundational)**: Phase 1 완료 후 시작, 모든 사용자 스토리의 선행 조건
- **Phase 3 (US1)**: Phase 2 완료 후 시작, MVP
- **Phase 4 (US2)**: Phase 2 완료 후 시작, US1과 병렬 가능
- **Phase 5 (US3)**: Phase 3 완료 후 시작 (mutation core 의존)
- **Phase 6 (US4)**: Phase 3 완료 후 시작, US2/US3 결과와 통합
- **Phase 7 (Polish)**: 원하는 사용자 스토리 완료 후 진행

### User Story Dependencies

- **US1 (P1)**: Foundational 이후 즉시 시작, 독립 MVP
- **US2 (P1)**: Foundational 이후 시작 가능, US1과 병렬 가능
- **US3 (P1)**: US1 mutation core가 선행되어야 함
- **US4 (P2)**: US1 executor와 WS adapter가 선행되어야 함

### Within Each User Story

- 테스트 태스크를 먼저 추가해 실패/성공 기준을 고정한다.
- 계약 타입/validator를 먼저 고정한 뒤 service/executor를 구현한다.
- adapter 전환은 core executor/query service가 준비된 이후 수행한다.

### Parallel Opportunities

- Setup의 `T002`, `T003`, `T004`는 `T001` 이후 병렬 가능
- Foundational의 `T006`, `T007`, `T009`, `T010`은 `T005` 이후 병렬 가능
- US1의 `T011`, `T012`는 병렬 가능
- US2의 `T019`, `T020`는 병렬 가능
- US3의 `T026`, `T027`, `T028`은 병렬 가능
- US4의 `T033`, `T034`, `T035`는 병렬 가능

---

## Parallel Example: User Story 1

```bash
Task: "T011 [US1] Add mutation executor deterministic replay tests in libs/shared/src/lib/canonical-mutation-query/mutation-executor.spec.ts"
Task: "T012 [US1] Add validation-failure envelope tests in libs/shared/src/lib/canonical-mutation-query/mutation-executor.spec.ts"
```

## Parallel Example: User Story 2

```bash
Task: "T019 [US2] Add query include/filter regression tests in libs/shared/src/lib/canonical-mutation-query/query-service.spec.ts"
Task: "T020 [US2] Add surface-load read-model regression tests in libs/shared/src/lib/canonical-mutation-query/query-service.spec.ts"
```

## Parallel Example: User Story 4

```bash
Task: "T034 [US4] Add useFileSync revision-token retry regression tests in app/hooks/useFileSync.test.ts"
Task: "T035 [US4] Add WS conflict envelope regression tests in app/ws/methods.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1, Phase 2를 완료해 shared/persistence 기반을 잠근다.
2. US1을 완료해 canonical mutation executor를 WS adapter 경로에 연결한다.
3. deterministic replay + validation explicit failure를 확인하고 MVP로 검증한다.

### Incremental Delivery

1. Setup + Foundational 완료
2. US1으로 mutation 통합 경로 확보
3. US2로 partial query/read model 확보
4. US3로 note body block mutation/clone safety 확보
5. US4로 concurrency/transport handoff 완료
6. Polish에서 통합 검증

### Parallel Team Strategy

1. Foundation 이후
   - Worker A: `libs/shared/src/lib/canonical-mutation-query/query-service*`
   - Worker B: `libs/shared/src/lib/canonical-mutation-query/mutation-executor*`
   - Worker C: `app/ws/*` adapter
   - Worker D: `app/hooks/useFileSync*` concurrency queue
2. 공통 충돌 파일(`mutation-executor.ts`, `app/ws/methods.ts`)은 phase 내 순차 병합으로 조정한다.

---

## Notes

- 전체 작업 수: 44
- US1 작업 수: 8
- US2 작업 수: 7
- US3 작업 수: 7
- US4 작업 수: 8
- 병렬 가능 작업 수: 19
- Suggested MVP scope: Phase 1~3 (US1)
