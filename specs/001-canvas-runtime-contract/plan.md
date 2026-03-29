# Implementation Plan: Canvas Runtime Contract

**Branch**: `001-canvas-runtime-contract` | **Date**: 2026-03-27 | **Spec**: `/Users/danghamo/Documents/gituhb/magam-canvas-runtime-contract/specs/001-canvas-runtime-contract/spec.md`
**Input**: Feature specification from `/specs/001-canvas-runtime-contract/spec.md` plus `docs/features/m2/canvas-runtime-contract/*`

## Summary

`Canvas Runtime`를 shared/runtime 쪽의 framework-neutral bounded context로 고정하고, React editor, headless CLI, future MCP는 모두 그 published contract를 소비하는 downstream adapter로 재정렬한다. 구현 전략은 한 번에 editor를 갈아엎지 않고, (1) shared runtime 계약과 repository translation boundary를 먼저 고정하고, (2) hierarchy/render/editing projection과 command/result/history semantics를 shared/runtime application layer로 이동시키고, (3) 마지막에 `app`의 WebSocket, ReactFlow, 화면 조합 계층을 thin adapter로 축소하는 점진 migration이다.

## Technical Context

**Language/Version**: TypeScript 5.9.x, React 18, Bun 1.x  
**Primary Dependencies**: `@magam/core`, `libs/shared/src/lib/{canonical-query,canonical-mutation,canonical-persistence}`, Drizzle/PGlite persistence, ReactFlow app adapter, WebSocket JSON-RPC transport, `app/processes/canvas-runtime/*` UI composition runtime  
**Storage**: canonical persistence DB via `libs/shared/src/lib/canonical-persistence/*` plus current compatibility file patch pipeline; runtime contract must not expose either storage language directly  
**Testing**: `bun test` unit/integration suites, shared contract tests, projection and mutation result tests, architecture-boundary tests, targeted adapter smoke tests around `app/hooks/useCanvasRuntime.ts`, `app/ws/methods.ts`, and editor entrypoints  
**Target Platform**: Magam web editor, headless CLI service, and future MCP or other framework clients consuming the same runtime contract  
**Project Type**: 모노레포 기반 modular monolith with shared runtime library + persistence layer + app-side transport and UI adapters  
**Performance Goals**: current single-canvas editing 흐름을 유지하면서 projection read, dry-run preview, conflict handling, optimistic replay, and invalidate metadata를 공용 contract로 제공한다; runtime 의미 해석 때문에 app이 전체 graph를 임의 재해석하지 않도록 줄인다  
**Constraints**: `Canvas Runtime` is core domain; `Canvas Aggregate`와 `Canonical Object Aggregate`는 같은 bounded context 안에 유지; persistence language, transport grammar, ReactFlow payload, raw DB row shape는 published language 밖에 둔다; full editor rewrite, CLI 구현, MCP transport 구현, realtime protocol 구현은 이번 범위가 아니다  
**Scale/Scope**: `docs/features/m2/canvas-runtime-contract/*`, 신규 `libs/shared/src/lib/canvas-runtime/*`, existing `libs/shared/src/lib/{canonical-query,canonical-mutation,canonical-persistence}/*`, `app/hooks/useCanvasRuntime.ts`, `app/ws/methods.ts`, `app/features/editor/pages/CanvasEditorPage.tsx`, `app/features/render/parseRenderGraph.ts`, `app/features/editing/{editability.ts,commands.ts,actionRoutingBridge/*}`, `app/components/GraphCanvas.tsx`, `app/components/editor/workspaceEditUtils.ts`, `app/processes/canvas-runtime/*`

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Phase-0 Gate

