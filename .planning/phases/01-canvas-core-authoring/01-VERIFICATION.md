---
phase: 01-canvas-core-authoring
verified: 2026-03-20T00:39:42Z
status: gaps_found
score: 4/5 must-haves verified
gaps:
  - truth: "Every Phase 1 object exposes an editable content surface with markdown as the default body entry point."
    status: failed
    reason: "Text, markdown, and sticky nodes use the shared markdown-first text-edit session, but shape nodes still render as fixed shells and the shared body-session resolver explicitly excludes them."
    artifacts:
      - path: "app/components/nodes/renderableContent.tsx"
        issue: "`resolveBodyEditSession` returns `null` unless the node type is `text`, `markdown`, or `sticky`, so Phase 1 shapes never enter the shared body-edit lifecycle."
      - path: "app/components/nodes/ShapeNode.tsx"
        issue: "Shape nodes render label/read content only and expose no explicit edit affordance, textarea, or markdown-first body entry path."
      - path: "app/components/nodes/renderableContent.test.tsx"
        issue: "Regression coverage currently locks the gap in by asserting `resolveBodyEditSession` returns `null` for `shape` nodes."
    missing:
      - "Add a shared editable content surface for Phase 1 shape nodes."
      - "Route shape content entry through the same markdown-first text-edit session used by text, markdown, and sticky nodes."
      - "Extend unit and browser coverage so shape objects can enter, edit, and commit markdown-first content without breaking selection state."
---

# Phase 01: Canvas Core Authoring Verification Report

**Phase Goal:** Make the database-backed canvas authoring loop feel fast, legible, and complete enough to stand beside Excalidraw-style core manipulation while using Miro-style contextual actions for selected objects.
**Verified:** 2026-03-20T00:39:42Z
**Status:** gaps_found
**Re-verification:** No - initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | User can create or open a document and immediately pan, zoom, select, drag, resize, rotate, and group objects through a smooth primary flow. | ✓ VERIFIED | `app/components/editor/WorkspaceClient.tsx`, `app/components/GraphCanvas.tsx`, `app/hooks/useFileSync.ts`, and `e2e/canvas-core-authoring.spec.ts` now cover entry, viewport, grouping, and fresh-document mutation flow. |
| 2 | User can create rectangle, ellipse, diamond, text, arrow/line, and sticky objects and edit them through toolbar, floating actions, and a Miro-style context menu. | ✓ VERIFIED | `app/features/editing/createDefaults.ts`, `app/features/canvas-ui-entrypoints/selection-floating-menu/selectionModel.ts`, `app/features/canvas-ui-entrypoints/node-context-menu/nodeMenuItems.ts`, and `e2e/canvas-core-authoring.spec.ts` cover the creation catalog plus contextual surfaces. |
| 3 | User can use keyboard shortcuts for the high-frequency canvas actions without breaking selection or editing state. | ✓ VERIFIED | `app/processes/canvas-runtime/keyboard/keymap.ts`, `app/processes/canvas-runtime/keyboard/commands.ts`, `app/processes/canvas-runtime/bindings/keyboardHost.ts`, and `app/processes/canvas-runtime/keyboard/dispatchKeyCommand.test.ts` wire delete, duplicate, group, ungroup, copy, paste, undo, redo, select-all, and zoom through the shared host. |
| 4 | Every object exposes an editable content surface with markdown as the default body entry point. | ✗ FAILED | `app/components/nodes/renderableContent.tsx` excludes `shape` from `resolveBodyEditSession`, `app/components/nodes/ShapeNode.tsx` has no body-entry path, and `app/components/nodes/renderableContent.test.tsx` asserts the current limitation. |
| 5 | Desktop and mobile share the same canonical editing truth even if shell-level UI differs. | ✓ VERIFIED | `app/store/graph.ts` owns the shared text-edit session state, while `app/components/nodes/TextNode.tsx`, `app/components/nodes/MarkdownNode.tsx`, `app/components/nodes/StickyNode.tsx`, and `app/components/GraphCanvas.tsx` vary only the entry affordance. |

