# Tasks: Action Routing Bridge

**Input**: Design documents from `/Users/danghamo/Documents/gituhb/magam-feature-dbfcp-selection-floating-menu/specs/008-action-routing-bridge/`  
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`

**Tests**: 포함됨. 이 스펙은 intent 매핑 정확도, explicit error, rollback 일관성, direct write path 제거를 정량 기준으로 요구하므로 스토리별 테스트 태스크를 포함한다.

**Organization**: 작업은 사용자 스토리별로 묶어 각 스토리를 독립적으로 구현/검증 가능하게 구성한다.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 서로 다른 파일을 다루며 선행 미완료 의존성이 없는 병렬 가능 작업
- **[Story]**: 해당 작업이 속한 사용자 스토리 (`US1`~`US3`)
- 모든 작업은 정확한 파일 경로를 포함한다.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: bridge feature의 공통 타입/fixture/테스트 기반을 준비한다.

- [X] T001 Create action-routing bridge fixtures in `app/features/editing/__fixtures__/actionRoutingBridgeFixtures.ts`
- [X] T002 [P] Create bridge test utils in `app/features/editing/actionRoutingBridgeTestUtils.ts`
- [X] T003 [P] Create bridge error code constants in `app/features/editing/actionRoutingErrors.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 모든 사용자 스토리의 선행 조건인 catalog/contract/recipe 기반을 고정한다.

**⚠️ CRITICAL**: 이 단계가 끝나기 전에는 사용자 스토리 구현을 시작하지 않는다.

- [X] T004 Create bridge request/response and lifecycle types in `app/features/editing/actionRoutingBridge.types.ts`
- [X] T005 [P] Create intent catalog definition and lookup in `app/features/editing/actionIntentCatalog.ts`
- [X] T006 [P] Create dispatch recipe registry in `app/features/editing/actionDispatchRecipes.ts`
- [X] T007 [P] Create payload normalization helpers in `app/features/editing/actionPayloadNormalizer.ts`
- [X] T008 [P] Create metadata-based gating helpers in `app/features/editing/actionGating.ts`
- [X] T009 [P] Add foundational bridge unit tests in `app/features/editing/actionRoutingBridge.test.ts`

**Checkpoint**: catalog/recipe/normalizer/gating 계약이 고정되어 스토리 구현이 가능해야 한다.

---

## Phase 3: User Story 1 - UI Intent 공통 라우팅 정착 (Priority: P1) 🎯 MVP

**Goal**: 4개 entrypoint surface intent를 bridge dispatch API로 수렴시켜 canonical action 매핑을 통일한다.

**Independent Test**: create/rename/style/add-child 대표 intent를 각 surface에서 실행했을 때 bridge가 정의된 recipe를 생성하면 독립 검증 가능하다.

### Tests for User Story 1

- [X] T010 [P] [US1] Add intent-to-recipe mapping regressions in `app/features/editing/actionRoutingBridge.test.ts`
- [X] T011 [P] [US1] Add surface dispatch integration tests in `app/components/GraphCanvas.test.tsx` and `app/components/editor/WorkspaceClient.test.tsx`

### Implementation for User Story 1

- [X] T012 [US1] Implement bridge dispatch entry function in `app/features/editing/actionRoutingBridge.ts`
- [X] T013 [US1] Integrate bridge dispatch into toolbar create flow in `app/components/GraphCanvas.tsx`
- [X] T014 [US1] Integrate bridge dispatch into pane/node context menu triggers in `app/components/GraphCanvas.tsx`
- [X] T015 [US1] Route create/rename/add-child command builder reuse through bridge in `app/features/editing/actionRoutingBridge.ts`

**Checkpoint**: User Story 1 완료 시 4개 surface의 대표 write intent가 bridge-only 경로를 사용해야 한다.

---

## Phase 4: User Story 2 - Payload 정규화와 실행 가능성 게이팅 (Priority: P1)

**Goal**: canonical id/reference 정규화와 semantic/capability 기반 gating을 강제해 invalid intent 실행을 차단한다.

**Independent Test**: metadata가 같은 alias는 같은 게이팅 결과를 내고, 위반 payload는 명시적 오류를 반환하면 독립 검증 가능하다.

### Tests for User Story 2

- [X] T016 [P] [US2] Add normalization failure and invalid payload tests in `app/features/editing/actionRoutingBridge.test.ts`
- [X] T017 [P] [US2] Add gating regressions for semantic/capability checks in `app/features/editing/editability.ts` and `app/features/editing/actionGating.test.ts`
- [X] T018 [P] [US2] Add ws error contract regression tests in `app/ws/filePatcher.test.ts` and `app/ws/methods.test.ts`

### Implementation for User Story 2

- [X] T019 [US2] Implement strict canonical id/relation normalization in `app/features/editing/actionPayloadNormalizer.ts`
- [X] T020 [US2] Implement semanticRole/primaryContentKind/capability gating in `app/features/editing/actionGating.ts`
- [X] T021 [US2] Connect bridge error mapping to ws error codes in `app/ws/rpc.ts` and `app/components/editor/workspaceEditUtils.ts`
- [X] T022 [US2] Remove alias-name based action gating branches in canonical bridge gating path via `app/components/editor/workspaceEditUtils.ts`, `app/features/editing/editability.ts`, and `app/features/editing/capabilityProfile.ts`

**Checkpoint**: User Story 2 완료 시 invalid intent는 silent fallback 없이 명시적으로 실패해야 한다.

---

## Phase 5: User Story 3 - Optimistic/Rollback 공통 라이프사이클 연결 (Priority: P2)

**Goal**: bridge가 optimistic apply/commit/reject 이벤트를 공통 발행하고 ui-runtime-state가 pending state를 단일 관리하도록 정리한다.