- **I. Think Before Coding**: repository boundary, projection placement, command translation, ownership split, history normalization, group-membership scope, and transport isolation questions are resolved in Phase 0 before code motion.
- **II. Structural Simplicity**: 새 shared runtime feature root와 translator layer만 도입하고, current editor나 CLI를 한 번에 재작성하지 않는다.
- **III. Feature-Oriented Modular Monolith**: shared runtime, canonical persistence, and app adapters를 feature boundary 기준으로 분리하고, `app/processes/canvas-runtime`는 UI composition runtime로 남긴다.
- **IV. Dependency-Linear Design**: consumer adapter -> runtime application -> repository port -> canonical persistence -> DB 의 단방향 흐름을 강제한다.
- **V. Promptable Modules**: contracts, projections, command translation, history, and adapter boundaries를 개별 문서와 모듈로 나눠 최소 컨텍스트 변경이 가능하게 한다.
- **VI. Surgical Changes**: current `canonical-query`와 `canonical-mutation`을 점진적으로 감싸거나 흡수하고, raw file patch pipeline과 React editor 전면 개편은 이번 단계에 포함하지 않는다.
- **VII. Goal-Driven Verification**: contract alignment, projection separation, ownership enforcement, dry-run/conflict/history envelopes, adapter thinning을 테스트와 boundary checks로 검증한다.

결과: **PASS**

### Post-Phase-1 Re-check

- `research.md`는 repository translation boundary, projection placement, command translator, ownership split, history normalization, group-membership scope, and adapter isolation 결정을 문서로 고정한다.
- `data-model.md`는 `Canvas Aggregate`, `CanvasNode`, `Canonical Object Aggregate`, `BodyBlock`, projections, mutation result, conflict, and history 모델을 bounded context 기준으로 정리한다.
- `contracts/`는 projection, command, event, write-result/history, and adapter boundaries를 spec과 current hotspots에 맞춰 검증 포인트로 분해한다.
- `quickstart.md`는 UI/CLI adapter가 read projection, command dispatch, dry-run, conflict, and history replay를 같은 contract로 검증하는 흐름을 제공한다.
- plan은 raw DB row, transport-specific grammar, ReactFlow payload를 published contract로 승격하지 않고, app/shared 책임 혼합을 migration 단계로 분리한다.

결과: **PASS**

## Project Structure

### Documentation (this feature)

```text
specs/001-canvas-runtime-contract/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── checklists/
│   └── requirements.md
└── contracts/
    ├── runtime-core-boundary.md
    ├── projection-contracts.md
    ├── command-language-contract.md
    ├── event-contracts.md
    ├── write-result-history-contract.md
    └── app-adapter-boundary.md
```

### Source Code (repository root)

```text
libs/shared/src/lib/
├── canvas-runtime/                    # new shared runtime core/domain/application surface
│   ├── contracts/
│   ├── application/
│   ├── projections/
│   ├── history/
│   └── index.ts
├── canonical-query/                  # transitional repository-backed readers
├── canonical-mutation/               # transitional lower-level mutation implementation
└── canonical-persistence/            # repository translation boundary, validators, schema

app/
├── hooks/
│   └── useCanvasRuntime.ts
├── ws/
│   └── methods.ts
├── components/
│   ├── GraphCanvas.tsx
│   └── editor/workspaceEditUtils.ts
├── features/
│   ├── editor/pages/CanvasEditorPage.tsx
│   ├── render/parseRenderGraph.ts
│   ├── editing/
│   │   ├── commands.ts
│   │   ├── editability.ts
│   │   └── actionRoutingBridge/
│   └── canvas-ui-entrypoints/
└── processes/
    └── canvas-runtime/               # UI contribution runtime, not the shared core domain runtime
```

**Structure Decision**: `libs/shared/src/lib/canvas-runtime/`를 이번 feature의 구현 중심으로 도입한다. 여기서 published contract mirror, projection builders, command dispatch, history normalization, and application/control result semantics를 소유한다. `libs/shared/src/lib/canonical-persistence/`는 storage language와 runtime language 사이의 repository translation boundary로 남기고, `canonical-query`와 `canonical-mutation`은 runtime application layer 뒤의 transitional implementation detail로 축소한다. `app`은 WebSocket, ReactFlow, screen composition, and UI intent capture adapter로 정리한다.

