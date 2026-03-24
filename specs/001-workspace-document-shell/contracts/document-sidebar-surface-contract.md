# Contract: Document Sidebar Surface

## Purpose

Defines the user-facing sidebar information architecture for workspace-first document navigation.

## Surface Sections

1. Workspace switcher
2. Document list
3. Workspace utilities

## Required Guarantees

- Sidebar primary navigation is document list within active workspace scope.
- `New Document` is available as primary call-to-action in document section.
- Empty workspace state is explicit and actionable.
- First-run state without workspace registration is explicit and actionable.
- Legacy TSX/file-tree access is not primary navigation and is treated as compatibility.

## Document List Rules

- Only documents from active workspace are shown.
- Item display prioritizes document title over file path.
- Document open action enters the document's main canvas surface.
- Ordering policy is stable and deterministic (recent-first by default).

## Empty States

- no registered workspace: show create/add workspace actions
- active workspace with no documents: show create document action
- unavailable workspace: show reconnect/remove actions

## Exclusions

- This contract does not define node/object editing controls inside canvas.
- This contract does not define document content schema.
