# Tasks: Plugin Runtime v1

**Input**: Feature artifacts from `/Users/danghamo/Documents/gituhb/magam-feature-dbfcp-plugin-runtime-v1/docs/features/database-first-canvas-platform/plugin-runtime-v1/`
**Prerequisites**: `README.md`, `../implementation-plan.md`, `../schema-modeling.md`, `../entity-modeling.md`, `../ai-cli-tooling.md`

**Tests**: Not explicitly requested in `README.md`. This task list prioritizes implementation and smoke verification tasks; add dedicated automated coverage only when the runtime boundary is being introduced in the touched file.

**Organization**: Tasks are grouped by user story so each story can be implemented and validated independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on incomplete tasks)
- **[Story]**: User story label (`[US1]`, `[US2]`, `[US3]`, `[US4]`)
- Every task includes a concrete file path

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the shared contract and feature-module skeleton for plugin runtime work.

- [ ] T001 Create shared plugin runtime contract module in `libs/shared/src/lib/plugin-runtime-contract.ts` and export it from `libs/shared/src/index.ts`
- [ ] T002 Create plugin runtime feature surface in `app/features/plugin-runtime/index.ts`
- [ ] T003 [P] Create runtime scaffolding modules in `app/features/plugin-runtime/types.ts`, `app/features/plugin-runtime/registry.ts`, and `app/features/plugin-runtime/loader.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Lock shared schema, repository, bridge, and sandbox foundations before user-story work starts.

**CRITICAL**: No user story work should begin until this phase is complete.

- [ ] T004 Extend plugin catalog, plugin instance, and structured failure record types in `libs/shared/src/lib/canonical-persistence/records.ts`
- [ ] T005 [P] Add `plugin_packages`, `plugin_versions`, `plugin_exports`, `plugin_instances`, and `plugin_permissions` tables in `libs/shared/src/lib/canonical-persistence/schema.ts`
- [ ] T006 [P] Generate plugin runtime migration artifacts in `libs/shared/src/lib/canonical-persistence/drizzle/0001_plugin_runtime.sql`
- [ ] T007 [P] Implement plugin manifest/export/instance validators in `libs/shared/src/lib/canonical-persistence/validators.ts`
- [ ] T008 Implement plugin catalog and plugin instance repository flows in `libs/shared/src/lib/canonical-persistence/repository.ts` and export them from `libs/shared/src/lib/canonical-persistence/index.ts`
- [ ] T009 [P] Implement bridge protocol and capability gate primitives in `app/features/plugin-runtime/bridge.ts` and `app/features/plugin-runtime/capabilityGate.ts`
- [ ] T010 [P] Implement iframe host lifecycle and bundle loading foundations in `app/features/plugin-runtime/iframeHost.ts` and `app/features/plugin-runtime/loader.ts`

**Checkpoint**: Shared persistence and runtime boundaries are fixed; user stories can now build on stable contracts.

---

## Phase 3: User Story 1 - Sandboxed Plugin Widget Rendering (Priority: P1) 🎯 MVP

**Goal**: Installed plugin instances render as canvas widgets through the iframe bridge without direct host access.

**Independent Test**: Open a document with a plugin-backed canvas node, resolve its `pluginInstanceId` to an installed export, and verify that the node renders through the sandbox path rather than a native-node fallback.

### Implementation for User Story 1

- [ ] T011 [US1] Implement plugin instance hydration and catalog resolution in `app/features/plugin-runtime/instanceHydration.ts`
- [ ] T012 [P] [US1] Extend `app/features/render/parseRenderGraph.ts` to emit plugin-backed render nodes from `pluginInstanceId`
- [ ] T013 [P] [US1] Create sandboxed widget node component in `app/components/nodes/PluginNode.tsx`
- [ ] T014 [US1] Register plugin node rendering in `app/components/GraphCanvas.tsx`
- [ ] T015 [US1] Wire runtime provider exports and host bootstrap in `app/features/plugin-runtime/index.ts` and `app/features/plugin-runtime/iframeHost.ts`

**Checkpoint**: An installed plugin widget can render on the canvas through the sandbox host.

---

## Phase 4: User Story 2 - Validated Plugin Instance Mutation (Priority: P1)

**Goal**: Plugin instance props and bindings can be created, updated, and persisted through shared mutation contracts with explicit validation failures.

**Independent Test**: Create or update a plugin instance with valid props/binding, reload the document, and verify persisted values survive reload; submit invalid schema input and confirm a structured failure is returned.

### Implementation for User Story 2

- [ ] T016 [US2] Extend shared plugin runtime contracts for prop schema, binding schema, and host API envelopes in `libs/shared/src/lib/plugin-runtime-contract.ts`
- [ ] T017 [P] [US2] Add plugin instance create, update, and remove repository methods in `libs/shared/src/lib/canonical-persistence/repository.ts`
- [ ] T018 [P] [US2] Add plugin-aware create defaults and command envelopes in `app/features/editing/createDefaults.ts` and `app/features/editing/commands.ts`
- [ ] T019 [US2] Add plugin instance JSON-RPC handlers in `app/ws/methods.ts` and `app/ws/rpc.ts`
- [ ] T020 [US2] Reject raw AST patch flows for plugin-owned state in `app/ws/filePatcher.ts`
- [ ] T021 [US2] Connect runtime-side `updateInstanceProps` and optional `getSelection` dispatch in `app/features/plugin-runtime/bridge.ts`

**Checkpoint**: Plugin instance mutation is explicit, validated, and reload-stable.

---

## Phase 5: User Story 3 - Missing Plugin Resilience (Priority: P2)

**Goal**: Missing, disabled, or crashing plugins degrade to placeholder UI without taking down the document.

**Independent Test**: Remove or disable a plugin version, then reload the document and verify the document still loads while the affected plugin node renders a placeholder with stable identity and diagnostics.

### Implementation for User Story 3

- [ ] T022 [US3] Implement missing, disabled, and runtime-crash classifier in `app/features/plugin-runtime/fallback.ts`
- [ ] T023 [P] [US3] Create plugin placeholder renderer in `app/components/nodes/PluginFallbackNode.tsx`
- [ ] T024 [US3] Wire fallback resolution into `app/features/plugin-runtime/instanceHydration.ts` and `app/features/plugin-runtime/iframeHost.ts`
- [ ] T025 [US3] Surface instance-local plugin diagnostics in `app/store/graph.ts`
- [ ] T026 [US3] Propagate structured fallback failures through `libs/shared/src/lib/canonical-persistence/repository.ts` and `app/ws/methods.ts`

**Checkpoint**: Plugin failure stays local to the affected instance and preserves recovery context.

---

## Phase 6: User Story 4 - Reference Plugins and Smoke Verification (Priority: P2)

**Goal**: Representative chart/table plugins prove the runtime works end-to-end for sandbox render, props updates, and fallback behavior.

**Independent Test**: Install the chart and table examples, render both in a representative document, update props or bindings, and then simulate a missing bundle to verify the placeholder path.

### Implementation for User Story 4

- [ ] T027 [P] [US4] Create chart example plugin in `app/features/plugin-runtime/examples/chart/manifest.ts` and `app/features/plugin-runtime/examples/chart/index.tsx`
- [ ] T028 [P] [US4] Create table example plugin in `app/features/plugin-runtime/examples/table/manifest.ts` and `app/features/plugin-runtime/examples/table/index.tsx`
- [ ] T029 [US4] Seed example plugin catalog and install records in `libs/shared/src/lib/canonical-persistence/pglite-db.ts`
- [ ] T030 [US4] Add runtime smoke harness for chart/table render, props update, and missing-plugin fallback in `app/features/plugin-runtime/smoke.ts`
- [ ] T031 [US4] Document example setup and manual verification in `docs/features/database-first-canvas-platform/plugin-runtime-v1/README.md`

**Checkpoint**: Reference plugins demonstrate the v1 runtime on a real document path.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Finalize exports, handoff notes, and backlog boundaries that cut across stories.

- [ ] T032 [P] Export the plugin runtime public surface from `app/features/plugin-runtime/index.ts`, `libs/shared/src/index.ts`, and `libs/shared/src/lib/canonical-persistence/index.ts`
- [ ] T033 [P] Record CLI and MCP handoff notes for plugin-instance operations in `docs/features/database-first-canvas-platform/ai-cli-tooling.md`
- [ ] T034 Record remaining hardening and backlog items for sandbox policy, marketplace, and capability grants in `docs/features/database-first-canvas-platform/plugin-runtime-v1/README.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies
- **Foundational (Phase 2)**: Depends on Setup and blocks all user stories
- **US1 (Phase 3)**: Depends on Foundational
- **US2 (Phase 4)**: Depends on Foundational and reuses US1 runtime/bootstrap surfaces
- **US3 (Phase 5)**: Depends on US1 sandbox render path and shared repository diagnostics
- **US4 (Phase 6)**: Depends on US1, US2, and US3
- **Polish (Phase 7)**: Depends on the stories you intend to ship