## Module Boundary Justification

- `libs/shared/src/lib/canvas-runtime/contracts`
  - docs 계약 파일과 1:1로 대응되는 shared runtime contract export를 둔다.
  - framework-neutral published language만 노출하고 ReactFlow, JSON-RPC, raw DB fields를 금지한다.
- `libs/shared/src/lib/canvas-runtime/projections`
  - hierarchy, render, editing projection builders를 소유한다.
  - `parseRenderGraph.ts`와 `editability.ts`에 흩어진 runtime 의미 해석을 shared projection으로 흡수한다.
- `libs/shared/src/lib/canvas-runtime/application`
  - command batch validation, target resolution, aggregate ownership routing, dry-run, conflict, changed-set, and invalidate emission을 담당한다.
  - published command contract와 current `canonical-mutation` 사이 translator를 이 계층에 둔다.
- `libs/shared/src/lib/canvas-runtime/history`
  - body block targeting normalization, canonical replay batch generation, undo/redo conflict semantics를 소유한다.
- `libs/shared/src/lib/canonical-persistence`
  - Drizzle schema, row mappers, validators, repository implementation을 유지한다.
  - runtime 위 계층이 raw rows, `schema.ts`, DB-specific payload를 직접 참조하지 못하게 막는다.
- `libs/shared/src/lib/canonical-query` and `libs/shared/src/lib/canonical-mutation`
  - current implementation 자산으로 유지하되 published surface가 아니라 runtime application 내부 dependency로 내린다.
  - 점진적으로 repository-backed helpers 또는 internal translators로 재배치한다.
- `app/features/render/parseRenderGraph.ts`
  - render projection을 ReactFlow node/edge payload로 바꾸는 renderer adapter로 축소한다.
  - canonical object normalization이나 editability derivation의 owner가 되지 않는다.
- `app/features/editing/{editability.ts,commands.ts,actionRoutingBridge/*}` and `app/components/editor/workspaceEditUtils.ts`
  - legacy UI intent와 current controls를 runtime command로 번역하는 app-side bridge로 남긴다.
  - 장기적으로 editing projection consumer가 되며 shared/runtime rule owner가 되지 않는다.
- `app/hooks/useCanvasRuntime.ts` and `app/ws/methods.ts`
  - runtime query/mutation/result를 transport에 실어 나르는 adapter로 정리한다.
  - JSON-RPC method names, WebSocket message shapes, file path resolution, compatibility patch plumbing은 published contract 밖에 둔다.
- `app/features/editor/pages/CanvasEditorPage.tsx` and `app/components/GraphCanvas.tsx`
  - screen composition, selection shell, input capture, optimistic UI coordination만 담당한다.
  - runtime meaning, history semantics, dry-run/conflict policy는 shared/runtime에서 공급받는다.

## Phase 0 Research Summary

Phase 0에서 해결할 질문은 아래 7개이며, 최종 결정은 `research.md`에 고정한다.

1. repository translation boundary를 `canonical-persistence` repository 중심으로 고정한다.
2. hierarchy/render/editing projection은 new shared runtime package 안에 둔다.
3. published command contract와 current canonical mutation 사이에 explicit translator layer를 둔다.
4. `object.content.update`는 canonical object ownership으로, node label/display rename은 canvas ownership으로 분리한다.
5. body block input은 selection/anchor/index로 받되, history replay는 block-id + resolved placement로 정규화한다.
6. group membership는 current public spec 범위 밖으로 유지하고 follow-up contract extension으로 남긴다.
7. ReactFlow, JSON-RPC, compatibility file path, raw patch payload는 app adapter 밖으로 밀어낸다.

## Phase 1 Design Output

- `data-model.md`
  - bounded context 안의 aggregate, entity-like member, projection model, mutation result model, history model을 정리한다.
