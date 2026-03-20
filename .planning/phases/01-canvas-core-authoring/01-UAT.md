---
status: diagnosed
phase: 01-canvas-core-authoring
source:
  - 01-01-SUMMARY.md
  - 01-02-SUMMARY.md
  - 01-03-SUMMARY.md
  - 01-04-SUMMARY.md
  - 01-05-SUMMARY.md
  - 01-06-SUMMARY.md
started: 2026-03-19T13:35:09Z
updated: 2026-03-20T00:03:52Z
---

## Current Test

[testing complete]

## Tests

### 1. Resume or Create into Canvas
expected: Opening the workspace resumes the last active document directly into the canvas, and creating a new document opens an empty canvas with a visible tab immediately. There should be no blocking naming modal or file-list detour before the user can interact with the canvas.
result: pass

### 2. Manipulate a Selected Object
expected: Selecting a canvas object shows the selection shell, and the user can drag, resize, rotate, pan, and zoom without the selection state becoming unstable.
result: skipped
reason: 새 문서에서 도형 생성이 먼저 실패해서 selection shell 조작까지 진행하지 못함

### 3. Create the Core Shape Set
expected: The primary create flow exposes rectangle, ellipse, diamond, text, markdown, line, and sticky. Geometry objects create on canvas, and text, markdown, and sticky enter body editing immediately after creation.
result: issue
reported: "새로운 도큐먼트를 만들었는데 도형 생성에서 실패합니다. 편집 반영에 실패했습니다. 잠시 후 다시 시도해주세요. ENOENT: no such file or directory, open '/Users/danghamo/Documents/gituhb/magam-feature-database-first-canvas-platform/examples/untitled-2.graph.tsx'"
severity: blocker

### 4. Use Contextual Actions and Shortcuts
expected: Single selection shows the compact floating controls, right click opens the context menu, and high-frequency shortcuts such as duplicate, delete, select-all, and zoom work when body editing is not active.
result: issue
reported: "선택한 오브젝트 위에 floating control이 표시되지 않고 위치가 멀리 떨어져 있습니다. 우클릭시 context menu는 잘 표시되고, 단축키는 잘 동작합니다."
severity: major

### 5. Structure Groups and Z-Order
expected: Multi-selection can group and ungroup, enter group focus, unwind with Escape, and use bring-to-front or send-to-back without losing structural selection context.
result: issue
reported: "그룹 이후에도 단일 오브젝트로 선택됩니다. 그래서 group focus가 되지 않습니다."
severity: major

### 6. Edit Object Bodies in Markdown
expected: Text, markdown, and sticky objects re-enter body editing with double click or Enter on desktop, expose an explicit edit affordance on narrow/mobile, suppress floating/context surfaces while editing, and return to the same selected object when a pane click commits the draft.
result: skipped
reason: 오브젝트 생성을 할 수 없어 테스트 불가함

## Summary

total: 6
passed: 1
issues: 3
pending: 0
skipped: 2

## Gaps

- truth: "The primary create flow should create rectangle, ellipse, diamond, text, markdown, line, and sticky objects successfully on a newly created document."
  status: failed
  reason: "User reported: 새로운 도큐먼트를 만들었는데 도형 생성에서 실패합니다. 편집 반영에 실패했습니다. 잠시 후 다시 시도해주세요. ENOENT: no such file or directory, open '/Users/danghamo/Documents/gituhb/magam-feature-database-first-canvas-platform/examples/untitled-2.graph.tsx'"
  severity: blocker
  test: 3
  root_cause: "New documents are registered only as client-side drafts. WorkspaceClient seeds a fake draft sourceVersion and opens the tab, but no .graph.tsx file is created under the MAGAM_TARGET_DIR workspace before the first mutation. The node.create RPC then resolves the relative draft path under examples/ and immediately runs ensureBaseVersion/patchNodeCreate against a file that does not exist, producing ENOENT."
  artifacts:
    - path: "app/components/editor/WorkspaceClient.tsx"
      issue: "createDraftDocumentPath/registerDraftDocument open an empty draft tab and seed draft:empty-canvas state, but never materialize a backing file before edit RPCs."
    - path: "app/hooks/useFileSync.ts"
      issue: "withCommon accepts the draft sourceVersion and forwards node.create with the unresolved draft filePath into the WS mutation pipeline."
    - path: "app/ws/methods.ts"
      issue: "node.create resolves relative file paths under MAGAM_TARGET_DIR and immediately reads the target file for ensureBaseVersion/patchNodeCreate."
  missing:
    - "Materialize a new draft document into a real .graph.tsx file before the first edit mutation, or add a dedicated create-document RPC that does so atomically."
    - "Align draft path generation with the active workspace root and add regression coverage for new-document create -> first shape mutation."
  debug_session: ".planning/debug/01-draft-document-node-create-enoent.md"

- truth: "A single selected object should anchor the compact floating controls close to the object so contextual actions are visually attached to the current selection."
  status: failed
  reason: "User reported: 선택한 오브젝트 위에 floating control이 표시되지 않고 위치가 멀리 떨어져 있습니다. 우클릭 context menu와 keyboard shortcuts는 정상 동작합니다."
  severity: major
  test: 4
  root_cause: "The selection-floating-menu anchor is registered with flow-space minX/minY in anchor.screen, but the overlay host interprets selection-bounds anchors as screen-space coordinates. Because the viewport transform is not applied there, the floating menu drifts away from the selected object after pan/zoom."
  artifacts:
    - path: "app/components/GraphCanvas.tsx"
      issue: "buildSelectionBoundsAnchor stores bounds.minX/minY directly in the selection-floating-menu screen anchor instead of viewport-transformed screen coordinates."
    - path: "app/features/overlay-host/positioning.ts"
      issue: "selection-bounds overlay positioning assumes anchor.x/y/width/height are already screen-space values."
  missing:
    - "Transform selection bounds into screen space before registering the selection-floating-menu anchor."
    - "Add regression coverage for floating-menu placement after pan/zoom so overlay anchors stay aligned with the selection shell."
  debug_session: ".planning/debug/01-selection-floating-menu-anchor-space.md"

- truth: "Grouping should preserve a structural group selection so the user can enter group focus and continue structure-level actions instead of falling back to a single child object selection."
  status: failed
  reason: "User reported: 그룹 이후에도 단일 오브젝트로 선택됩니다. 그래서 group focus가 되지 않습니다."
  severity: major
  test: 5
  root_cause: "The grouping plan only mutates groupId membership on each selected node. It never emits a follow-up runtime selection step that preserves or restores full-group selection. GraphCanvas group-focus entry requires the entire group to already be selected, so the post-group UI falls back to whichever per-node selection ReactFlow keeps, which can collapse to a single node and block enter-group."
  artifacts:
    - path: "app/features/editing/actionRoutingBridge/registry.ts"
      issue: "buildGroupSelectionPlan emits only group-membership mutations and no runtime step to promote the grouped set into a stable structural selection."
    - path: "app/components/GraphCanvas.tsx"
      issue: "resolveGroupFocusEntry refuses to enter group focus unless the full group is already selected."
    - path: "e2e/canvas-core-authoring.spec.ts"
      issue: "The structure browser coverage starts from pre-grouped fixtures and never exercises grouping fresh nodes before attempting group focus."
  missing:
    - "Preserve or restore full grouped selection immediately after selection.group completes, or explicitly transition into group-selection state."
    - "Add browser coverage for grouping a fresh multi-selection and then entering group focus."
  debug_session: ".planning/debug/01-grouping-selection-does-not-promote-group.md"