**Score:** 4/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `app/components/editor/WorkspaceClient.tsx` | Entry orchestration, create/open, mutation routing | ✓ VERIFIED | Creates real untitled documents via `/api/files`, reopens tabs, and routes structural/content mutations through the shared bridge. |
| `app/components/GraphCanvas.tsx` | Viewport, selection, shell, grouping, keyboard host | ✓ VERIFIED | Hosts drag/resize/rotate, selection anchors, group focus, and shared keyboard handling. |
| `app/features/editing/createDefaults.ts` | Minimal Phase 1 creation catalog | ✓ VERIFIED | Includes rectangle, ellipse, diamond, line, text, markdown, sticky, sticker, washi-tape, and image defaults. |
| `app/processes/canvas-runtime/keyboard/keymap.ts` | Phase 1 shortcut bindings | ✓ VERIFIED | Binds delete, duplicate, group, select-all, undo, redo, copy, paste, zoom, and ungroup. |
| `app/components/nodes/renderableContent.tsx` | Shared markdown-first body-session resolver | ⚠️ ORPHANED | Substantive for text/markdown/sticky, but incomplete for Phase 1 shapes because `shape` never resolves a body-edit session. |
| `app/components/nodes/ShapeNode.tsx` | Shape content surface | ✗ STUB | Renders label/read content only; there is no explicit edit affordance or shared body-session entry. |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `app/components/editor/WorkspaceClient.tsx` | `app/app/api/files/route.ts` | `createWorkspaceDocument` / `POST /files` | ✓ WIRED | New untitled documents materialize through the HTTP proxy before the tab opens. |
| `app/components/GraphCanvas.tsx` | `app/processes/canvas-runtime/bindings/keyboardHost.ts` | `createGraphCanvasKeyboardHost` / window `keydown` | ✓ WIRED | Shared keyboard host owns delete/duplicate/group/clipboard/history/zoom dispatch. |
| `app/processes/canvas-runtime/bindings/keyboardHost.ts` | `app/components/editor/WorkspaceClient.tsx` | `onUndoEditStep` / `onRedoEditStep` | ✓ WIRED | Undo/redo first target edit history from `WorkspaceClient`, then fall back to clipboard history. |
| `app/components/GraphCanvas.tsx` | `app/features/canvas-ui-entrypoints/selection-floating-menu/selectionModel.ts` | `activeTextEditNodeId` / selection-floating-menu suppression | ✓ WIRED | Contextual controls now suppress during body editing and selection anchors use shared screen-space bounds. |
| `app/components/nodes/renderableContent.tsx` | `app/components/nodes/ShapeNode.tsx` | `resolveBodyEditSession` / markdown-first body entry | ✗ NOT_WIRED | The shared body-entry contract does not attach to shape nodes, so the phase-wide content-surface truth is incomplete. |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| AUTH-01 | 01-01, 01-07 | Create, open, and switch database-backed workspaces/documents | ✓ SATISFIED | `WorkspaceClient.tsx` resume/open flow, `/api/files` document creation, and entry e2e coverage. |
| AUTH-02 | 01-02 | Pan and zoom smoothly | ✓ SATISFIED | `GraphCanvas.tsx` viewport host plus viewport regression coverage. |
| AUTH-03 | 01-02, 01-05 | Predictable marquee/multi-select/deselect | ✓ SATISFIED | Selection shell, store selection state, and structure/viewport tests. |
| AUTH-04 | 01-02, 01-05 | Direct manipulation of selected objects | ✓ SATISFIED | Drag, resize, rotate, and group-selection action routing all land in the shared mutation path. |
| AUTH-05 | 01-02 | Visible resize/rotate handles | ✓ SATISFIED | `GraphCanvas.tsx` selection shell plus viewport e2e assertions. |
| AUTH-06 | 01-04, 01-05 | Core keyboard shortcuts for delete, duplicate, copy/paste, undo/redo, select-all, zoom, grouping | ✓ SATISFIED | `keymap.ts`, `commands.ts`, `keyboardHost.ts`, `dispatchKeyCommand.test.ts`, and GraphCanvas host wiring cover the shortcut boundary. |
| AUTH-07 | 01-05, 01-08 | Group/ungroup and basic z-order behavior | ✓ SATISFIED | `registry.ts`, `GraphCanvas.tsx`, and fresh-group browser coverage now preserve structural selection and group focus. |
| SHAP-01 | 01-03 | Core shape set from primary creation flow | ✓ SATISFIED | `createDefaults.ts` and browser create coverage expose rectangle/ellipse/diamond/line/text/markdown/sticky. |
| SHAP-02 | 01-04 | Quick-edit style/geometry through toolbar/floating/contextual surfaces | ✓ SATISFIED | Floating menu model plus selection-style commit path cover style/geometry quick edits. |
| SHAP-03 | 01-04 | Miro-style context menu as a primary productivity surface | ✓ SATISFIED | `nodeMenuItems.ts` and structure/actions browser coverage show structural and contextual menu actions. |
| SHAP-04 | 01-06 | Desktop/mobile share the same canonical editing truth | ? NEEDS HUMAN | Shared text-edit store exists, but real mobile shell parity still needs manual device-level confirmation. |
| BODY-01 | 01-06 | Every object exposes an editable content surface | ✗ BLOCKED | Shape nodes still have no body-entry path and the shared resolver explicitly excludes them. |
| BODY-02 | 01-06 | Markdown is the default object-content authoring mode | ✗ BLOCKED | Markdown-first editing exists only for text/markdown/sticky, so the phase-wide object-content claim is incomplete. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| `app/components/editor/WorkspaceClient.test.tsx` | 102 | `it.todo(...)` entry-convergence tests remain open | ⚠️ Warning | Unit-level regression coverage for the entry flow is still incomplete even though browser coverage exists. |
| `app/components/editor/WorkspaceClient.test.tsx` | 646 | `it.todo(...)` duplicate entry-convergence placeholders remain open | ⚠️ Warning | The same missing test coverage appears again in the later suite block, increasing ambiguity about intended coverage ownership. |

### Human Verification Required

### 1. Mobile body-entry parity

**Test:** On a narrow viewport or coarse-pointer device, select text, markdown, and sticky nodes and use the explicit `Edit` affordance to enter, commit, and cancel body editing.
**Expected:** The same underlying document state changes as desktop, with only the entry affordance differing.
**Why human:** Device-class affordance behavior and touch ergonomics are not fully covered by the existing automated suite.

### 2. Direct-manipulation feel

**Test:** In the live app, create a new untitled document, add a few objects, then pan, zoom, resize, rotate, group, and reopen group focus without pausing between steps.
**Expected:** The floating controls stay visually attached, selection state remains stable, and the interaction feels smooth rather than mechanically correct but awkward.
**Why human:** Interaction smoothness and visual attachment quality are only partially approximated by unit and browser assertions.

### Gaps Summary

Phase 01 closes the original UAT blockers around untitled-document creation, floating selection anchoring, and fresh-group structural continuity. The remaining blocker is narrower but still phase-level: the codebase does not yet make **every** Phase 1 object editable through the shared markdown-first content flow. Text, markdown, and sticky nodes satisfy the intended shell/body contract, but shapes still behave as fixed shells with style controls only. Until the shape path is brought onto the same body-edit contract, the phase goal is incomplete and `BODY-01` / `BODY-02` remain blocked.

---

_Verified: 2026-03-20T00:39:42Z_
_Verifier: Claude (gsd-verifier)_
