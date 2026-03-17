# Contract: Canonical Object Persistence

## Purpose

Define the canonical persistence record for native objects.

## Required Fields

- `id`
- `workspaceId`
- `semanticRole`
- `sourceMeta`
- `capabilities`
- `canonicalText`

## Optional Fields

- `primaryContentKind`
- `publicAlias`
- `contentBlocks`
- `capabilitySources`
- `extensions`
- `deletedAt`

## Rules

1. `id` is unique within a workspace, not just within a source scope.
2. Authoring alias is provenance, not canonical storage identity.
3. If `contentBlocks` are present, block ids must be unique within the object.
4. Core block types `text` and `markdown` use first-class validation, while custom blocks must use namespaced block types and structured payloads.
5. `contentBlocks` and direct `capabilities.content` cannot both describe the same editable note body.
6. If `primaryContentKind` is present, it must agree with declared direct content capability kind or the derived projection of built-in `contentBlocks`.
7. `canonicalText` must normalize direct content or flattened ordered `contentBlocks`, using custom block textual projections when available.
8. Capability payload must follow allow-list validation.
9. Editable note-like objects use clone-on-create/duplicate/import semantics; shared editable-note reuse is out of scope for this slice.
10. Non-note canonical objects may be referenced by multiple documents in the same workspace.
11. Canonical deletion is represented as a tombstoned logical record so downstream canvas placeholder resolution remains possible.
12. Persisted record shape must remain stable for mutation/query core consumption and future block-type expansion.

## Failure Contract

- missing source provenance: `SOURCE_PROVENANCE_MISSING`
- workspace id conflict: `CANONICAL_OBJECT_ID_CONFLICT`
- invalid role: `INVALID_CANONICAL_ROLE`
- invalid capability key: `INVALID_CAPABILITY`
- invalid capability payload: `INVALID_CAPABILITY_PAYLOAD`
- content mismatch: `CONTENT_CONTRACT_VIOLATION`
- invalid content block: `INVALID_CONTENT_BLOCK`
- invalid custom block type: `INVALID_CUSTOM_BLOCK_TYPE`
- conflicting note body carriers: `CONTENT_BODY_CONFLICT`
- editable object share requires clone: `EDITABLE_OBJECT_REQUIRES_CLONE`
