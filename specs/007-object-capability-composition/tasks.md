# Tasks: Object Capability Composition

**Input**: Design documents from `/Users/danghamo/Documents/gituhb/magam-object-capability-model-docs/specs/007-object-capability-composition/`  
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`

**Tests**: 포함됨. 이 스펙은 사용자 스토리별 독립 테스트와 quickstart 회귀 게이트를 명시하므로, 스토리별 테스트 태스크를 포함한다.

**Organization**: 작업은 사용자 스토리별로 묶어서 각 스토리를 독립적으로 구현하고 검증할 수 있게 구성한다.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 서로 다른 파일을 다루며 선행 미완료 의존성이 없는 병렬 가능 작업
- **[Story]**: 해당 작업이 속한 사용자 스토리 (`US1`~`US4`)
- 모든 작업은 정확한 파일 경로를 포함한다.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: canonical object feature에 필요한 fixture, assertion helper, alias regression 입력을 준비한다.

- [X] T001 Create canonical object fixture catalog in `app/features/render/__fixtures__/objectCapabilityFixtures.tsx`
- [X] T002 [P] Create public alias regression fixture catalog in `libs/core/src/__tests__/__fixtures__/objectCapabilityAliases.tsx`
- [X] T003 [P] Create shared canonical assertion helpers in `app/features/render/objectCapabilityTestUtils.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 모든 사용자 스토리보다 먼저 끝나야 하는 canonical schema, registry, inference, gate 기반을 맞춘다.

**⚠️ CRITICAL**: 이 단계가 끝나기 전에는 어떤 사용자 스토리 구현도 시작하지 않는다.

- [X] T004 Create canonical object types and validation result model in `app/features/render/canonicalObject.ts`
- [X] T005 [P] Create capability registry and payload validators in `app/features/render/capabilityRegistry.ts`
- [X] T006 [P] Create alias normalization and legacy inference helpers in `app/features/render/aliasNormalization.ts`
- [X] T007 [P] Create capability profile derivation helpers in `app/features/editing/capabilityProfile.ts`
- [X] T008 [P] Add foundational canonical type and registry regressions in `app/features/render/canonicalObject.test.ts` and `app/features/render/parseRenderGraph.test.ts`
- [X] T009 [P] Add shared RPC error codes for capability/content validation failures in `app/ws/rpc.ts`

**Checkpoint**: canonical type system, capability registry, legacy inference, and shared validation errors are in place for all stories.

---

## Phase 3: User Story 1 - 단일 Canonical Object 모델 정착 (Priority: P1) 🎯 MVP

**Goal**: alias와 legacy props를 canonical object core + capability set으로 정규화하면서 공개 API 호환성을 유지한다.

**Independent Test**: 기존 alias 문서를 로드하고 저장했을 때 내부 판단은 canonical metadata를 기준으로 동작하고 공개 authoring surface는 깨지지 않는다.

### Tests for User Story 1

- [X] T010 [P] [US1] Add alias-to-canonical normalization regressions in `app/features/render/parseRenderGraph.test.ts`
- [X] T011 [P] [US1] Add public alias compatibility regressions in `libs/core/src/__tests__/object-capability-aliases.spec.tsx`

### Implementation for User Story 1

- [X] T012 [US1] Integrate canonical object generation into `app/features/render/parseRenderGraph.ts`
- [X] T013 [US1] Persist canonical metadata on graph node data in `app/store/graph.ts`
- [X] T014 [US1] Keep public alias authoring surfaces stable in `libs/core/src/components/{Node.tsx,Shape.tsx,Sticky.tsx,Image.tsx,Markdown.tsx,Sequence.tsx,Sticker.tsx}`

**Checkpoint**: User Story 1 완료 시 canonical object가 내부 기본 단위가 되고, 기존 alias 문서는 계속 렌더/저장 가능해야 한다.

---

## Phase 4: User Story 2 - Capability 재사용 확장 (Priority: P1)

**Goal**: `frame`, `material`, `texture`, `attach`를 특정 family 전용이 아니라 capability 조합으로 재사용하고, explicit override precedence를 고정한다.

**Independent Test**: `Sticky` 외 alias에서도 capability 조합이 재사용되고, explicit user capability가 preset default보다 우선하며, `Sticky` semantic은 일부 default 제거 후에도 유지된다.

### Tests for User Story 2

- [X] T015 [P] [US2] Add capability reuse and precedence regressions in `app/features/render/parseRenderGraph.test.ts` and `libs/core/src/__tests__/object-capability-aliases.spec.tsx`
- [X] T016 [P] [US2] Add non-sticky capability reuse render regressions in `app/components/nodes/ShapeNode.test.tsx` and `app/components/nodes/StickyNode.test.tsx`

### Implementation for User Story 2

