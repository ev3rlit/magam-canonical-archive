# Tasks: Overlay Host

**Input**: Design documents from `/Users/danghamo/Documents/gituhb/magam-feature-dbfcp-overlay-host/specs/009-overlay-host/`  
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`

**Tests**: 포함됨. 이 feature는 dismiss/focus/positioning 회귀 리스크가 높고 스토리별 독립 검증 조건이 명시되어 있어 테스트 태스크를 포함한다.

**Organization**: 작업은 사용자 스토리별로 구성해 각 스토리를 독립적으로 구현/검증 가능하게 유지한다.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 서로 다른 파일을 다루며 선행 미완료 의존성이 없는 병렬 가능 작업
- **[Story]**: 해당 작업이 속한 사용자 스토리 (`US1`~`US4`)
- 모든 작업은 구체적인 파일 경로를 포함한다.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: overlay host 구현을 위한 모듈/테스트 뼈대를 준비한다.

- [X] T001 Create overlay host module scaffold in `app/features/overlay-host/index.ts`
- [X] T002 [P] Create host type definitions in `app/features/overlay-host/types.ts`
- [X] T003 [P] Create overlay host test helpers in `app/features/overlay-host/testUtils.ts`
- [X] T004 [P] Add overlay layer constants baseline in `app/features/overlay-host/layers.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 모든 사용자 스토리가 공통으로 의존하는 host state/lifecycle/positioning 기반을 먼저 고정한다.

**⚠️ CRITICAL**: 이 단계가 완료되기 전에는 사용자 스토리 구현을 시작하지 않는다.

- [X] T005 Implement overlay host state model and reducer in `app/features/overlay-host/state.ts`
- [X] T006 [P] Implement overlay lifecycle commands (`open/close/replace`) in `app/features/overlay-host/commands.ts`
- [X] T007 [P] Implement dismiss reason and focus policy handlers in `app/features/overlay-host/lifecycle.ts`
- [X] T008 [P] Implement anchor resolver and boundary clamp logic in `app/features/overlay-host/positioning.ts`
- [X] T009 [P] Implement host provider/context hook in `app/features/overlay-host/context.tsx`
- [X] T010 [P] Add foundational unit tests for state and commands in `app/features/overlay-host/state.test.ts`
- [X] T011 [P] Add foundational unit tests for positioning and lifecycle in `app/features/overlay-host/positioning.test.ts` and `app/features/overlay-host/lifecycle.test.ts`

**Checkpoint**: 공통 host contract와 핵심 알고리즘(state/lifecycle/positioning)이 테스트 가능한 단위로 준비된다.

---

## Phase 3: User Story 1 - 공통 Overlay Host 계약 고정 (Priority: P1) 🎯 MVP

**Goal**: canvas entrypoint 4개 surface가 동일 host contract를 사용하도록 전환한다.

**Independent Test**: host provider가 없는 경로에서는 overlay가 열리지 않고, provider 경로에서는 slot contribution 기반으로만 열리는지 검증한다.

### Tests for User Story 1

- [X] T012 [P] [US1] Add host integration tests, including slot-only surface registration coverage, in `app/features/overlay-host/context.test.tsx`
- [X] T013 [P] [US1] Add GraphCanvas host wiring regression in `app/components/GraphCanvas.test.tsx`

### Implementation for User Story 1

- [X] T014 [US1] Mount OverlayHostProvider at canvas shell in `app/components/GraphCanvas.tsx`
- [X] T015 [US1] Introduce slot contribution registry in `app/features/overlay-host/slots.ts`
- [X] T016 [US1] Adapt `ContextMenu` to consume host slot rendering shell in `app/components/ContextMenu.tsx`
- [X] T017 [US1] Keep pane/node menu open adapter thin and host-driven in `app/hooks/useContextMenu.ts`
- [X] T018 [US1] Export canonical host API surface in `app/features/overlay-host/index.ts`

**Checkpoint**: overlay open path가 surface별 portal/listener가 아니라 host contract를 통과한다.

---

## Phase 4: User Story 2 - Dismiss/Focus 일관성 확보 (Priority: P1)

**Goal**: outside pointer, Escape, selection/context 전환에서 dismiss reason과 focus lifecycle을 공통 정책으로 맞춘다.

