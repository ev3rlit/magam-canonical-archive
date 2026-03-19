# Phase 1: Canvas Core Authoring - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Make the `workspace -> document -> canvas -> object` loop feel like a real product: fast direct manipulation, clear contextual actions, minimal shape authoring, keyboard productivity, grouping, and markdown-first object content surfaces. Phase 1 includes only the single-surface markdown-first body entry path, not richer multi-block body composition.

</domain>

<decisions>
## Implementation Decisions

### Entry flow and first-open state
- Default start point is the last active document so users resume directly into canvas work.
- Workspace and document context stays persistently visible in a lightweight way so users always know what they are editing.
- Document switching must stay fast and obvious, but should not dominate the canvas surface.
- Creating a new document should drop the user directly into an empty canvas.
- Document naming should be inline and lightweight after entry, not a blocking pre-canvas step.
- Empty canvas should stay visually light, with only a subtle first-action affordance rather than a heavy onboarding state.

### Selection, manipulation, and action hierarchy
- Direct manipulation should feel Excalidraw-fast, while selected-object actions should feel Miro-like and contextual.
- Selection should expose resize/rotate handles plus a compact floating action surface, not a dense editing shell.
- Floating menu is reserved for high-frequency immediate edits.
- Context menu is reserved for structural or lower-frequency actions.
- Group interaction uses a shell-aware split:
- Desktop allows faster group interior entry via repeat click or double click.
- Mobile requires a more explicit enter-group action.
- Drag thresholds should be input-aware:
- Desktop uses a fast threshold.
- Mobile/touch uses a more conservative threshold.
- Multi-selection floating actions should only expose actions that are safe across the full selection.
- Auto-pan should be more willing during move/drag and more conservative during resize/rotate.
- Escape and empty-canvas click should unwind state progressively:
- Exit content edit first.
- Then collapse inner group focus back to group selection.
- Then clear selection.

### Creation model and minimal shape workflow
- Creation follows object-specific interaction rules rather than one universal rule.
- Rectangle, ellipse, diamond, and sticky support both click-create and drag-create.
- Text uses click-create and enters editing immediately.
- Arrow/line uses drag to define its endpoints.
- After creation, text, markdown, and sticky should enter content editing immediately.
- After creation, geometry-first objects and arrow/line should remain in normal selection state.
- Create tools default to one-shot use, then return to selection mode.
- A deliberate repeat-create mode should exist for power use, rather than forcing persistent creation by default.
- Sticky is treated as an editable container object, not a special-case note primitive.
- In user feel, sticky should still behave like the fastest note-taking object in Phase 1.
- Arrow/line in Phase 1 should stay intentionally simple:
- Start point, end point, basic style, and basic label support are enough.
- Rich connector semantics and stronger attachment behavior are deferred.
- Mobile should keep the same canonical creation rules as desktop, but expose creation affordances and mode transitions more explicitly in the shell.

### Content editing and markdown-first body behavior
- Content editing uses a shell/body split rather than collapsing everything into one mode.
- Text, markdown, and sticky enter editing immediately on creation.
- After creation, content editing should primarily be entered with double click or Enter.
- Desktop may allow faster re-entry shortcuts such as re-click; mobile should prefer explicit entry.
- While body editing is active, text input, cursor navigation, and text-level undo/redo belong to the body editor.
- Only a small set of truly global canvas commands should pass through during content editing.
- Shell manipulation should weaken or disappear during body editing, but the active object should still show a clear “you are editing this object” signal.
- Phase 1 markdown-first means source-first authoring, not rich WYSIWYG editing.
- In non-editing state, rendered markdown should read clearly.
- Content growth should be balanced:
- Respect the current object frame by default.
- Allow small natural growth.
- Expect user resizing or overflow handling once content becomes long.
- Floating menus and context menus should mostly disappear during body editing so the writing state stays stable.
- Exiting content editing should be predictable:
- `Esc` ends editing and returns to the same object selected state.
- Outside click commits editing and keeps the object selected.
- A further empty-canvas click can clear selection.

### Desktop and mobile parity
- Desktop and mobile must share the same canonical editing truth.
- Shell differences are allowed when they reduce accidental gestures or improve clarity on mobile.
- Desktop should optimize for speed and lightness.
- Mobile should make mode transitions and structural entries more explicit.

### Claude's Discretion
- Exact floating action inventory ordering within the “compact/high-frequency” constraint.
- Visual styling of the empty-canvas first-action affordance.
- Exact resize/rotate handle styling and hover treatment.
- Fine-grained thresholds and motion tuning for drag, marquee, and auto-pan.
- Specific overflow presentation for long body content, so long as it respects the balanced growth rule above.

</decisions>

<specifics>
## Specific Ideas

