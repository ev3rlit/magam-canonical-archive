# Phase 0 Research: Canonical Object Persistence

## Decision 1: Use Drizzle ORM with a PostgreSQL-compatible schema and PGlite for the local embedded profile

- Decision: Define the canonical persistence contract with `Drizzle ORM`, target a PostgreSQL-compatible relational model, and use `PGlite` as the first local embedded runtime profile.
- Rationale: This aligns with the database-first feature docs, preserves a path to production PostgreSQL/pgvector, and avoids inventing a temporary storage fork for local development.
- Alternatives considered:
  - SQLite-first local schema: rejected because it would diverge from the intended PostgreSQL-compatible canonical model.
  - Prisma-first persistence layer: rejected because the current repository already has Drizzle operational patterns and the slice emphasizes explicit schema/control over generated abstraction.

## Decision 2: Persist native objects as one canonical record shape with workspace-scoped identity

- Decision: Store all native objects in a single canonical record shape keyed by a workspace-scoped `id`, not by alias-specific table families.
- Rationale: The clarified spec requires alias-independent persistence, stable downstream query/mutation contracts, and controlled cross-document reuse. Non-note objects may reuse canonical ids, while editable note-like objects clone by default. Shared editable-note reuse is deferred instead of being partially specified now.
- Alternatives considered:
  - Alias-specific tables: rejected due to schema multiplication and drift risk.
  - Global object identifiers across the whole database: rejected because workspace ownership is the stronger domain boundary.

## Decision 3: Split explicit columns and flexible payloads by query value, not by authoring alias

- Decision: Keep `semantic_role`, `primary_content_kind`, and `canonical_text` as explicit indexed fields, while storing `content_blocks`, `source_meta`, `capabilities`, `capability_sources`, and `extensions` as structured JSON payloads.
- Rationale: This preserves strong queryability for core filters while keeping capability/content evolution flexible and contract-driven. Ordered note body blocks need a typed persistence home without forcing a new table family.
- Alternatives considered:
  - One large JSON blob: rejected because it weakens query/index paths and obscures ownership.
  - Fully flattened capability columns: rejected because capability evolution would become schema-heavy and alias-coupled.

## Decision 4: Every native canvas node must reference exactly one canonical object

- Decision: Treat `canonical_object_id` as required for native nodes, while plugin or binding-proxy nodes continue to use their own reference paths.
- Rationale: The clarified spec explicitly chose a strict canonical/native relationship so that semantic/content/capability truth always lives in the canonical layer.
- Alternatives considered:
  - Allowing native canvas-local nodes with no canonical object: rejected because it weakens the canonical/canvas ownership boundary in the first slice.
  - Duplicating canonical payload into `canvas_nodes.props`: rejected because it creates conflicting truths.

## Decision 5: Model deletion as logical tombstoning, not hard physical removal

- Decision: Represent deleted canonical objects as tombstoned logical records so canvas references can resolve to placeholder state without losing referential context.
- Rationale: The clarified spec requires canvas references to survive object deletion as tombstones/placeholders. Logical tombstoning satisfies that while keeping history and diagnostics available.
- Alternatives considered:
  - Hard delete with cascading canvas cleanup: rejected because the clarified spec explicitly chose surviving placeholder references.
  - Hard delete with broken references: rejected because it creates orphaned state and weak diagnostics.

## Decision 6: Enforce strict relation integrity for canonical object graph edges

- Decision: Reject relation writes whose endpoints do not resolve to existing canonical objects in the same workspace; do not allow dangling relation records.
- Rationale: The clarified spec chose strict relation integrity, which keeps graph traversal and future mutation/query semantics deterministic.
- Alternatives considered:
  - Allow dangling relations for later cleanup: rejected because it increases ambiguity and complicates the next slice.
  - Encode missing endpoints as free-form relation metadata only: rejected because it weakens the canonical graph contract.

## Decision 7: Place the reusable persistence contract in a shared module with its own ownership boundary

- Decision: Add the canonical persistence schema, validators, mappers, repository interface, and `PGlite` bootstrap under a new shared library module rather than inside the app or an existing product/runtime module.
- Rationale: Both the app-side runtime and the future headless CLI will need the same persistence contract. A shared module is the smallest stable boundary that supports both consumers without cross-layer coupling.
- Alternatives considered:
  - Implementing inside `app/` only: rejected because the future CLI would then depend on app-owned implementation details.
- Reusing an unrelated runtime-specific repository directly: rejected because canonical persistence needs its own stable ownership boundary.

## Decision 8: Preserve editable note bodies as extensible ordered content blocks with clone-on-create semantics

- Decision: Represent legacy `Node`/`Sticky` note bodies as ordered `content_blocks` stored on the canonical object, treat `text` and `markdown` as core block types, allow future namespaced custom block types with structured payloads, seed new note-like objects with one empty text block when no initial body is provided, and require cross-document note insertion/duplication to create cloned canonical objects.
- Rationale: The existing TSX authoring model allowed multiple ordered text/markdown children inside one node. The next step should not freeze that into a rich-text-only lane; it should become an extensible block container that can later host structured information like callouts, tables, embeds, or custom widgets without changing the persistence boundary.
- Alternatives considered:
  - Flattening note bodies into a single `capabilities.content` string/source field: rejected because it loses ordered multi-block structure.
  - Modeling each note block as its own top-level canonical object: rejected because it adds graph complexity without matching the authoring need.
  - Sharing editable note canonical objects across documents: deferred to backlog because its immediate product value is unclear and it complicates ownership semantics.
  - Hard-coding all future block types into the core schema now: rejected because it would overfit this slice and make every new block kind a schema event.
