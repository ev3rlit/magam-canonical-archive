# Tasks: Workspace Registry + Document Sidebar

**Input**: Design documents from `/Users/danghamo/Documents/gituhb/magam-feature-dbfcp-electron-workspace-document-sidebar/specs/001-workspace-document-shell/`  
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`

**Tests**: 명시적 TDD 요구가 없어 전용 테스트 작성 태스크는 필수로 포함하지 않는다. 각 스토리의 독립 검증은 `quickstart.md` 시나리오로 수행한다.

**Organization**: 사용자 스토리별 독립 구현/검증이 가능하도록 phase를 분리한다.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 선행 의존성 없이 병렬 가능한 작업
- **[Story]**: 해당 사용자 스토리 라벨 (`US1`~`US4`)
- 모든 작업은 구체 파일 경로를 포함한다.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: workspace/document shell 변경을 위한 문서/상태 베이스라인을 정리한다.

- [ ] T001 Add feature source linkage notes to `docs/features/database-first-canvas-platform/workspace-document-shell/README.md`
- [ ] T002 [P] Add workspace/document shell migration anchors in `app/components/editor/WorkspaceClient.tsx`
- [ ] T003 [P] Add sidebar migration anchors in `app/components/ui/Sidebar.tsx`
- [ ] T004 [P] Add store migration anchors in `app/store/graph.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 모든 스토리가 공통으로 사용하는 registry/session/path-health 기반을 먼저 고정한다.

**⚠️ CRITICAL**: 이 단계 완료 전에는 스토리별 UI 구현을 시작하지 않는다.

- [ ] T005 Define `RegisteredWorkspace` and path health state types in `app/store/graph.ts`
- [ ] T006 Implement workspace registry actions (create/add/remove/list) in `app/store/graph.ts`
- [ ] T007 [P] Implement single active workspace session state and switch action in `app/store/graph.ts`
- [ ] T008 [P] Implement active workspace scoped document-session reset behavior in `app/store/graph.ts`
- [ ] T009 [P] Implement unavailable path state transitions and reconnect action in `app/store/graph.ts`
- [ ] T010 Add registry/session persistence wiring and restore guards in `app/store/graph.ts`
- [x] T033 [P] Add workspace registry route and filesystem helpers in `app/app/api/workspaces/route.ts` and `app/app/api/workspaces/_shared.ts`
- [x] T034 [P] Add document bootstrap route and filesystem helpers in `app/app/api/documents/route.ts` and `app/app/api/workspaces/_shared.ts`

**Checkpoint**: registry/session/path-health contract가 store와 shell-server boundary에서 동작한다.

---

## Phase 3: User Story 1 - Workspace 등록과 활성화 (Priority: P1) 🎯 MVP

**Goal**: 사용자가 여러 workspace를 등록하고 single active workspace를 전환할 수 있게 한다.

**Independent Test**: first-run에서 workspace 2개 등록 후 switcher 전환 시 active scope가 정확히 바뀌는지 확인.

### Implementation for User Story 1

- [x] T011 [US1] Add workspace switcher UI section and actions in `app/components/ui/Sidebar.tsx`
- [x] T012 [US1] Add `New Workspace` flow trigger wiring in `app/components/editor/WorkspaceClient.tsx`
- [x] T013 [US1] Add `Add Existing Workspace` flow trigger wiring in `app/components/editor/WorkspaceClient.tsx`
- [x] T014 [US1] Connect switcher selection to active workspace session in `app/components/editor/WorkspaceClient.tsx`
- [x] T015 [US1] Ensure active workspace metadata display (name/path/status) in `app/components/ui/Sidebar.tsx`

**Checkpoint**: workspace registry + switcher가 사용 가능하고 active workspace 전환이 된다.

---

## Phase 4: User Story 2 - Document-first 사이드바와 문서 생성 (Priority: P1)

**Goal**: file-tree 중심 sidebar를 document-first 탐색으로 전환하고 `New Document` 즉시 진입을 보장한다.

**Independent Test**: active workspace에서 `New Document` 생성 후 즉시 main canvas 진입 및 문서 목록 반영 확인.

### Implementation for User Story 2

- [x] T016 [US2] Replace primary sidebar content from file tree to document list section in `app/components/ui/Sidebar.tsx`
- [x] T017 [US2] Implement empty-workspace document state and CTA rendering in `app/components/ui/Sidebar.tsx`
- [x] T018 [US2] Wire sidebar document selection to active workspace scoped open behavior in `app/components/editor/WorkspaceClient.tsx`
- [x] T019 [US2] Update `new-document` command path to active-workspace persisted bootstrap in `app/components/editor/WorkspaceClient.tsx`
- [ ] T020 [US2] Sync new document creation result into workspace-scoped store list in `app/store/graph.ts`
- [x] T021 [US2] Ensure post-create navigation enters document main canvas in `app/components/editor/WorkspaceClient.tsx`

**Checkpoint**: sidebar의 기본 탐색 단위가 document가 되고 신규 문서 생성/진입이 즉시 동작한다.

---

## Phase 5: User Story 3 - 로컬 소유성과 경로 이상 상태 처리 (Priority: P2)

**Goal**: 경로 노출/유틸리티와 unavailable/reconnect/remove 흐름을 제공한다.

