# Contract: Canonical Canvas Ownership Boundary

## Purpose

Prevent source-of-truth overlap between canonical object persistence and canvas composition persistence.

## Ownership

- Canonical layer owns:
  - semantic role
  - content contract payload
  - ordered note body `contentBlocks`
  - capability payload
  - capability provenance
  - canonical deletion/tombstone state
- Canvas layer owns:
  - layout
  - z-order/composition relationships
  - canvas-local display props/state

## Rules

1. Every native canvas node must reference exactly one canonical object.
2. Canvas node props cannot become canonical semantic truth.
3. Canonical payload changes, including note body `contentBlocks`, must flow through canonical records.
4. Canvas create inputs may provide initial note body blocks, but canvas persistence must not retain them as source-of-truth data in node props/state.
5. Canvas-only visual adjustments must not mutate canonical semantic/content fields.
6. Editable note-like node duplication or cross-document insertion must create a new canonical object in this slice.
7. If a canonical object is tombstoned, canvas resolves it through placeholder behavior instead of copying canonical payload into canvas storage.

## Failure Contract

- canonical reference missing for native node: `CANONICAL_REFERENCE_REQUIRED`
- boundary violation: `CANONICAL_CANVAS_BOUNDARY_VIOLATION`
- editable share without clone: `EDITABLE_CANONICAL_SHARE_REQUIRES_CLONE`
