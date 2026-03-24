# Phase 0 Research: Canonical Mutation Query Core

## Decision 1: Introduce a transport-neutral shared module for query/mutation contracts and execution

- Decision: Place canonical query/mutation contracts and core execution logic in a dedicated shared module (`canonical-mutation-query`) rather than embedding them in UI or WS handlers.
- Rationale: This feature must serve both UI and AI/CLI paths with identical behavior; transport-owned logic would create drift.
- Alternatives considered:
  - Keep logic in `app/ws/methods.ts`: rejected because WS-specific assumptions leak into domain behavior.
  - Duplicate logic for UI and CLI consumers: rejected because it breaks determinism and increases maintenance cost.

## Decision 2: Keep repository ownership in canonical persistence and extend it only where needed

- Decision: Reuse `CanonicalPersistenceRepository` as the write/read boundary and add missing query/mutation primitives there.
- Rationale: Persistence ownership is already fixed by the previous slice; creating a parallel persistence surface would violate boundary clarity.
- Alternatives considered:
  - Build direct SQL/ORM access inside mutation executor: rejected because it bypasses repository validation and error contracts.
  - Keep repository unchanged and implement workarounds in adapters: rejected because adapter logic would become stateful and fragile.

## Decision 3: Use intent-based mutation operations rather than patch-shape inference

- Decision: Define mutation by explicit operation types (`object.update-core`, `object.body.block.reorder`, `canvas-node.reparent`, etc.).
- Rationale: Intent-based contracts are easier to validate, replay, and audit than inferred patch semantics.
- Alternatives considered:
  - Generic patch object with inferred operation type: rejected because ambiguity increases validation complexity.
  - Alias/tag-specific mutation verbs: rejected because canonical model should not depend on presentation aliases.

## Decision 4: Standardize query partiality through explicit include/filter/pagination fields

- Decision: Use canonical filter inputs and explicit `include`, `limit`, `cursor`, `bounds` fields for partial reads.
- Rationale: The feature goal is to avoid giant-document reads; explicit partiality fields make behavior predictable across transports.
- Alternatives considered:
  - Return full document/object payloads by default: rejected because it negates database-first benefits.
  - Transport-specific partial options: rejected because query semantics would diverge across WS/CLI.

## Decision 5: Concurrency is revision-token-based with explicit conflict results

- Decision: Mutation requests require a base revision token and return explicit conflict envelopes when head revision differs.
- Rationale: Revision-token concurrency aligns with append-only revision history and is transport-neutral.
- Alternatives considered:
  - File hash based conflict checks: rejected because hash semantics are tied to legacy file patching.
  - Last-write-wins without conflicts: rejected because silent overwrites violate reliability expectations.

## Decision 6: Validation failures are first-class, structured, and non-silent

- Decision: Validation always returns explicit failure codes with path/details, and mutations never downgrade to success-shaped defaults.
- Rationale: The slice requires enforceable contracts for capability/content boundaries and note body rules.
- Alternatives considered:
  - Best-effort patch with dropped fields: rejected because users cannot trust mutation outcomes.
  - Transport-layer-only validation: rejected because adapters can be bypassed by other consumers.

## Decision 7: Keep `contentBlocks` mutation semantics stable-id and ordered

- Decision: Block operations target stable block ids and preserve deterministic ordering rules.
- Rationale: Note body fidelity and replay determinism depend on stable ids and order-aware operations.
- Alternatives considered:
  - Position-only operations without stable ids: rejected because reorder/update collisions become ambiguous.
  - Flatten body back to single content field: rejected because it regresses note-body expressiveness.

## Decision 8: Preserve adapter compatibility while shifting execution core

- Decision: Existing WS request metadata (`commandId`, error envelope style) remains adapter-visible while execution moves to canonical query/mutation core.
- Rationale: This minimizes UI regression risk and enables incremental migration from AST patch pipelines.
- Alternatives considered:
  - Hard switch to a new transport response shape: rejected because it forces simultaneous UI/CLI rewrites.
  - Keep AST patch as primary path and add query/mutation as optional: rejected because scope goal is canonical execution unification.

