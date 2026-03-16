# Contract: Workspace Style Diagnostics

## Purpose

Specify minimum diagnostic behavior for unsupported objects/categories/tokens, mixed input, and stale updates.

## Contract surface

- Diagnostic fields:
  - `objectId`
  - `code` (`OUT_OF_SCOPE_OBJECT | UNSUPPORTED_CATEGORY | UNSUPPORTED_TOKEN | MIXED_INPUT | STALE_UPDATE`)
  - `message`
  - optional `token`
  - optional `category`
  - severity level
  - revision marker

## Behavioral guarantees

- Unsupported inputs always produce diagnosable output.
- Diagnostics reflect latest relevant input revision.
- Mixed input diagnostics preserve context for ignored categories/tokens.
- Diagnostics are replaced or cleared when corrected input is applied.
- Stale updates emit diagnostics without mutating latest accepted style state.
- Out-of-scope objects emit `OUT_OF_SCOPE_OBJECT`.
- Unsupported categories emit `UNSUPPORTED_CATEGORY`.
- Tokens that belong to a known category but are not currently supported emit `UNSUPPORTED_TOKEN`.

## Current implementation notes

- Diagnostics are flattened into a short editor overlay summary in development mode.
- Diagnostics are stored per object and recomputed from the latest accepted runtime style evaluation.

## Out of scope

- Global observability platform integration details
- Analytics telemetry schema design
