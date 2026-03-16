# Contract: Workspace Style Update Flow

## Purpose

Define sequencing, consistency, and rollout-safety rules for workspace style updates in an active editor session.

## Contract surface

- Input events:
  - workspace style input change
  - object render refresh
  - session revision update
  - dev bootstrap start (rollout coexistence check)
- Processing stages:
  - extract -> resolve eligibility -> classify category -> interpret -> apply -> emit diagnostics
- Output effects:
  - updated visual state
  - updated session freshness state
  - optional diagnostics
  - bootstrap coexistence check result (dev path)

## Behavioral guarantees

- Last accepted update wins for each object in a session.
- Style-only updates do not reset unrelated editor context.
- Reopen/rerender preserves last accepted style result.
- Stale updates do not overwrite latest accepted style state.
- Runtime styling rollout does not disable or bypass existing safelist generation/bootstrap path.

## Current implementation notes

- Graph state rebuilds recompute workspace style payloads and diagnostics from node `className` data plus current file revisions.
- Base node rendering consumes the resolved runtime style payload as inline style.
- Development mode exposes a compact diagnostics overlay so unsupported or stale inputs remain visible during editing.

## Out of scope

- Cross-session collaborative conflict resolution
- Multi-user operational transforms