**Independent Test**: 경로 유틸리티 실행과 unavailable 상태에서 reconnect/remove 처리 확인.

### Implementation for User Story 3

- [x] T022 [US3] Add workspace utility actions (`Show in Finder`, `Copy Path`) in `app/components/ui/Sidebar.tsx`
- [x] T023 [US3] Add utility action handlers in `app/components/editor/WorkspaceClient.tsx`
- [x] T024 [US3] Render unavailable workspace status and last-known path in `app/components/ui/Sidebar.tsx`
- [x] T025 [US3] Implement reconnect request flow and result handling in `app/components/editor/WorkspaceClient.tsx`
- [x] T026 [US3] Implement remove-unavailable entry flow with explicit confirmation path in `app/components/editor/WorkspaceClient.tsx`
- [x] T035 [US3] Wire workspace path health checks, ensure/reconnect, and reveal calls through `app/app/api/workspaces/route.ts` and `app/components/editor/WorkspaceClient.tsx`

**Checkpoint**: local ownership affordance와 missing path recovery가 명시적으로 동작한다.

---

## Phase 6: User Story 4 - Legacy 경계 유지 (Priority: P3)

**Goal**: legacy TSX 경로를 compatibility로 유지하면서 primary navigation은 document-first로 고정한다.

**Independent Test**: sidebar 기본 경로에서 TSX file-tree가 빠지고 compatibility 경로에서만 접근 가능한지 확인.

### Implementation for User Story 4

- [ ] T027 [US4] Move legacy file-tree access out of primary sidebar region in `app/components/ui/Sidebar.tsx`
- [ ] T028 [US4] Add compatibility/import entrypoint copy and placement in `app/components/ui/Sidebar.tsx`
- [ ] T029 [US4] Ensure command/open flows prioritize document-first navigation in `app/components/editor/WorkspaceClient.tsx`

**Checkpoint**: primary authoring UX는 document-first이며 legacy path는 compatibility 위치로 후퇴한다.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: 문서/검증 경로와 상태 일관성을 정리한다.

- [ ] T030 [P] Update feature PRD completion notes in `docs/features/database-first-canvas-platform/workspace-document-shell/README.md`
- [ ] T031 [P] Update quickstart validation notes in `specs/001-workspace-document-shell/quickstart.md`
- [ ] T032 Run quickstart scenario validation and capture outcomes in `specs/001-workspace-document-shell/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: 즉시 시작 가능
- **Phase 2 (Foundational)**: Phase 1 이후, 모든 스토리를 블록
- **Phase 3 (US1)**: Foundational 완료 후 시작 (MVP)
- **Phase 4 (US2)**: US1과 같은 shell 경계를 사용하므로 US1 이후 권장
- **Phase 5 (US3)**: registry/session 기반에 의존하므로 Foundational + US1 이후
- **Phase 6 (US4)**: US2 sidebar 전환 이후 수행
- **Phase 7 (Polish)**: 모든 목표 스토리 완료 후 수행

### User Story Dependencies

- **US1 (P1)**: Foundational 이후 독립 시작 가능
- **US2 (P1)**: US1 active session wiring에 의존
- **US3 (P2)**: Foundational registry/path health에 의존
- **US4 (P3)**: US2의 document-first sidebar 전환 결과에 의존

### Parallel Opportunities

- `T002`, `T003`, `T004`는 `T001` 이후 병렬 가능
- `T007`, `T008`, `T009`, `T033`, `T034`는 `T006` 이후 병렬 가능
- `T030`, `T031`은 병렬 가능

---

## Parallel Example: Foundational Phase

```bash
Task: "T007 Implement single active workspace session state and switch action in app/store/graph.ts"
Task: "T008 Implement active workspace scoped document-session reset behavior in app/store/graph.ts"
Task: "T009 Implement unavailable path state transitions and reconnect action in app/store/graph.ts"
Task: "T033 Add workspace registry route and filesystem helpers in app/app/api/workspaces/route.ts and app/app/api/workspaces/_shared.ts"
Task: "T034 Add document bootstrap route and filesystem helpers in app/app/api/documents/route.ts and app/app/api/workspaces/_shared.ts"
```

## Parallel Example: Setup Phase

```bash
Task: "T002 Add workspace/document shell migration anchors in app/components/editor/WorkspaceClient.tsx"
Task: "T003 Add sidebar migration anchors in app/components/ui/Sidebar.tsx"
Task: "T004 Add store migration anchors in app/store/graph.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Complete Setup and Foundational phases.
2. Deliver US1 workspace registry + active switcher.
3. Validate active scope switching before expanding to document-first flow.

### Incremental Delivery

1. US1: registry + active workspace switching
2. US2: document-first sidebar + new-document bootstrap
3. US3: local ownership utilities + unavailable recovery
4. US4: legacy compatibility boundary

### Parallel Team Strategy

1. Engineer A: `app/store/graph.ts` foundational state and actions
2. Engineer B: `app/components/ui/Sidebar.tsx` IA and state rendering
3. Engineer C: `app/components/editor/WorkspaceClient.tsx` flow orchestration

---

## Notes

- Total tasks: 35
- US1 tasks: 5
- US2 tasks: 6
- US3 tasks: 6
- US4 tasks: 3
- Suggested MVP scope: Phase 1~3