**Independent Test**: 복합 intent 성공/실패 모두에서 token과 lifecycle 이벤트가 누락 없이 기록되면 독립 검증 가능하다.

### Tests for User Story 3

- [X] T023 [P] [US3] Add optimistic lifecycle unit tests in `app/features/editing/actionRoutingBridge.test.ts`
- [X] T024 [P] [US3] Add rollback consistency integration tests in `app/store/graph.test.ts` and `app/components/editor/WorkspaceClient.test.tsx`
- [X] T025 [P] [US3] Add composite-intent failure rollback tests in `app/ws/methods.test.ts`

### Implementation for User Story 3

- [X] T026 [US3] Implement optimistic event emitter and token lifecycle in `app/features/editing/actionOptimisticLifecycle.ts`
- [X] T027 [US3] Wire bridge dispatch with optimistic apply/commit/reject in `app/features/editing/actionRoutingBridge.ts`
- [X] T028 [US3] Connect ui-runtime-state pending synchronization in `app/components/editor/WorkspaceClient.tsx` and `app/store/graph.ts`
- [X] T029 [US3] Enforce intent-scoped rollback diagnostics in `app/ws/methods.ts` and `app/ws/filePatcher.ts`

**Checkpoint**: User Story 3 완료 시 reject/rollback 이벤트 누락 없이 pending state가 정리되어야 한다.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: 문서/정합성/회귀 게이트를 마무리한다.

- [X] T030 [P] Add direct-write-path detection checks in `app/features/editing/actionRoutingBridge.test.ts` and `app/components/GraphCanvas.test.tsx`
- [X] T031 [P] Align quickstart and implementation notes with final implementation in `specs/008-action-routing-bridge/quickstart.md` and `specs/008-action-routing-bridge/plan.md`
- [X] T032 Run focused regression suite from `specs/008-action-routing-bridge/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: 바로 시작 가능
- **Phase 2 (Foundational)**: Phase 1 완료 후 진행, 모든 사용자 스토리의 선행 조건
- **Phase 3 (US1)**: Phase 2 완료 후 시작, MVP
- **Phase 4 (US2)**: US1 bridge 경유 경로 위에서 정규화/게이팅을 강화
- **Phase 5 (US3)**: US1~US2 기반 위에서 optimistic/rollback 공통화
- **Phase 6 (Polish)**: 선택한 스토리 완료 후 진행

### User Story Dependencies

- **US1 (P1)**: Foundational 이후 즉시 시작 가능
- **US2 (P1)**: US1 bridge 통합 경로 의존
- **US3 (P2)**: US1/US2의 dispatch 및 오류 계약 의존

### Within Each User Story

- 테스트 태스크를 먼저 작성해 회귀 기준을 고정한다.
- 타입/normalizer/gating 같은 계약 태스크를 먼저 반영한다.
- UI 통합은 bridge core 안정화 이후 적용한다.
- ws 재검증은 해당 story의 client 계약 반영 직후 수행한다.

### Parallel Opportunities

- Setup의 `T002`, `T003`은 `T001` 이후 병렬 가능
- Foundational의 `T005`~`T009`는 `T004` 이후 병렬 가능
- US1의 `T010`, `T011`은 병렬 가능
- US2의 `T016`, `T017`, `T018`은 병렬 가능
- US3의 `T023`, `T024`, `T025`는 병렬 가능
- Polish의 `T030`, `T031`은 병렬 가능

---

## Parallel Example: User Story 1

```bash
Task: "T010 [US1] Add intent-to-recipe mapping regressions in app/features/editing/actionRoutingBridge.test.ts"
Task: "T011 [US1] Add surface dispatch integration tests in app/components/GraphCanvas.test.tsx and app/components/editor/WorkspaceClient.test.tsx"
```

## Parallel Example: User Story 2

```bash
Task: "T016 [US2] Add normalization failure and invalid payload tests in app/features/editing/actionRoutingBridge.test.ts"
Task: "T018 [US2] Add ws error contract regression tests in app/ws/filePatcher.test.ts and app/ws/methods.test.ts"
```

## Parallel Example: User Story 3

```bash
Task: "T023 [US3] Add optimistic lifecycle unit tests in app/features/editing/actionRoutingBridge.test.ts"
Task: "T025 [US3] Add composite-intent failure rollback tests in app/ws/methods.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1~2로 catalog/recipe/normalizer/gating 계약을 고정한다.
2. US1으로 4개 surface의 bridge dispatch 경로를 통합한다.
3. US1 독립 검증 통과 시 MVP로 간주한다.

### Incremental Delivery

1. Setup + Foundational 완료 후 bridge skeleton을 안정화한다.
2. US1로 통합 라우팅을 적용한다.
3. US2로 strict normalization/gating 및 explicit error를 강화한다.
4. US3로 optimistic/rollback lifecycle을 공통화한다.
5. 마지막으로 direct write path 검출과 문서 정합성을 마무리한다.

### Parallel Team Strategy

1. Foundation 단계에서
   - Worker A: catalog/recipe
   - Worker B: normalizer/gating
   - Worker C: error codes/test utils
2. 스토리 단계에서
   - Worker A: `app/features/editing/*`
   - Worker B: `app/components/*`, `app/components/editor/*`
   - Worker C: `app/ws/*`
3. 충돌 위험 파일(`commands.ts`, `WorkspaceClient.tsx`, `methods.ts`)은 phase 내 순차 merge를 전제로 한다.

---

## Notes

- 전체 작업 수: 32
- US1 작업 수: 6
- US2 작업 수: 7
- US3 작업 수: 7
- 병렬 가능 작업 수: 15
- Suggested MVP scope: Phase 1~3 (US1)