- `contracts/runtime-core-boundary.md`
  - runtime core published language, ownership, repository boundary, and module export policy를 문서화한다.
- `contracts/projection-contracts.md`
  - hierarchy/render/editing projection의 역할, source data, migration target, and verification points를 정리한다.
- `contracts/command-language-contract.md`
  - command vocabulary, ownership split, translator responsibilities, group-membership exclusion, and current UI intent mapping을 정리한다.
- `contracts/event-contracts.md`
  - aggregate events vs application/control events, `CanvasChanged` invalidation, and non-goals를 정리한다.
- `contracts/write-result-history-contract.md`
  - mutation result envelope, dry-run, conflict, changed-set, diagnostics, history replay normalization을 정리한다.
- `contracts/app-adapter-boundary.md`
  - `GraphCanvas`, `CanvasEditorPage`, `useCanvasRuntime.ts`, `app/ws/methods.ts`, `parseRenderGraph.ts`, and editing bridges의 target responsibility를 고정한다.
- `quickstart.md`
  - UI/CLI adapter 기준 read projection, command dispatch, dry-run, conflict handling, history replay/invalidate flow를 검증 절차로 제공한다.

## Implementation Phases

### Phase 1 - Establish Shared Runtime Package And Export Boundary

- Create `libs/shared/src/lib/canvas-runtime/` as the new feature root for shared runtime contracts and services.
- Mirror the published contract surface from `docs/features/m2/canvas-runtime-contract/contracts/*.contract.ts` into code exports or aligned implementation-facing wrappers.
- Define repository-facing ports so new runtime code depends on repository results, not `schema.ts`, Drizzle rows, ReactFlow nodes, or JSON-RPC payloads.
- Add architecture checks that forbid `app/*`, ReactFlow, and WS transport imports from the shared runtime package.

**Verification**

- Shared runtime export tests compile without app or transport imports.
- Architecture tests show only `canonical-persistence` touches DB schema rows directly.

### Phase 2 - Move Read Semantics Into Shared Runtime Projections

- Implement hierarchy projection builder for tree-first structure, topology, surface membership, and canonical object linkage.
- Implement render projection builder for framework-neutral render metadata, leaving ReactFlow mapping in `parseRenderGraph.ts`.
- Implement editing projection builder for editability, capability sets, source identity, target identity, body entry, anchors, and ordered body block metadata.
- Migrate current runtime meaning from `app/features/render/parseRenderGraph.ts`, `app/features/editing/editability.ts`, and `app/components/editor/workspaceEditUtils.ts` into projection builders or projection-derived helpers.

**Verification**

- Projection contract tests validate distinct responsibility of hierarchy, render, and editing surfaces.
- Body block metadata tests prove selection/anchor/index targeting is stable for consumers.
- `parseRenderGraph.ts` reads render projection output instead of re-deriving runtime semantics locally.

### Phase 3 - Introduce Command Translation And Aggregate Routing

- Build a runtime command dispatcher that accepts published `CanvasMutationBatchV1` payloads and routes them by aggregate ownership.
- Add explicit translation from published command language to current lower-level `canonical-mutation` operations while lower layers are still transitional.
- Split `object.content.update` from canvas-owned rename/presentation flows so current UI `selection.content.update` adapter can branch correctly.
- Resolve body block targets from selection/anchor/index input into canonical object operations and replay-safe history inputs.
- Keep group membership outside the v1 published contract and leave current group flows in app/legacy space until a separate contract extension is specified.

**Verification**

- Command contract tests cover every mandatory command in the feature spec.
- Ownership tests fail if object content flows are routed through canvas-owned node update paths.
- History normalization tests confirm no raw selection/anchor/index refs survive into replay artifacts.

### Phase 4 - Implement Shared Write Result, Dry-Run, Conflict, And History Semantics

