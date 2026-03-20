# Contract: Workspace Registry

## Purpose

Defines how workspace entries are created, updated, listed, and removed in app-level registry state.

## Inputs

- create workspace from local path
- add existing workspace path
- rename display name
- remove workspace entry
- resolve registry list for switcher

## Required Guarantees

- Registry supports multiple workspace entries.
- Each entry has a stable workspace identifier.
- Duplicate entries for effectively same path are prevented by normalization policy.
- Registry actions produce explicit success/failure outcomes.
- Removing an entry does not silently delete workspace-local content.

## Output Shape

- `workspaceId`
- `displayName`
- `rootPath`
- `status`
- `lastOpenedAt`
- `lastActiveDocumentId` (optional)

## Exclusions

- This contract does not define document mutation behavior.
- This contract does not define cloud sync or remote sharing.