- Direct manipulation baseline should feel closer to Excalidraw.
- Selection-following productivity surfaces should feel closer to Miro.
- The product should feel like a real canvas app immediately after document entry, not like a setup flow.
- Sticky should read as a fast note surface, but still fit the long-term “every object is an editable container” model.
- Markdown-first in Phase 1 should privilege writing markdown source cleanly over rich formatting controls.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope and product direction
- `.planning/ROADMAP.md` — Phase 1 goal, success criteria, and plan breakdown.
- `.planning/PROJECT.md` — Product direction, constraints, and canonical DB-first principles.
- `.planning/REQUIREMENTS.md` — Phase-mapped requirements for authoring, shapes, and markdown-first content.
- `.planning/STATE.md` — Current execution position and active project concerns.

### Milestone framing
- `docs/milestones/R1-external-agent-beta/R1-P0-workspace-document-canvas-authoring-convergence/README.md` — Core authoring benchmark, interaction intent, and product-level baseline for workspace/document/canvas convergence.
- `docs/milestones/R1-external-agent-beta/R1-P0-mobile-full-editing-shell/README.md` — Mobile parity expectations and shell-level differences.

### Architecture constraints
- `docs/adr/ADR-0005-database-first-canvas-platform.md` — Canonical DB-backed product direction and file-first compatibility posture.
- `docs/adr/ADR-0007-canvas-runtime-composition-root-and-fixed-slots.md` — Fixed-slot runtime composition and surface ownership boundaries.
- `docs/adr/ADR-0008-shared-shell-one-time-adoption-via-runtime-bindings.md` — Shell files as binding consumers rather than feature owners.
- `docs/adr/ADR-0009-keyboard-command-boundary-and-pino-tracing.md` — Keyboard boundary separation and command-layer expectations.

### Canvas behavior and surface docs
- `docs/features/database-first-canvas-platform/canvas-ui-entrypoints/README.md` — Toolbar, floating menu, pane menu, and node context menu surface roles.
- `docs/features/object-capability-composition/README.md` — Object-container direction and capability-based object interpretation.
- `docs/features/canvas-editing/README.md` — Existing semantic editing command model and compatibility write-back constraints.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `app/processes/canvas-runtime/createCanvasRuntime.ts`: Fixed-slot runtime already composes toolbar, selection floating menu, pane context menu, and node context menu.
- `app/features/canvas-ui-entrypoints/canvas-toolbar/*`: Existing toolbar sections and create/viewport interaction actions provide the Phase 1 toolbar seam.
- `app/features/canvas-ui-entrypoints/selection-floating-menu/*`: Existing floating action model already supports selection-aware compact controls and homogeneous-selection gating.
- `app/features/canvas-ui-entrypoints/node-context-menu/*`: Existing node menu model already separates lower-frequency contextual actions from primary editing surfaces.
- `app/components/GraphCanvas.viewport.ts`: Per-tab viewport persistence already exists and can support resume-into-document behavior.
- `app/features/editing/createDefaults.ts`: Existing create defaults and suggested ids can seed Phase 1 object creation flows.
- `app/features/editing/commands.ts`: Existing semantic edit command envelopes already cover move, content update, style update, create, rename, and reparent flows.
- `app/components/nodes/renderableContent.tsx`: Markdown rendering already exists for non-editing display state.

### Established Patterns
- Canvas surface behavior is routed through fixed runtime slots and bindings, not by adding new branching directly into shared shell files.
- Selection and floating control exposure already assume capability/editability-based gating rather than raw renderer-name branching.
- Keyboard handling is already isolated behind command/keymap/binding boundaries.
- Graph state already tracks active text editing, viewport state, tab state, selection state, and entrypoint runtime state in one place.
- Editing flows already rely on semantic commands and compatibility mutation boundaries rather than ad-hoc direct writes.

### Integration Points
- `app/components/editor/WorkspaceClient.tsx`: Main integration point for file/document entry, render refresh, dispatch binding, and edit lifecycle.
- `app/store/graph.ts`: Central location for current file, tab activation, viewport restore, selection state, active text editing, and entrypoint runtime state.
- `app/features/editing/editability.ts`: Current editability and style-allowed metadata boundary for deciding safe actions by object type and capability profile.
- `app/processes/canvas-runtime/keyboard/*`: Existing keyboard boundary for Phase 1 shortcut behavior and editing-state passthrough rules.

</code_context>

<deferred>
## Deferred Ideas

- Multiple ordered markdown blocks inside one object body — Phase 2.
- Image/chart/table typed blocks inside object bodies — Phase 2.
- Richer connector semantics and stronger attach/relation behavior for arrows/lines — later phase.
- Rich WYSIWYG or near-WYSIWYG markdown editing — later phase.
- Future interactive `html` / `css` / `javascript` blocks — Phase 3 direction, not Phase 1.

</deferred>

---

*Phase: 01-canvas-core-authoring*
*Context gathered: 2026-03-19*