- [X] T017 [US2] Implement explicit > inferred > preset precedence in `app/features/render/aliasNormalization.ts` and `app/features/render/parseRenderGraph.ts`
- [X] T018 [US2] Generalize frame/material/texture/attach rendering helpers in `app/components/nodes/BaseNode.tsx`, `app/components/nodes/ShapeNode.tsx`, and `app/components/nodes/StickyNode.tsx`
- [X] T019 [US2] Align reusable capability defaults and preset helpers in `app/features/editing/createDefaults.ts` and `app/utils/stickerDefaults.ts`
- [X] T020 [US2] Preserve `sticky-note` semantic when sticky-default capabilities are removed in `app/features/render/aliasNormalization.ts` and `app/features/editing/capabilityProfile.ts`

**Checkpoint**: User Story 2 완료 시 visual/placement capability는 alias를 넘어서 재사용 가능하고 precedence rule은 일관되게 동작해야 한다.

---

## Phase 5: User Story 3 - Content Contract 경계 보존 (Priority: P2)

**Goal**: `media`, `markdown`, `sequence` content contract를 style capability와 분리해 유지하고, mismatch를 명시적으로 거부한다.

**Independent Test**: `Image`, `Markdown`, `Sequence`는 기존 편집/렌더 동작을 유지하고, content-kind와 맞지 않는 필드는 진단과 함께 거부된다.

### Tests for User Story 3

- [X] T021 [P] [US3] Add content-kind contract regressions in `app/components/nodes/renderableContent.test.tsx`, `app/components/nodes/MarkdownNode.test.tsx`, and `app/features/render/parseRenderGraph.test.ts`
- [X] T022 [P] [US3] Add explicit content-kind mismatch rejection tests in `app/ws/filePatcher.test.ts` and `app/ws/methods.test.ts`

### Implementation for User Story 3

- [X] T023 [US3] Enforce content-kind validation and field exclusivity in `app/features/render/capabilityRegistry.ts` and `app/features/render/aliasNormalization.ts`
- [X] T024 [US3] Preserve specialized rendering behavior for `media`, `markdown`, and `sequence` in `app/components/nodes/renderableContent.tsx`, `app/components/nodes/ImageNode.tsx`, `app/components/nodes/MarkdownNode.tsx`, and `app/components/nodes/SequenceDiagramNode.tsx`
- [X] T025 [US3] Surface content-contract diagnostics in `app/ws/filePatcher.ts` and `app/ws/methods.ts`

**Checkpoint**: User Story 3 완료 시 strong content contracts는 유지되고, mismatch 입력은 조용히 무시되지 않고 명시적으로 실패해야 한다.

---

## Phase 6: User Story 4 - Capability 기반 편집/패치 규칙 전환 (Priority: P2)

**Goal**: renderer, editability, command, patch routing을 alias/tag 이름이 아니라 canonical capability/content profile 기반으로 전환한다.

**Independent Test**: 같은 capability 조합을 가진 alias들은 동일한 edit/patch 결과를 내고, 비허용 capability 변경은 클라이언트와 서버 모두에서 거부된다.

### Tests for User Story 4

- [X] T026 [P] [US4] Add capability-profile editability regressions in `app/components/editor/WorkspaceClient.test.tsx` and `app/components/GraphCanvas.test.tsx`
- [X] T027 [P] [US4] Add capability/content-aware patch gate regressions in `app/ws/filePatcher.test.ts` and `app/ws/methods.test.ts`

### Implementation for User Story 4

- [X] T028 [US4] Route client editability and command generation through canonical capability profiles in `app/features/editing/editability.ts`, `app/features/editing/commands.ts`, and `app/features/editing/capabilityProfile.ts`
- [X] T029 [US4] Switch UI affordance gating to canonical metadata in `app/components/editor/workspaceEditUtils.ts`, `app/components/editor/WorkspaceClient.tsx`, `app/components/GraphCanvas.tsx`, `app/components/ContextMenu.tsx`, and `app/components/FloatingToolbar.tsx`
- [X] T030 [US4] Enforce server-side capability/content-contract gates for create/update/patch flows in `app/ws/filePatcher.ts` and `app/ws/methods.ts`

**Checkpoint**: User Story 4 완료 시 tag-name branching은 canonical capability/content-contract gating으로 실질 대체되어야 한다.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: 전 스토리 회귀, 문서 정합성, quickstart 검증을 마무리한다.

