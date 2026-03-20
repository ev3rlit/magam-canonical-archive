# Research: Workspace Registry + Document Sidebar

## Decision 1: Workspace identity uses stable workspace ID with root-path binding

- **Decision**: Treat workspace as a logical entity with stable `workspaceId` and current `rootPath`, not as raw folder name.
- **Rationale**: Folder names collide easily and do not survive rename/move workflows; logical IDs support reconnect and reliable session restore.
- **Alternatives considered**:
  - Folder basename identity only: rejected due to collision and rename fragility.
  - Full path as sole identity: rejected because moved paths cannot be reconnected without losing history.

## Decision 2: Split app registry metadata from workspace-local persisted data

- **Decision**: Keep lightweight registry/session metadata at app level and keep authoring data in workspace-local persisted store.
- **Rationale**: This preserves local ownership and keeps cross-workspace switching cheap without loading full document payloads.
- **Alternatives considered**:
  - Store everything app-globally: rejected due to ownership ambiguity and portability loss.
  - Store everything only per-workspace with no registry metadata: rejected due to poor startup/switch UX.

## Decision 3: Single active workspace session in v1

- **Decision**: Allow multiple registered workspaces but only one active session at runtime.
- **Rationale**: It minimizes state contamination risk in current shell/store architecture while enabling practical multi-project workflows.
- **Alternatives considered**:
  - Multi-active in one window: rejected for v1 complexity and conflict risk.
  - Single registered workspace only: rejected because it does not meet product direction for reusable local workspaces.

## Decision 4: Sidebar primary surface is document list, not file tree

- **Decision**: Make document list the default navigation surface and move file-tree behavior to compatibility/import pathways.
- **Rationale**: This aligns the shell with workspace->document->canvas flow and reduces file-first mental model drift.
- **Alternatives considered**:
  - Keep file tree as first-class with document tab overlay: rejected as mixed mental model.
  - Remove all file visibility immediately: rejected to preserve transition safety.

## Decision 5: Explicit unavailable-path handling without silent fallback

- **Decision**: Missing/inaccessible workspace paths must be shown as unavailable and handled via reconnect/remove actions.
- **Rationale**: Silent fallback can hide data location failures and damage user trust in local ownership.
- **Alternatives considered**:
  - Auto-switch to another workspace silently: rejected due to ambiguous scope changes.
  - Auto-create temporary workspace: rejected because it hides storage location changes.

## Decision 6: Legacy TSX remains compatibility surface only

- **Decision**: Keep legacy TSX path available for import/reference while excluding it from primary authoring navigation.
- **Rationale**: It supports transition safety without blocking database-first shell adoption.
- **Alternatives considered**:
  - Remove legacy path immediately: rejected due to migration risk.
  - Keep legacy and document paths equal in sidebar: rejected due to product-direction conflict.
