# Tasks: Action Routing Bridge

**Input**: Design documents from `/Users/danghamo/Documents/gituhb/magam-feature-dbfcp-action-routing-bridge/specs/001-action-routing-bridge/`  
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`

**Tests**: 포함됨. 이 feature는 README와 spec에서 미등록 intent, invalid payload, optimistic rollback 검증을 완료 기준으로 요구하므로 story별 회귀 태스크를 포함한다.

**Organization**: 작업은 사용자 스토리별로 묶어서 각 스토리를 독립 구현/검증할 수 있게 구성한다.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 서로 다른 파일을 다루며 선행 미완료 의존성이 없는 병렬 가능 작업
- **[Story]**: 해당 작업이 속한 사용자 스토리 (`US1`~`US3`)
- 모든 작업은 정확한 파일 경로를 포함한다.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: bridge 작업에 필요한 폴더, fixture, 검증 공통 유틸을 준비한다.

- [X] T001 Create bridge module scaffold in `app/features/editing/actionRoutingBridge/types.ts`, `app/features/editing/actionRoutingBridge/registry.ts`, `app/features/editing/actionRoutingBridge/routeIntent.ts`, and `app/features/editing/actionRoutingBridge/optimistic.ts`
- [X] T002 [P] Create bridge fixture catalog in `app/features/editing/actionRoutingBridge/__fixtures__/intentEnvelopes.ts`
- [X] T003 [P] Create shared bridge assertion helpers in `app/features/editing/actionRoutingBridge/testUtils.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 모든 사용자 스토리보다 먼저 끝나야 하는 bridge contract, registry, error code 기반을 맞춘다.

**⚠️ CRITICAL**: 이 단계가 끝나기 전에는 어떤 surface 전환도 시작하지 않는다.

- [X] T004 Create bridge types for `UIIntentEnvelope`, `DispatchDescriptor`, `OrderedDispatchPlan`, and `BridgeError` in `app/features/editing/actionRoutingBridge/types.ts`
- [X] T005 [P] Implement registry loader and shared intent lookup rules in `app/features/editing/actionRoutingBridge/registry.ts`
- [X] T006 [P] Implement envelope-to-plan orchestration in `app/features/editing/actionRoutingBridge/routeIntent.ts`
- [X] T007 [P] Implement optimistic metadata helpers in `app/features/editing/actionRoutingBridge/optimistic.ts`
- [X] T008 [P] Add shared bridge error codes and result typing in `app/ws/rpc.ts`
- [X] T009 [P] Add foundational bridge regressions in `app/features/editing/actionRoutingBridge/routeIntent.test.ts`, `app/features/editing/actionRoutingBridge/registry.test.ts`, and `app/features/editing/actionRoutingBridge/optimistic.test.ts`

**Checkpoint**: bridge input/output contract, registry ownership, ordered dispatch, optimistic metadata, shared error codes가 고정된다.

---

## Phase 3: User Story 1 - Unified Routing Contract for All UI Entrypoints (Priority: P1) 🎯 MVP

**Goal**: 네 UI surface가 공통 envelope와 bridge 실행 경로만 사용하도록 전환한다.

**Independent Test**: `toolbar`, `selection-floating-menu`, `pane-context-menu`, `node-context-menu` 대표 intent를 실행했을 때 UI가 bridge API만 호출하고 direct mutation/query path를 만들지 않으면 된다.

### Tests for User Story 1

- [X] T010 [P] [US1] Add surface intent adoption regressions in `app/components/GraphCanvas.test.tsx` and `app/components/editor/WorkspaceClient.test.tsx`
- [X] T011 [P] [US1] Add bridge-to-ws execution regressions in `app/ws/methods.test.ts`

### Implementation for User Story 1

- [X] T012 [US1] Route toolbar intents through bridge adapters in `app/components/GraphCanvas.tsx` and `app/components/editor/WorkspaceClient.tsx`
- [X] T013 [US1] Route selection edit intents through bridge adapters in `app/components/ui/StickerInspector.tsx` and `app/components/editor/WorkspaceClient.tsx`
- [X] T014 [US1] Route pane context menu intents through bridge adapters in `app/components/GraphCanvas.tsx`
- [X] T015 [US1] Route node context menu intents through bridge adapters in `app/components/GraphCanvas.tsx`
- [X] T016 [US1] Centralize bridge execution and runtime lifecycle state in `app/features/editing/commands.ts`, `app/components/editor/WorkspaceClient.tsx`, and `app/store/graph.ts`

