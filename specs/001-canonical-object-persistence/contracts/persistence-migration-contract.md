# Contract: Persistence Migration Baseline

## Purpose

Define minimum migration guarantees for canonical object persistence.

## Guarantees

1. Fresh migration path creates canonical object, relation, canvas node, binding, and revision-supporting tables.
2. Required canonical fields are non-null where mandated by the persistence contract.
3. Workspace-scoped canonical identity is enforced.
4. Ordered note body storage (`content_blocks`) is available for editable note-like canonical objects.
5. Relation endpoints are validated against existing canonical object rows.
6. Canonical delete/tombstone support is available without breaking placeholder resolution for existing canvas references.
7. Local embedded profile and production-compatible profile share the same logical schema intent.
8. Migration output is sufficient for next-slice mutation/query planning, including note-body block mutations and clone-on-create semantics.

## Verification

- migration apply on clean database
- canonical object write/read smoke path
- editable note-like object write/read smoke path with `content_blocks`
- native node write with canonical reference enforcement
- relation rejection when endpoint is missing
- tombstoned object placeholder resolution path

## Failure Contract

- schema init failure: `PERSISTENCE_SCHEMA_INIT_FAILED`
- missing required field contract: `PERSISTENCE_REQUIRED_FIELD_MISSING`
- note body column/shape missing: `PERSISTENCE_NOTE_BODY_SCHEMA_MISSING`
- relation endpoint missing: `RELATION_ENDPOINT_MISSING`
- tombstone resolution broken: `TOMBSTONE_PLACEHOLDER_RESOLUTION_FAILED`