- Introduce one mutation result envelope family for success, failure, dry-run, and version conflict outcomes.
- Add changed-set, diagnostics, retryable metadata, and version boundary calculation as runtime application outputs.
- Implement history entry creation, inverse/forward replay batches, and revision-aware undo/redo failure behavior.
- Emit application/control events (`CanvasMutationDryRunValidated`, `CanvasMutationRejected`, `CanvasVersionConflictDetected`, `CanvasChanged`) from runtime services rather than from transport code.

**Verification**

- Dry-run and committed mutation tests return the same envelope family.
- Conflict tests verify shared error codes and retryability fields.
- Undo/redo tests verify canonical replay form and explicit conflict failure on stale revisions.

### Phase 5 - Enforce Repository Translation Boundary In Existing Shared Modules

- Refactor `libs/shared/src/lib/canonical-query/*` to become runtime projection dependencies or adapter-layer helpers rather than published query contracts.
- Refactor `libs/shared/src/lib/canonical-mutation/*` to become internal execution helpers behind runtime command dispatch.
- Keep `libs/shared/src/lib/canonical-persistence/repository.ts`, `mappers.ts`, `records.ts`, and `validators.ts` as the only storage-translation layer.
- Remove direct storage-language assumptions from runtime-facing query/mutation result shapes.

**Verification**

- Boundary tests prove raw storage rows do not leak above repository translation.
- Query and mutation unit tests operate on repository records or runtime contracts rather than schema row types.

### Phase 6 - Thin App Adapters Without Big-Bang Editor Rewrite

- Convert `app/hooks/useCanvasRuntime.ts` into a transport adapter that sends runtime queries and mutation batches and interprets shared result envelopes.
- Convert `app/ws/methods.ts` into a JSON-RPC adapter that delegates to runtime query and mutation services instead of owning file-patch semantics.
- Reduce `app/features/editor/pages/CanvasEditorPage.tsx` to screen composition, workspace/session wiring, and adapter orchestration.
- Reduce `app/components/GraphCanvas.tsx` to render projection consumption, pointer or keyboard input capture, and runtime command emission.
- Re-scope `workspaceEditUtils.ts`, `app/features/editing/commands.ts`, and action-routing bridge modules as adapter-side translators until their logic can be retired behind runtime projections.
- Preserve current behavior through compatibility bridges instead of attempting full React editor completion in this feature.

**Verification**

- UI smoke tests confirm existing editor create, move, content edit, dry-run, conflict, and history flows still work via runtime contract adapters.
- No shared runtime module imports ReactFlow, JSON-RPC request types, or app state store types.

## Migration Strategy

- Start with contract source of truth, not UI rewrites.
- Land shared runtime projections before changing editor rendering behavior.
- Introduce command translation and write-result semantics before replacing transport endpoints.
- Keep `canonical-query` and `canonical-mutation` behind adapters during migration instead of deleting them early.
- Move app modules to contract consumer status in thin slices: first read, then editability metadata, then write dispatch, then history/dry-run/conflict handling.
- Treat `app/processes/canvas-runtime` as UI composition runtime throughout this feature; do not confuse it with the new shared core domain runtime.

## Verification Strategy

- **Contract Alignment**: runtime contract export tests, projection contract tests, mutation result envelope tests, history replay normalization tests.
- **Boundary Safety**: architecture tests preventing ReactFlow, JSON-RPC, and DB schema imports inside shared runtime modules.
- **Persistence Isolation**: repository tests verifying storage translation remains localized to `canonical-persistence`.
- **Adapter Safety**: targeted tests for `useCanvasRuntime.ts`, `app/ws/methods.ts`, `CanvasEditorPage.tsx`, and `GraphCanvas.tsx` using shared runtime outputs.
- **Migration Guardrails**: regression tests around content update ownership split, body block targeting, dry-run parity, version conflicts, and invalidate behavior.

## Out Of Scope In This Plan

- Standalone CLI implementation
- Svelte client implementation
- MCP transport implementation
- Full React editor refactor completion
- Raw DB schema publication
- Full realtime collaboration protocol

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| 없음 | N/A | N/A |