**Checkpoint**: User Story 1 완료 시 네 surface의 대표 intent가 bridge 단일 경로를 사용하고 direct write path fallback이 제거되어야 한다.

---

## Phase 4: User Story 2 - Intent Gating and Payload Normalization (Priority: P1)

**Goal**: intent 노출 조건과 payload normalization을 canonical metadata + selection context 기준으로 일관되게 고정한다.

**Independent Test**: 같은 intent를 다른 surface에서 실행했을 때 gating 결과와 canonical payload가 의미적으로 동일하면 된다.

### Tests for User Story 2

- [X] T017 [P] [US2] Add registry gating and normalization regressions in `app/features/editing/actionRoutingBridge/registry.test.ts` and `app/components/GraphCanvas.test.tsx`
- [X] T018 [P] [US2] Add cross-surface payload equivalence regressions in `app/features/editing/actionRoutingBridge/routeIntent.test.ts` and `app/components/editor/WorkspaceClient.test.tsx`

### Implementation for User Story 2

- [X] T019 [US2] Register create, rename, style-edit, and relation-create intents in `app/features/editing/actionRoutingBridge/registry.ts`
- [X] T020 [US2] Derive gating inputs from canonical metadata and selection context in `app/features/editing/actionRoutingBridge/registry.ts`, `app/features/editing/editability.ts`, and `app/features/editing/capabilityProfile.ts`
- [X] T021 [US2] Normalize selection, pane, and node raw payloads in `app/features/editing/actionRoutingBridge/registry.ts` and `app/components/GraphCanvas.tsx`
- [X] T022 [US2] Build ordered dispatch plans for multi-step intents in `app/features/editing/actionRoutingBridge/routeIntent.ts`, `app/features/editing/commands.ts`, and `app/ws/methods.test.ts`

**Checkpoint**: User Story 2 완료 시 renderer/tag 이름 기반 신규 분기 없이 canonical metadata 기반 gating과 ordered dispatch normalization이 작동해야 한다.

---

## Phase 5: User Story 3 - Optimistic and Rollback Reliability (Priority: P2)

**Goal**: optimistic 처리와 rollback이 bridge descriptor에 결합되고 실패가 canonical 오류 계약 그대로 surface에 전달되게 만든다.

**Independent Test**: validation failure, version conflict, 미등록 intent를 각각 유발했을 때 pending 상태 정리, rollback, 오류 표면화가 일관되면 된다.

### Tests for User Story 3

- [X] T023 [P] [US3] Add optimistic lifecycle regressions in `app/features/editing/actionRoutingBridge/optimistic.test.ts`, `app/store/graph.test.ts`, and `app/hooks/useFileSync.test.ts`
- [X] T024 [P] [US3] Add invalid payload, unregistered intent, and rollback regressions in `app/features/editing/actionRoutingBridge/routeIntent.test.ts` and `app/ws/methods.test.ts`

### Implementation for User Story 3

- [X] T025 [US3] Attach `baseVersion`, pending key, and rollback metadata in `app/features/editing/actionRoutingBridge/optimistic.ts` and `app/features/editing/actionRoutingBridge/routeIntent.ts`
- [X] T026 [US3] Connect optimistic pending lifecycle to runtime state in `app/store/graph.ts` and `app/components/editor/WorkspaceClient.tsx`
- [X] T027 [US3] Preserve canonical error propagation and rollback execution in `app/components/editor/workspaceEditUtils.ts`, `app/components/editor/WorkspaceClient.tsx`, and `app/ws/rpc.ts`
- [X] T028 [US3] Remove remaining success-shaped fallbacks from bridge-routed UI surface execution in `app/components/GraphCanvas.tsx` and `app/components/editor/WorkspaceClient.tsx`

**Checkpoint**: User Story 3 완료 시 optimistic failure와 validation failure가 모두 explicit error + rollback path로 종료되어야 한다.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: 문서 정합성, direct path 제거 확인, quickstart 기반 검증을 마무리한다.

