# Tasks: TSX-Backed Canvas Editing Commands

**Input**: `/Users/danghamo/Documents/gituhb/magam-feature-web-editing-board-document/specs/006-canvas-editing-commands/` 설계 문서  
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`

**Tests**: 스펙의 정량 성공 기준(SC-001~SC-008)과 `quickstart.md` 게이트를 충족하기 위해 테스트 작업을 포함한다.

**Organization**: 사용자 스토리별 독립 구현/검증이 가능하도록 Phase를 분리한다.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 선행 의존성이 없고 병렬 실행 가능한 작업
- **[Story]**: 사용자 스토리 작업(`US1`~`US4`)만 표기
- 모든 작업은 정확한 파일 경로를 포함한다.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: command 설계와 테스트 fixture를 공통 기반으로 고정한다.

- [X] T001 Create shared semantic command types and builders skeleton in `app/features/editing/commands.ts`
- [X] T002 [P] Create editable subset and read-only gating helpers in `app/features/editing/editability.ts`
- [X] T003 [P] Create TSX editing command fixture module in `app/ws/__fixtures__/canvas-editing-commands.tsx`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 모든 사용자 스토리의 공통 경계(editable subset, routing, error contract)를 먼저 정렬한다.

**⚠️ CRITICAL**: 이 단계 완료 전에는 사용자 스토리 구현을 시작하지 않는다.

- [X] T004 Add `editMeta` extraction contract to render parsing in `app/features/render/parseRenderGraph.ts`
- [X] T005 [P] Extend edit target/read-only resolution helpers in `app/components/editor/workspaceEditUtils.ts`
- [X] T006 [P] Add editability-aware RPC error definitions in `app/ws/rpc.ts`
- [X] T007 [P] Extend mutation transport envelope handling in `app/hooks/useFileSync.ts`
- [X] T008 [P] Add foundational routing/editability/render-layout regression tests in `app/features/render/parseRenderGraph.test.ts`, `app/components/editor/WorkspaceClient.test.tsx`, and `app/hooks/useLayout.test.ts`

**Checkpoint**: `sourceMeta + editMeta + error contract`가 클라이언트/서버 양쪽에서 일관되게 동작하고 기존 render/layout 분류가 유지되어야 한다.

---

## Phase 3: User Story 1 - Safe Direct Edit for Existing Objects (Priority: P1) 🎯 MVP

**Goal**: 이동/콘텐츠/스타일/rename 편집이 의도 필드만 TSX에 반영되도록 만든다.

**Independent Test**: absolute move, relative move, text/markdown edit, style edit, rename 각각에서 비대상 필드 변화 없이 최소 diff와 참조 무결성이 유지된다.

### Tests for User Story 1

- [X] T009 [P] [US1] Add minimal-diff patcher tests for absolute/relative/content/style/rename updates in `app/ws/filePatcher.test.ts`
- [X] T010 [P] [US1] Add direct-edit and rename command workflow tests in `app/components/editor/WorkspaceClient.test.tsx` and `app/hooks/useFileSync.test.ts`

### Implementation for User Story 1

- [X] T011 [US1] Implement move/content/style/rename command builders in `app/features/editing/commands.ts`
- [X] T012 [US1] Add `patchNodeRelativePosition`, `patchNodeContent`, `patchNodeStyle`, and `patchNodeRename` in `app/ws/filePatcher.ts`
- [X] T013 [US1] Route semantic update/move/rename payload validation in `app/ws/methods.ts`
- [X] T014 [US1] Integrate direct-edit command builders into drag/text/style/rename commit flows in `app/components/editor/WorkspaceClient.tsx` and related UI entrypoints
- [X] T015 [US1] Align completion-event snapshots for direct edits and rename in `app/store/graph.ts` and `app/hooks/useFileSync.ts`

**Checkpoint**: 드래그/텍스트/스타일/rename 편집이 모두 command 단위로 기록되고 undo/redo snapshot이 일관되어야 한다.

---

## Phase 4: User Story 2 - Create New Objects from Web Editing (Priority: P1)

**Goal**: Canvas 생성과 MindMap 자식/형제 생성을 placement mode 기반으로 저장한다.

**Independent Test**: canvas absolute create, mindmap child create, mindmap sibling create가 TSX와 렌더 양쪽에 반영된다.

### Tests for User Story 2

- [X] T016 [P] [US2] Add create placement contract tests in `app/ws/methods.test.ts` and `app/ws/filePatcher.test.ts`
- [X] T017 [P] [US2] Add toolbar-mode and pane-click/context create flow UI tests in `app/components/GraphCanvas.test.tsx`

### Implementation for User Story 2

- [X] T018 [US2] Implement create command builders and ID policy helper in `app/features/editing/commands.ts` and `app/features/editing/createDefaults.ts`
- [X] T019 [US2] Add scope-aware insertion resolver for placement modes in `app/ws/filePatcher.ts`
- [X] T020 [US2] Extend `node.create` validation for placement modes and node types in `app/ws/methods.ts`
- [X] T021 [US2] Add canvas toolbar create mode, pane-click create, and mindmap create actions in `app/components/FloatingToolbar.tsx`, `app/config/contextMenuItems.ts`, `app/hooks/useContextMenu.ts`, and `app/components/GraphCanvas.tsx`
- [X] T022 [US2] Wire create dispatch and post-create selection handoff in `app/components/editor/WorkspaceClient.tsx` and `app/store/graph.ts`

**Checkpoint**: 생성 command가 삽입 scope를 정확히 해석하고, toolbar/pane-click 기반 Canvas 생성과 MindMap child/sibling 생성이 모두 동작해야 한다.

---

## Phase 5: User Story 3 - Structure Editing for MindMap (Priority: P2)

**Goal**: MindMap 구조 변경을 좌표 이동이 아닌 `reparent` 의미로 저장한다.

**Independent Test**: 유효 부모 변경은 저장되고 cycle 또는 invalid scope는 거부된다.

### Tests for User Story 3

- [X] T023 [P] [US3] Add reparent cycle/scope regression tests in `app/ws/methods.test.ts` and `app/ws/filePatcher.test.ts`
- [X] T024 [P] [US3] Add drag-to-reparent intent tests in `app/components/GraphCanvas.test.tsx`

### Implementation for User Story 3

- [X] T025 [US3] Implement reparent command builder and drop-intent resolver in `app/features/editing/commands.ts` and `app/components/GraphCanvas.tsx`
- [X] T026 [US3] Add mindmap parent candidate filtering and rejection messaging in `app/components/editor/workspaceEditUtils.ts` and `app/components/editor/WorkspaceClient.tsx`
- [X] T027 [US3] Harden `patchNodeReparent` and RPC validation for scope/cycle/object-from preservation in `app/ws/filePatcher.ts` and `app/ws/methods.ts`

**Checkpoint**: 구조 편집 실패 시 이유가 명확히 노출되고 성공 시 관계 필드만 변경되어야 한다.

---

## Phase 6: User Story 4 - Predictable Reliability and Recovery (Priority: P2)

**Goal**: 충돌/실패는 원자적으로 거부하고 undo/redo는 completion event 단위로 1-step 동작하게 한다.

**Independent Test**: VERSION_CONFLICT, NODE_NOT_FOUND, EDIT_NOT_ALLOWED, PATCH_FAILED 시나리오에서 롤백/안내/히스토리 정합성이 유지된다.

### Tests for User Story 4

- [X] T028 [P] [US4] Add conflict and rollback regression tests in `app/hooks/useFileSync.test.ts` and `app/components/editor/WorkspaceClient.test.tsx`
- [X] T029 [P] [US4] Add one-step undo/redo history tests in `app/store/graph.test.ts` and `app/components/GraphCanvas.test.tsx`

### Implementation for User Story 4

- [X] T030 [US4] Enforce editable-subset read-only gating in `app/components/editor/workspaceEditUtils.ts` and `app/components/editor/WorkspaceClient.tsx`
- [X] T031 [US4] Add atomic rejection paths with structured error payloads in `app/ws/methods.ts` and `app/ws/rpc.ts`
- [X] T032 [US4] Extend completion-event taxonomy and snapshot application for create/reparent flows in `app/store/graph.ts` and `app/hooks/useFileSync.ts`

**Checkpoint**: 실패 시 partial apply가 없어야 하고 undo/redo가 정확히 1이벤트 단위로 작동해야 한다.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: 전 스토리 통합 검증과 문서 정합성을 마무리한다.

- [X] T033 [P] Refresh command contract docs and quickstart verification matrix in `specs/006-canvas-editing-commands/quickstart.md` and `specs/006-canvas-editing-commands/contracts/rpc-command-mapping-contract.md`
- [X] T034 [P] Add final minimal-diff guard regressions for mixed command sequences in `app/ws/filePatcher.test.ts`
- [X] T035 Run focused regression and type-safety gates for `app/features/render/parseRenderGraph.test.ts`, `app/ws/filePatcher.test.ts`, `app/ws/methods.test.ts`, `app/components/GraphCanvas.test.tsx`, `app/components/editor/WorkspaceClient.test.tsx`, `app/store/graph.test.ts`, and `app/hooks/useFileSync.test.ts` as documented in `specs/006-canvas-editing-commands/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: 즉시 시작 가능
- **Phase 2 (Foundational)**: Phase 1 완료 후 시작, 모든 스토리의 선행 조건
- **Phase 3 (US1)**: Phase 2 완료 후 시작, MVP
- **Phase 4 (US2)**: US1의 command/pacher 기반 위에서 진행
- **Phase 5 (US3)**: US1/US2의 command routing을 재사용해 구조 편집 확장
- **Phase 6 (US4)**: 앞선 스토리의 mutation 경로를 대상으로 안정성 강화
- **Phase 7 (Polish)**: 선택 스토리 완료 후 통합 검증

