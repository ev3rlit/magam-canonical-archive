# Phase 0 Research: UI Runtime State

## Decision 1: Runtime state stays in existing graph store as a sub-slice

- Decision: Introduce `entrypointRuntime` within `useGraphStore` instead of creating a second global store.
- Rationale: Selection, viewport, and edit completion events already live in graph store, so colocating cross-surface runtime state avoids synchronization drift.
- Alternatives considered:
  - Separate global store: increases ownership split and synchronization risk.
  - Keep all state local in components: prevents stable cross-surface coordination.

## Decision 2: Promote only cross-surface coordination state

- Decision: Runtime state includes only state that multiple entrypoint surfaces must read or close together.
- Rationale: Keeps the slice focused and avoids absorbing purely local visual booleans.
- Alternatives considered:
  - Promote all local UI booleans: creates bloated global state with weak ownership.
  - Keep mixed ownership without contract: preserves current inconsistency.

## Decision 3: Selection is consumed, not duplicated

- Decision: Selection metadata remains owned by existing graph store selection source; runtime slice stores only selection-linked surface descriptors and anchors.
- Rationale: Prevents dual ownership and inconsistent selection-derived behavior.
- Alternatives considered:
  - Duplicate selection snapshot as another source-of-truth: introduces drift risk.

## Decision 4: Anchor registry stores serializable snapshots only

- Decision: Anchors are stored as serializable descriptors (kind, coordinates, owner linkage, viewport snapshot), never DOM references.
- Rationale: Enables deterministic recalculation and cleanup across viewport and selection changes.
- Alternatives considered:
  - Store `HTMLElement`/`DOMRect` references: non-serializable and prone to stale pointer leaks.

## Decision 5: Open surface behavior is normalized by one descriptor and shared dismiss rules

- Decision: Use a single `openSurface` descriptor with one-primary-surface exclusivity and explicit dismiss triggers.
- Rationale: Removes duplicated outside-click/dismiss logic across toolbar and context-menu surfaces.
- Alternatives considered:
  - Per-surface independent open booleans: leads to overlapping menus and conflicting dismiss behavior.

## Decision 6: Pending UI state is keyed by request or command ID

- Decision: Pending registry uses request/command ID keys with lifecycle statuses (`pending`, `committed`, `failed`, `rollback`) and explicit clear behavior.
- Rationale: Supports deterministic disable/loading/rollback UI without persisting mutation payload.
- Alternatives considered:
  - Boolean pending flags per component: cannot represent multi-request concurrency or clear completion ownership.

## Decision 7: Existing hooks/components migrate via adapter-style transition

- Decision: `useContextMenu` and affected components move from state owners to adapters/consumers of the shared runtime contract.
- Rationale: Enables incremental migration while preserving behavior during transition.
- Alternatives considered:
  - One-shot full rewrite: increases regression risk and broadens unrelated surface change.

## Decision 8: Bubble context absorption is deferred

- Decision: `BubbleContext` is explicitly out of immediate migration scope.
- Rationale: Source docs identify possible overlap but do not require immediate ownership transfer for this sub-slice.
- Alternatives considered:
  - Immediate full merge into runtime slice: increases scope beyond required foundation goals.

## Clarification Resolution Status

- `/speckit.clarify` was intentionally skipped.
- Source docs provided sufficient scope and boundary specificity for planning and task decomposition.
- No unresolved ambiguity remains that materially changes plan structure, ownership, or acceptance criteria.
