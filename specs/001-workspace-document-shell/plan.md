# Implementation Plan: Workspace Registry + Document Sidebar

**Branch**: `001-workspace-document-shell` | **Date**: 2026-03-20 | **Spec**: `/Users/danghamo/Documents/gituhb/magam-feature-dbfcp-electron-workspace-document-sidebar/specs/001-workspace-document-shell/spec.md`
**Input**: Feature specification from `/Users/danghamo/Documents/gituhb/magam-feature-dbfcp-electron-workspace-document-sidebar/specs/001-workspace-document-shell/spec.md`

## Summary

이 feature는 기존 file-tree 중심 sidebar를 workspace/document shell로 전환한다. 핵심은 (1) multi-workspace registry 구축, (2) single active workspace session 고정, (3) document-first sidebar와 persisted `New Document` 진입 제공, (4) local path ownership/reconnect UX 고정이다. legacy TSX 경로는 primary path가 아니라 compatibility surface로 유지한다.

## Technical Context

**Language/Version**: TypeScript 5.9.x, React 18, Bun 1.x  
**Primary Dependencies**: Next.js app shell, Zustand graph store, existing workspace client and sidebar surfaces  
**Storage**: app-level registry metadata + workspace-local persisted store (PGlite-backed workspace data)  
**Testing**: `bun test` for store/component behavior + focused client workflow regression  
**Target Platform**: Magam desktop/web workspace shell  
**Project Type**: feature-oriented modular monolith (app shell + runtime state)  
**Performance Goals**: workspace switch and document open should feel immediate in normal local workspace sizes; state cross-contamination defects must be zero in release verification  
**Constraints**: preserve local-first ownership, avoid silent fallback on missing path, keep legacy TSX as compatibility only, keep active workspace single at runtime  
**Scale/Scope**: `app/components/editor/WorkspaceClient.tsx`, `app/components/ui/Sidebar.tsx`, `app/store/graph.ts`, existing app proxy routes in `app/app/api/`, local shell server surface in `libs/cli/src/server/http.ts`, workspace/document shell docs

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Phase-0 Gate

- **I. Think Before Coding**: source spec already fixes core ambiguity (`multi-workspace registry + single active workspace`), so clarify is optional and skipped.
- **II. Structural Simplicity**: v1 introduces only essential registry/session/sidebar boundaries; no speculative multi-active runtime.
- **III. Feature-Oriented Modular Monolith**: scope stays in workspace/document shell surfaces, not broad canvas mutation internals.
- **IV. Dependency-Linear Design**: UI components consume store contracts; registry/session contract is isolated from document rendering internals.
- **V. Promptable Modules**: artifacts split into registry, session, sidebar, path-health contracts to minimize context for implementation tasks.
- **VI. Surgical Changes**: plan targets sidebar/client/store touchpoints only, plus feature docs.
- **VII. Goal-Driven and Verifiable Execution**: each story has independent acceptance checks and measurable outcomes in the spec.

Result: **PASS**

### Post-Phase-1 Re-check

- `research.md` resolves policy decisions for workspace identity, storage split, and unavailable-path handling.
- `data-model.md` defines key entities and session transitions.
- `contracts/` artifacts define boundaries for registry, active session, sidebar surface, and path health handling.
- `quickstart.md` provides story-level manual verification flow usable for task-phase checks.

Result: **PASS**

## Project Structure

### Documentation (this feature)

```text
specs/001-workspace-document-shell/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── checklists/
│   └── requirements.md
├── contracts/
│   ├── workspace-registry-contract.md
│   ├── active-workspace-session-contract.md
│   ├── document-sidebar-surface-contract.md
│   └── workspace-path-health-contract.md
└── tasks.md
```

### Source Code (repository root)

```text
app/components/editor/
└── WorkspaceClient.tsx

app/components/ui/
└── Sidebar.tsx

app/app/api/
├── documents/route.ts
├── file-tree/route.ts
├── files/route.ts
└── workspaces/route.ts

app/store/
└── graph.ts

libs/cli/src/server/
└── http.ts

docs/features/database-first-canvas-platform/
└── workspace-document-shell/README.md
```

**Structure Decision**: workspace/document shell 변경은 기존 app shell 경계(`WorkspaceClient`, `Sidebar`, `graph` store)를 중심으로 수행하되, 현재 file/document bootstrap과 file-tree hydration이 `app/app/api/*` 프록시 및 `libs/cli/src/server/http.ts`에 걸쳐 있으므로 해당 경계도 명시적으로 포함한다. canonical storage internals 전체 재설계는 제외하고, shell-level contracts와 필요한 shell-server adapters를 우선 고정한다.

## Phase Plan

### Phase 0: Research and Policy Lock

- workspace identity policy and dedupe rules
- registry metadata vs workspace-local data ownership split
- unavailable path behavior and reconnect policy

### Phase 1: Design Artifacts and Contracts

- data model for registry/session/document summary
- contract set for registry, active session, sidebar, path health
- quickstart scenarios for first-run, switch, new-document, reconnect

### Phase 2: Task Planning Readiness

- map FR/SC to implementation tasks by user story
- enforce dependency order (foundation before story tasks)
- capture parallel-safe task groups

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | N/A | N/A |