### User Story Dependencies

- **US1 (P1)**: 독립 시작 가능(Foundational 이후)
- **US2 (P1)**: US1의 command infrastructure 의존
- **US3 (P2)**: US1의 routing + US2의 create placement 규칙 일부 의존
- **US4 (P2)**: US1~US3 mutation path를 대상으로 안정성 보강

### Parallel Opportunities

- Phase 1의 `T002`, `T003`는 `T001` 이후 병렬 가능
- Phase 2의 `T005`, `T006`, `T007`, `T008`은 `T004` 이후 병렬 가능
- US1의 `T009`, `T010`은 병렬 가능
- US2의 `T016`, `T017`은 병렬 가능
- US3의 `T023`, `T024`는 병렬 가능
- US4의 `T028`, `T029`는 병렬 가능
- Polish의 `T033`, `T034`는 병렬 가능

---

## Parallel Example: User Story 1

```bash
Task: "T009 [US1] Add minimal-diff patcher tests in app/ws/filePatcher.test.ts"
Task: "T010 [US1] Add direct-edit command workflow tests in app/components/editor/WorkspaceClient.test.tsx"
```

## Parallel Example: User Story 2

```bash
Task: "T016 [US2] Add create placement contract tests in app/ws/methods.test.ts"
Task: "T017 [US2] Add contextual create UX tests in app/components/GraphCanvas.test.tsx"
```