**Independent Test**: pane/node/floating 메뉴에서 dismiss reason과 focus restore 동작이 동일 규칙으로 기록/복원되는지 검증한다.

### Tests for User Story 2

- [X] T019 [P] [US2] Add dismiss reason regression tests in `app/features/overlay-host/lifecycle.test.ts`
- [X] T020 [P] [US2] Add keyboard/pointer dismiss regression in `app/components/GraphCanvas.test.tsx`
- [X] T021 [P] [US2] Add focus restore regression in `app/components/editor/WorkspaceClient.test.tsx`

### Implementation for User Story 2

- [X] T022 [US2] Wire outside pointer and Escape handling into host lifecycle in `app/features/overlay-host/lifecycle.ts`
- [X] T023 [US2] Apply open focus and close restore policies in `app/components/ContextMenu.tsx`
- [X] T024 [US2] Propagate structured dismiss reasons through menu adapter in `app/hooks/useContextMenu.ts`
- [X] T025 [US2] Add selection-change driven close integration in `app/components/GraphCanvas.tsx`

**Checkpoint**: dismiss/focus 정책이 surface별 분기가 아닌 host 정책으로 수렴한다.

---

## Phase 5: User Story 3 - Positioning/Stacking 표준화 (Priority: P2)

**Goal**: anchor 타입별 배치를 공통 positioning shell로 통합하고 layer order를 일관되게 유지한다.

**Independent Test**: pointer/selection/viewport-fixed anchor 케이스에서 clamp/flip/stacking이 동일 규칙으로 동작하는지 검증한다.

### Tests for User Story 3

- [X] T026 [P] [US3] Add anchor positioning regression matrix in `app/features/overlay-host/positioning.test.ts`
- [X] T027 [P] [US3] Add viewport-edge behavior regression in `app/components/GraphCanvas.viewport.test.ts`
- [X] T028 [P] [US3] Add overlay stacking order regression in `app/components/GraphCanvas.test.tsx`

### Implementation for User Story 3

- [X] T029 [US3] Implement clamp + flip resolution for pointer/selection anchors in `app/features/overlay-host/positioning.ts`
- [X] T030 [US3] Implement deterministic stacking sort by priority/openedAt in `app/features/overlay-host/state.ts`
- [X] T031 [US3] Apply canvas overlay layer budget constants in `app/components/GraphCanvas.tsx` and `app/features/overlay-host/layers.ts`
- [X] T032 [US3] Reposition selection floating slot on anchor movement in `app/features/overlay-host/slots.ts`

**Checkpoint**: viewport 경계/레이어 충돌 케이스가 host-level 알고리즘으로 통일된다.

---

## Phase 6: User Story 4 - Existing Overlay 동작 흡수 (Priority: P2)

**Goal**: 기존 `ContextMenu` 동작을 host primitive로 흡수하고 중복 portal/listener 소유를 제거한다.

**Independent Test**: 기존 context menu 기능 동등성(초기 포커스, dismiss, clamp)이 유지되면서 중복 전역 listener 경로가 제거됐는지 확인한다.

### Tests for User Story 4

- [X] T033 [P] [US4] Add parity tests between legacy and host-driven menu behavior, including slot-only extension coverage, in `app/components/GraphCanvas.test.tsx`
- [X] T034 [P] [US4] Add adapter-only state regression tests in `app/hooks/useContextMenu.test.ts`

### Implementation for User Story 4

- [X] T035 [US4] Extract host menu surface primitive from `ContextMenu` in `app/components/ContextMenu.tsx`
- [X] T036 [US4] Reduce `useContextMenu` responsibility to item resolution/open adapter in `app/hooks/useContextMenu.ts`
- [X] T037 [US4] Add host integration boundary guard comments and assertions in `app/features/overlay-host/context.tsx`
- [X] T038 [US4] Verify and preserve global overlay boundary with canvas host in `app/components/editor/WorkspaceClient.tsx`

**Checkpoint**: host 흡수 이후에도 사용자 관찰 동작은 유지되고, 책임 경계가 문서 계약과 일치한다.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: 문서/검증 경로를 최신화하고 analyze 전 품질 게이트를 완료한다.