- [X] T031 [P] Refresh implementation checkpoints in `specs/007-object-capability-composition/quickstart.md` and `specs/007-object-capability-composition/structure-reference.md`
- [X] T032 [P] Add final cross-story canonical regressions in `app/features/render/parseRenderGraph.test.ts`, `app/ws/filePatcher.test.ts`, and `app/components/editor/WorkspaceClient.test.tsx`
- [X] T033 Run focused regression and type-safety gates documented in `specs/007-object-capability-composition/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: 바로 시작 가능
- **Phase 2 (Foundational)**: Phase 1 완료 후 진행, 모든 사용자 스토리의 선행 조건
- **Phase 3 (US1)**: Phase 2 완료 후 시작, MVP
- **Phase 4 (US2)**: US1의 canonical normalization 기반 위에서 진행
- **Phase 5 (US3)**: US1의 canonical/content normalization을 재사용
- **Phase 6 (US4)**: US1~US3에서 고정된 canonical model과 contract를 edit/patch routing으로 확장
- **Phase 7 (Polish)**: 선택 스토리 완료 후 통합 검증

### User Story Dependencies

- **US1 (P1)**: Foundational 이후 즉시 시작, 독립 MVP
- **US2 (P1)**: US1의 canonical normalization surface 의존
- **US3 (P2)**: US1의 canonical/content normalization surface 의존
- **US4 (P2)**: US1~US3의 canonical model, capability registry, content contract 고정 이후 진행

### Within Each User Story

- 테스트 태스크를 먼저 작성/보강해 회귀 기준을 고정한다.
- normalization/validation helper 다음에 해당 story의 integration file을 수정한다.
- server gate 태스크는 client gate 태스크 이후가 아니라 같은 story 내에서 canonical contract 확정 후 수행한다.

### Parallel Opportunities

- Setup의 `T002`, `T003`은 `T001` 이후 병렬 가능
- Foundational의 `T005`, `T006`, `T007`, `T008`, `T009`는 `T004` 이후 병렬 가능
- US1의 `T010`, `T011`은 병렬 가능
- US2의 `T015`, `T016`은 병렬 가능
- US3의 `T021`, `T022`는 병렬 가능
- US4의 `T026`, `T027`는 병렬 가능
- Polish의 `T031`, `T032`는 병렬 가능

---

## Parallel Example: User Story 1

```bash
Task: "T010 [US1] Add alias-to-canonical normalization regressions in app/features/render/parseRenderGraph.test.ts"
Task: "T011 [US1] Add public alias compatibility regressions in libs/core/src/__tests__/object-capability-aliases.spec.tsx"
```

## Parallel Example: User Story 2

```bash
Task: "T015 [US2] Add capability reuse and precedence regressions in app/features/render/parseRenderGraph.test.ts"
Task: "T016 [US2] Add non-sticky capability reuse render regressions in app/components/nodes/ShapeNode.test.tsx and app/components/nodes/StickyNode.test.tsx"
```

## Parallel Example: User Story 4

```bash
Task: "T026 [US4] Add capability-profile editability regressions in app/components/editor/WorkspaceClient.test.tsx and app/components/GraphCanvas.test.tsx"
Task: "T027 [US4] Add capability/content-aware patch gate regressions in app/ws/filePatcher.test.ts and app/ws/methods.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1과 Phase 2로 canonical schema, registry, inference, profile 기반을 고정한다.
2. User Story 1에서 alias/legacy -> canonical normalization을 완성한다.
3. US1 회귀를 통과한 상태를 MVP로 본다.

### Incremental Delivery

1. Setup + Foundational 완료 후 canonical 기반을 고정한다.
2. US1을 추가해 내부 모델 정규화를 완성한다.
3. US2를 추가해 capability 재사용과 precedence 규칙을 확장한다.
4. US3를 추가해 content contract와 mismatch rejection을 마무리한다.
5. US4를 추가해 editability/patch routing을 capability-first로 전환한다.
6. 마지막으로 문서와 회귀를 정리한다.

### Parallel Team Strategy

1. Foundation 단계에서는 schema/registry/inference/profile을 서로 다른 파일 ownership으로 병렬 처리한다.
2. 이후에는
   - Worker A: `app/features/render/*` normalization
   - Worker B: `app/components/nodes/*` render behavior
   - Worker C: `app/features/editing/*` and `app/components/editor/*` client gate
   - Worker D: `app/ws/*` patch validation
   - Worker E: regression tests
3. 공통 충돌 파일인 `app/features/render/parseRenderGraph.ts`, `app/ws/filePatcher.ts`, `app/ws/methods.ts`, `app/components/editor/WorkspaceClient.tsx`는 같은 phase 안에서도 순차 merge를 전제로 한다.

---

## Notes

- 전체 작업 수: 33
- US1 작업 수: 5
- US2 작업 수: 6
- US3 작업 수: 5
- US4 작업 수: 5
- 병렬 가능 작업 수: 17
- Suggested MVP scope: Phase 1~3 (US1)
- 모든 태스크는 체크리스트 포맷과 exact file path 요구를 충족한다.