## Parallel Example: User Story 4

```bash
Task: "T028 [US4] Add conflict and rollback regressions in app/hooks/useFileSync.test.ts"
Task: "T029 [US4] Add one-step undo/redo tests in app/store/graph.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1~2로 command 계약과 editability gate를 고정한다.
2. US1에서 direct edit 최소 diff와 이벤트 히스토리를 먼저 완성한다.
3. US1 테스트 게이트를 통과한 상태를 MVP로 본다.

### Incremental Delivery

1. US1: 이동/콘텐츠/스타일 직접 편집 안정화
2. US2: 생성 command와 placement 정책 추가
3. US3: 구조 편집(reparent) 확장
4. US4: 실패 복구/undo-redo 신뢰성 강화
5. Polish: 문서/회귀 최종 정리

### Parallel Team Strategy

1. transport/서버 담당: `app/hooks/useFileSync.ts`, `app/ws/*`
2. UI/상호작용 담당: `app/components/editor/*`, `app/components/GraphCanvas.tsx`, `app/config/contextMenuItems.ts`
3. 테스트 담당: `app/ws/*.test.ts`, `app/hooks/*.test.ts`, `app/components/*.test.tsx`, `app/features/render/*.test.ts`

---

## Notes

- 전체 작업 수: 35
- US1 작업 수: 7
- US2 작업 수: 7
- US3 작업 수: 5
- US4 작업 수: 5
- 병렬 가능 작업 수: 14
- 범위 제한: TSX-backed canvas editing commands only
