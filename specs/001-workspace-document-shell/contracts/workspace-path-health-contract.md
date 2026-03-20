# Contract: Workspace Path Health

## Purpose

Defines how the shell detects and handles workspace root path availability.

## Inputs

- workspace health check request
- workspace activation attempt
- reconnect path selection
- remove unavailable workspace action

## Required Guarantees

- Path health is explicit and observable per workspace entry.
- Unavailable state exposes actionable remediation (`reconnect`, `remove`).
- Last known path is retained for diagnostics and user trust.
- Failed reconnect attempts preserve existing metadata and surface failure reason.
- System must not silently switch active workspace or create temporary fallback storage.

## State Model

- `available`
- `unavailable`

## Transition Rules

1. `available` -> `unavailable` when root path validation fails.
2. `unavailable` -> `available` only after successful reconnect.
3. `unavailable` -> removed state when user explicitly removes the entry.

## Exclusions

- This contract does not define physical filesystem migration logic.
- This contract does not define remote or cloud workspace availability.