- [X] T039 [P] Update implementation checkpoints in `specs/009-overlay-host/quickstart.md`
- [X] T040 [P] Update overlay-host source brief links and completion notes in `docs/features/database-first-canvas-platform/canvas-ui-entrypoints/entrypoint-foundation/overlay-host/README.md`
- [X] T041 Run quickstart verification command set and capture outcomes in `specs/009-overlay-host/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: 즉시 시작 가능
- **Phase 2 (Foundational)**: Phase 1 완료 후 진행, 모든 스토리의 공통 선행 조건
- **Phase 3 (US1)**: Foundational 완료 후 시작, MVP
- **Phase 4 (US2)**: US1 host wiring 위에서 lifecycle 정책 고정
- **Phase 5 (US3)**: US1/US2 host lifecycle 위에서 positioning/stacking 고정
- **Phase 6 (US4)**: US1~US3 완료 후 기존 동작 흡수/경계 정리
- **Phase 7 (Polish)**: 모든 목표 스토리 완료 후 실행

### User Story Dependencies

- **US1 (P1)**: Foundational 이후 독립 시작 가능
- **US2 (P1)**: US1의 host wiring 경로 의존
- **US3 (P2)**: US1의 host slot 구조 + US2 lifecycle 정책 의존
- **US4 (P2)**: US1~US3 구현 후 parity 흡수 및 경계 확정

### Within Each User Story

- 테스트 태스크를 먼저 작성하고 실패를 확인한 뒤 구현을 진행한다.
- host core 모듈(`state/positioning/lifecycle`) 수정 후 UI wiring(`GraphCanvas/ContextMenu/useContextMenu`)을 연결한다.
- 경계 관련 변경(`WorkspaceClient`)은 마지막 통합 단계에서 수행한다.

### Parallel Opportunities

- Setup의 `T002`, `T003`, `T004`는 `T001` 이후 병렬 가능
- Foundational의 `T006`~`T011`은 `T005` 이후 병렬 가능
- US1의 `T012`, `T013` 병렬 가능
- US2의 `T019`, `T020`, `T021` 병렬 가능
- US3의 `T026`, `T027`, `T028` 병렬 가능
- US4의 `T033`, `T034` 병렬 가능
- Polish의 `T039`, `T040` 병렬 가능

---

## Parallel Example: User Story 2

```bash
Task: "T019 [US2] Add dismiss reason regression tests in app/features/overlay-host/lifecycle.test.ts"
Task: "T020 [US2] Add keyboard/pointer dismiss regression in app/components/GraphCanvas.test.tsx"
Task: "T021 [US2] Add focus restore regression in app/components/editor/WorkspaceClient.test.tsx"
```

## Parallel Example: User Story 3

```bash
Task: "T026 [US3] Add anchor positioning regression matrix in app/features/overlay-host/positioning.test.ts"
Task: "T027 [US3] Add viewport-edge behavior regression in app/components/GraphCanvas.viewport.test.ts"
Task: "T028 [US3] Add overlay stacking order regression in app/components/GraphCanvas.test.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1~2를 완료해 host core를 고정한다.
2. US1으로 canvas overlay open path를 host contract로 전환한다.
3. US1 독립 검증 후 MVP로 판단한다.

### Incremental Delivery

1. US1: host contract adoption
2. US2: dismiss/focus lifecycle consistency
3. US3: positioning/stacking standardization
4. US4: legacy behavior absorption and boundary cleanup
5. Polish: docs and verification sync

### Parallel Team Strategy

1. Worker A: `app/features/overlay-host/{state,commands}.ts`
2. Worker B: `app/features/overlay-host/{lifecycle,positioning}.ts`
3. Worker C: `app/components/{GraphCanvas,ContextMenu}.tsx`
4. Worker D: `app/hooks/useContextMenu.ts` + 테스트
5. Worker E: 회귀 테스트 정비(`GraphCanvas*`, `WorkspaceClient`, overlay-host unit tests)

---

## Notes

- 전체 작업 수: 41
- US1 작업 수: 7
- US2 작업 수: 7
- US3 작업 수: 7
- US4 작업 수: 6
- 병렬 가능 작업 수: 21
- Suggested MVP scope: Phase 1~3 (US1)