- [X] T029 [P] Refresh feature verification notes in `specs/001-action-routing-bridge/quickstart.md`
- [X] T030 [P] Audit and remove obsolete direct intent helpers in `app/components/editor/workspaceEditUtils.ts` and `app/components/editor/WorkspaceClient.tsx`
- [X] T031 Run bridge-focused verification gates documented in `specs/001-action-routing-bridge/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: 바로 시작 가능
- **Phase 2 (Foundational)**: Phase 1 완료 후 진행, 모든 사용자 스토리의 선행 조건
- **Phase 3 (US1)**: Phase 2 완료 후 시작, MVP
- **Phase 4 (US2)**: US1의 공통 bridge 경로 위에서 진행
- **Phase 5 (US3)**: US1~US2의 plan/registry/metadata 경로 위에서 진행
- **Phase 6 (Polish)**: 선택 스토리 완료 후 통합 검증

### User Story Dependencies

- **US1 (P1)**: Foundational 이후 즉시 시작, 독립 MVP
- **US2 (P1)**: US1의 단일 bridge 호출 경로 의존
- **US3 (P2)**: US1~US2의 ordered dispatch와 runtime state 연결 의존

### Within Each User Story

- 테스트 태스크를 먼저 작성해 회귀 기준을 고정한다.
- bridge 모듈 변경 다음에 UI surface 연결을 수행한다.
- ws/rpc 태스크는 bridge output contract가 고정된 뒤 수행한다.

### Parallel Opportunities

- Setup의 `T002`, `T003`은 `T001` 이후 병렬 가능
- Foundational의 `T005`, `T006`, `T007`, `T008`, `T009`는 `T004` 이후 병렬 가능
- US1의 `T010`, `T011`은 병렬 가능
- US2의 `T017`, `T018`은 병렬 가능
- US3의 `T023`, `T024`은 병렬 가능
- Polish의 `T029`, `T030`는 병렬 가능

---

## Parallel Example: User Story 1

```bash
Task: "T010 [US1] Add surface adoption regressions in app/components/GraphCanvas.test.tsx and app/components/editor/WorkspaceClient.test.tsx"
Task: "T011 [US1] Add bridge-to-ws execution regressions in app/ws/methods.test.ts"
```

## Parallel Example: User Story 2

```bash
Task: "T017 [US2] Add registry gating and normalization regressions in app/features/editing/actionRoutingBridge/registry.test.ts and app/components/GraphCanvas.test.tsx"
Task: "T018 [US2] Add cross-surface payload equivalence regressions in app/components/editor/WorkspaceClient.test.tsx"
```

## Parallel Example: User Story 3

```bash
Task: "T023 [US3] Add optimistic lifecycle regressions in app/features/editing/actionRoutingBridge/optimistic.test.ts, app/store/graph.test.ts, and app/hooks/useFileSync.test.ts"
Task: "T024 [US3] Add invalid payload, unregistered intent, and rollback regressions in app/ws/filePatcher.test.ts and app/ws/methods.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1과 Phase 2로 bridge contract, registry, optimistic metadata 기반을 고정한다.
2. User Story 1에서 네 surface를 bridge 단일 경로로 전환한다.
3. US1 회귀를 통과한 상태를 MVP로 본다.

### Incremental Delivery

1. Setup + Foundational 완료 후 bridge 기반을 고정한다.
2. US1을 추가해 direct write path를 제거한다.
3. US2를 추가해 gating과 payload normalization을 canonical metadata 중심으로 맞춘다.
4. US3를 추가해 optimistic/rollback과 오류 전파를 마무리한다.
5. 마지막으로 quickstart 검증과 cleanup을 수행한다.

### Parallel Team Strategy

1. Foundation 단계에서는
   - Worker A: `types.ts`, `registry.ts`
   - Worker B: `routeIntent.ts`, `optimistic.ts`
   - Worker C: `app/ws/rpc.ts` + 회귀 테스트
2. 이후에는
   - Worker A: `app/components/{GraphCanvas,FloatingToolbar,ContextMenu}.tsx`
   - Worker B: `app/components/editor/{WorkspaceClient.tsx,workspaceEditUtils.ts}`
   - Worker C: `app/features/editing/{commands,editability,capabilityProfile}.ts`
   - Worker D: `app/ws/{methods.ts,filePatcher.ts}` + 관련 테스트
3. `app/store/graph.ts`, `app/ws/methods.ts`, `app/components/editor/WorkspaceClient.tsx`는 phase 내 순차 merge를 전제로 한다.

---

## Notes

- 전체 작업 수: 31
- US1 작업 수: 7
- US2 작업 수: 6
- US3 작업 수: 6
- 병렬 가능 작업 수: 15
- Suggested MVP scope: Phase 1~3 (US1)
- 모든 태스크는 체크리스트 포맷과 exact file path 요구를 충족한다.
