# Implementation Plan: UI Runtime State

**Branch**: `009-ui-runtime-state` | **Date**: 2026-03-18 | **Spec**: `/Users/danghamo/Documents/gituhb/magam-feature-dbfcp-ui-runtime-state/specs/009-ui-runtime-state/spec.md`
**Input**: Feature specification from `/specs/009-ui-runtime-state/spec.md` plus source-of-truth docs at `docs/features/database-first-canvas-platform/canvas-ui-entrypoints/entrypoint-foundation/ui-runtime-state/README.md` and `docs/features/database-first-canvas-platform/canvas-ui-entrypoints/entrypoint-foundation/ui-runtime-state/implementation-plan.md`

## Summary

`ui-runtime-state` sub-slice introduces one foundation-owned runtime UI state contract for canvas entrypoint surfaces, focused on active tool, open surface descriptor, anchor snapshots, hover coordination, and optimistic pending lifecycle. The implementation keeps state runtime-only, does not change persisted schema, does not define mutation schema, and does not duplicate selection metadata ownership.

## Technical Context

**Language/Version**: TypeScript 5.9.x, React 18, Bun 1.x  
**Primary Dependencies**: Existing `useGraphStore` (`app/store/graph.ts`), entrypoint consumers (`app/components/GraphCanvas.tsx`, `app/components/FloatingToolbar.tsx`, `app/components/ContextMenu.tsx`, `app/hooks/useContextMenu.ts`), editing completion pipeline (`app/features/editing/commands.ts`)  
**Storage**: In-memory runtime/session state only inside existing graph store; no DB or persisted schema updates  
**Testing**: `bun test` with `app/store/graph.test.ts`, `app/components/GraphCanvas.test.tsx`, focused component tests in `app/components/FloatingToolbar.test.tsx` and `app/components/ContextMenu.test.tsx`, and new runtime-state selector/action tests  
**Target Platform**: Magam web editor canvas runtime  
**Project Type**: Monorepo modular application (CLI-first TSX canvas app with web runtime surfaces)  
**Performance Goals**: Single-surface exclusivity with deterministic dismiss behavior; stale anchors and stale pending entries converge to zero after lifecycle events  
**Constraints**: Runtime-only scope, no persisted schema changes, no mutation schema definition, no duplicated selection metadata ownership, no second global store  
**Scale/Scope**: `app/store/graph.ts`, `app/components/{GraphCanvas.tsx,FloatingToolbar.tsx,ContextMenu.tsx}`, `app/hooks/useContextMenu.ts`, `app/types/contextMenu.ts`, plus new feature module under `app/features/canvas-ui-entrypoints/ui-runtime-state/`

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Phase-0 Gate

- **I. Think Before Coding**: Scope boundaries are explicit from source docs and spec; clarify is intentionally skipped because no material ambiguity remains for this sub-slice.
- **II. Structural Simplicity**: No new store backend; state is organized as a sub-slice of existing graph store to avoid ownership drift.
- **III. Feature-Oriented Modular Monolith**: Runtime-state feature logic is isolated into a dedicated feature module and consumed by entrypoint surfaces.
- **IV. Dependency-Linear Design**: Surface components consume selectors/actions; store wiring remains the single write boundary.
- **V. Promptable Modules and Minimal Context Surfaces**: Types, selectors, actions, and reducer helpers are separated to minimize cross-file scanning.
- **VI. Surgical Changes**: Scope is limited to runtime UI coordination and affected surface consumers; unrelated UI systems remain untouched.
- **VII. Goal-Driven and Verifiable Execution**: Success is verifiable via selector/action tests and manual dismiss/anchor/pending scenarios.

Result: **PASS**

### Post-Phase-1 Re-check

- `research.md` locks key ownership and lifecycle decisions from the source docs.
- `data-model.md` defines runtime entities and transitions without crossing persistence boundaries.
- `contracts/` codifies ownership, dismiss rules, anchor snapshots, and pending lifecycle behavior.
- `quickstart.md` defines implementation order and verification scenarios aligned with spec success criteria.

Result: **PASS**

## Project Structure

### Documentation (this feature)

```text
specs/009-ui-runtime-state/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── tasks.md
├── checklists/
│   └── requirements.md
└── contracts/
    ├── runtime-state-ownership-contract.md
    ├── surface-dismiss-contract.md
    ├── anchor-snapshot-contract.md
    └── pending-lifecycle-contract.md
```

### Source Code (repository root)

```text
app/features/canvas-ui-entrypoints/ui-runtime-state/
├── types.ts
├── selectors.ts
├── actions.ts
└── reducer.ts

app/store/
└── graph.ts

app/components/
├── GraphCanvas.tsx
├── FloatingToolbar.tsx
└── ContextMenu.tsx

app/hooks/
└── useContextMenu.ts

app/types/
└── contextMenu.ts

app/features/editing/
└── commands.ts
```

**Structure Decision**: Keep state ownership in `app/store/graph.ts` with `entrypointRuntime` sub-slice, while feature-specific contracts live in `app/features/canvas-ui-entrypoints/ui-runtime-state/`. Existing UI components and hooks migrate from local ownership to selector/action consumption through adapters.

## Module Boundary Justification

- `app/features/canvas-ui-entrypoints/ui-runtime-state/*`
  - Owns runtime-state types, selectors, action contracts, and pure update helpers.
  - Does not own persisted data schema or mutation schema definitions.
- `app/store/graph.ts`
  - Owns actual store wiring and session lifetime state host.
  - Exposes runtime-state selectors/actions through existing graph store surface.
- `app/components/{GraphCanvas,FloatingToolbar,ContextMenu}.tsx` and `app/hooks/useContextMenu.ts`
  - Consume runtime-state contract and no longer own duplicated cross-surface booleans.
- `app/features/editing/commands.ts`
  - Provides request/command completion linkage for pending UI lifecycle.

## Traceability Notes

- `runtime-state-ownership-contract.md`
  - Implemented by `T001`-`T010`, `T028`, `T030`, `T031`
  - Verified by `app/store/graph.test.ts` runtime-slice ownership and reset tests
- `surface-dismiss-contract.md`
  - Implemented by `T011`-`T019`
  - Verified by `app/components/GraphCanvas.test.tsx`, `app/components/FloatingToolbar.test.tsx`, and `app/components/ContextMenu.test.tsx`
- `anchor-snapshot-contract.md`
  - Implemented by `T017`-`T019`
  - Verified by selection-anchor, context-menu anchor-position, and stale-anchor cleanup tests
- `pending-lifecycle-contract.md`
  - Implemented by `T020`-`T025`
  - Verified by `app/store/graph.test.ts`, `app/components/GraphCanvas.test.tsx`, and `app/components/FloatingToolbar.test.tsx`
- `SC-001` through `SC-005`
  - Covered by the focused regression suite in `quickstart.md` plus runtime-only reload/reset assertions in `app/store/graph.test.ts`

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| 없음 | N/A | N/A |