### User Story Dependencies

- **US1**: First MVP increment after foundations
- **US2**: Adds validated mutation and session-aware host actions on top of the runtime base
- **US3**: Adds recovery and diagnostics on top of the render path
- **US4**: Proves the runtime with representative plugins and smoke validation

### Within Each User Story

- Lock shared contracts before wiring app runtime code
- Finish repository and bridge work before UI integration
- Validate story-specific smoke flow before moving to the next dependent story

### Parallel Opportunities

- **Phase 1**: T003 can run after T001/T002 ownership is decided
- **Phase 2**: T005, T006, T007, T009, and T010 can run in parallel once T004 lands
- **US1**: T012 and T013 can run in parallel after T011
- **US2**: T017 and T018 can run in parallel after T016
- **US3**: T023 can run in parallel with T022, then T024-T026 converge
- **US4**: T027 and T028 can run in parallel before T029-T031

---

## Parallel Example: User Story 4

```bash
# Example plugins in parallel
Task: "Create chart example plugin in app/features/plugin-runtime/examples/chart/manifest.ts and app/features/plugin-runtime/examples/chart/index.tsx"
Task: "Create table example plugin in app/features/plugin-runtime/examples/table/manifest.ts and app/features/plugin-runtime/examples/table/index.tsx"
```

---

## Implementation Strategy

### MVP First

1. Complete Phase 1 and Phase 2
2. Deliver Phase 3 (US1) sandboxed plugin widget rendering
3. Validate the sandbox render path independently before mutation or fallback work

### Incremental Delivery

1. US1: installed plugin renders through the sandbox
2. US2: plugin instance mutation and validation become stable
3. US3: missing-plugin and runtime-failure fallback becomes safe
4. US4: chart/table examples prove the runtime end to end

### Parallel Team Strategy

1. One owner on shared persistence and failure contracts in `libs/shared/src/lib/canonical-persistence/`
2. One owner on iframe host, bridge, and runtime wiring in `app/features/plugin-runtime/`
3. One owner on canvas integration and example plugins in `app/components/` and `app/features/plugin-runtime/examples/`

---

## Notes

- `[P]` tasks touch different files and should not start before their non-parallel prerequisites are done
- `app/ws/filePatcher.ts` remains a guardrail task, not the source of truth for plugin state
- CLI and MCP exposure are handoff concerns, not the core delivery path for this slice
