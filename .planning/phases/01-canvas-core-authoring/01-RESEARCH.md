# Phase 1: Canvas Core Authoring - Research

**Researched:** 2026-03-19
**Domain:** Database-backed canvas authoring on the existing Next.js + React Flow + canonical mutation/runtime stack
**Confidence:** MEDIUM

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
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

### Deferred Ideas (OUT OF SCOPE)
- Multiple ordered markdown blocks inside one object body — Phase 2.
- Image/chart/table typed blocks inside object bodies — Phase 2.
- Richer connector semantics and stronger attach/relation behavior for arrows/lines — later phase.
- Rich WYSIWYG or near-WYSIWYG markdown editing — later phase.
- Future interactive `html` / `css` / `javascript` blocks — Phase 3 direction, not Phase 1.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AUTH-01 | User can create, open, and switch database-backed workspaces and documents through the primary app flow | Entry planning must bridge current `WorkspaceClient`/tabs shell with canonical workspace-document persistence, not add a second parallel shell. |
| AUTH-02 | User can pan and zoom the canvas smoothly with mouse, trackpad, and keyboard shortcuts | Keep React Flow viewport primitives, persist per-tab viewport in `app/store/graph.ts`, and route keyboard through `processes/canvas-runtime/keyboard`. |
| AUTH-03 | User can marquee-select, multi-select, and deselect objects predictably on the canvas | Use React Flow selection primitives plus store-owned selection state and overlay-anchor cleanup rules. |
| AUTH-04 | User can drag selected objects directly on the canvas, including multi-selection movement | Keep drag interpretation in `GraphCanvas` -> semantic command routing -> WS mutation path; do not bypass action routing or source-version tracking. |
| AUTH-05 | User can resize and rotate selected objects through visible handles | Plan a feature-owned handle/overlay layer; no existing dedicated resize/rotate surface is wired today. |
| AUTH-06 | User can use core keyboard shortcuts for delete, duplicate, copy/paste, undo/redo, select all, zoom, and grouping | Extend the existing keymap/command/trace boundary instead of adding DOM branching inside `GraphCanvas`. |
| AUTH-07 | User can group and ungroup objects and preserve basic z-order behavior | Use canonical relation/editability metadata and one command surface for group semantics; current code only partially models group context. |
| SHAP-01 | User can create rectangle, ellipse, diamond, text, arrow/line, and sticky objects from the primary creation flow | Expand current create inventory and payload contracts without inventing a second creation subsystem. |
| SHAP-02 | User can quick-edit object style and geometry through toolbar, floating actions, or contextual actions without opening a hidden inspector-first flow | Reuse runtime slots: toolbar for mode/global actions, floating menu for high-frequency edits, context menu for low-frequency structural actions. |
| SHAP-03 | User can use a Miro-style context menu for selected objects as a primary productivity surface | Existing node-context-menu model already separates structural actions by canonical metadata; planner should build on that. |
| SHAP-04 | User can complete the core authoring loop on both desktop and mobile shells with the same canonical editing truth | Shell differences are allowed, but action routing, editability, and persistence must stay shared. |
| BODY-01 | Every object exposes an editable content surface instead of behaving like a fixed visual shell only | Keep the object-capability model and store-managed text edit session; do not special-case only text nodes. |
| BODY-02 | User can write markdown inside an object's content area as the default text authoring mode | Phase 1 should stay source-first markdown editing with rendered markdown in display state, using existing `react-markdown` rendering. |
</phase_requirements>

## Summary

Phase 1 is a brownfield authoring phase, not a blank-canvas implementation. The planner should assume the repo already has the critical seams: a fixed-slot canvas runtime (`app/processes/canvas-runtime`), feature-owned toolbar/floating/context menu contributions, a centralized graph store with viewport/selection/text-edit state, semantic edit command builders, a WS mutation bridge, and a growing canonical persistence layer built on Drizzle + PGlite. The right plan extends those seams; it does not replace them with a new editor stack.

The main planning risk is authority drift. Product direction and ADR-0005 say canonical DB is the primary product truth, but the live app still routes most mutations through `useFileSync` -> `app/ws/methods.ts` -> `app/ws/filePatcher.ts`. For Phase 1, every plan must pick one authoritative write path per behavior and keep the other path adapter-only. If a plan touches entry/lifecycle (`AUTH-01`), it should explicitly decide how the existing file/tabs shell maps to database-backed workspaces/documents before adding more authoring behavior on top.

The second major planning constraint is boundary discipline. ADR-0007/0008/0009 already moved toolbar, floating menu, context menu, and keyboard handling behind runtime slots and bindings. Phase 1 should keep adding behavior in feature-owned contribution files, model builders, and command routing. Directly expanding `GraphCanvas.tsx` or `WorkspaceClient.tsx` with new branching should be treated as a last resort, because it fights the repo's current architecture and will make later plans harder to parallelize safely.

**Primary recommendation:** Plan Phase 1 as six focused slices that extend the existing runtime/binding/command seams, and force an explicit write-authority decision at the start of `AUTH-01` work.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `reactflow` | `11.11.4` | Canvas viewport, node/edge rendering, selection, drag, pan/zoom primitives | Already wired across `GraphCanvas`, store types, clipboard helpers, and tests; replacing it is unnecessary scope. |
| `zustand` | `5.0.10` | Central graph/editor runtime state | Existing source of truth for tabs, viewport restore, selection, text-edit mode, and entrypoint runtime state. |
| `react-markdown` | `10.1.0` | Render markdown bodies in non-editing mode | Matches Phase 1's source-first markdown requirement without introducing a rich-text stack. |
| `remark-gfm` | `4.0.1` | GitHub-flavored markdown support | Needed to keep markdown display legible and predictable for tables, task lists, links, and strikethrough. |
| `drizzle-orm` + `@electric-sql/pglite` | `0.44.5` + `0.3.8` in repo | Canonical persistence layer for workspace/document/object data | Already present in `libs/shared`; Phase 1 should build against these contracts where it touches DB-backed entry/lifecycle. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `lucide-react` | `0.563.0` | Toolbar, floating action, and context-menu icons | Keep current icon inventory and tests stable; no icon-system migration in Phase 1. |
| `pino` | `10.3.0` | Structured keyboard tracing | Reuse only through `processes/canvas-runtime/keyboard/trace.ts` per ADR-0009. |
| `@babel/parser` / `@babel/traverse` / `@babel/generator` | `7.29.0` | AST patch path for compatibility edits | Only via `app/ws/filePatcher.ts`; do not introduce string-based file edits. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Existing `reactflow` v11 workspace integration | Migrating now to `@xyflow/react` v12 | Upstream has moved, but a Phase 1 migration would mix platform churn with authoring delivery. Keep migration separate. |
| Existing overlay-host + runtime-slot surfaces | React Flow `NodeToolbar`/ad hoc per-node overlays | Repo already standardized on slot/binding ownership; ad hoc overlays would reintroduce shell hotspots. |
| Source-first markdown editing | Tiptap/Slate/ProseMirror | Phase 1 explicitly defers rich WYSIWYG; adding a rich editor stack increases mode conflict and scope. |

**Installation:**
```bash
# No new packages are required for the recommended Phase 1 path.
# Use the workspace-installed stack already declared in package.json and app/package.json.
```

**Version verification:** Checked on 2026-03-19 with `npm view`.

| Package | Repo Version | Latest Verified | Latest Publish Date | Planning Guidance |
|---------|--------------|----------------|---------------------|------------------|
| `reactflow` | `11.11.4` | `11.11.4` | 2024-06-20 | Safe to stay on current line during Phase 1. |
| `react-markdown` | `10.1.0` | `10.1.0` | 2025-03-07 | Already current. |
| `remark-gfm` | `4.0.1` | `4.0.1` | 2025-02-10 | Already current. |
| `zustand` | `5.0.10` | `5.0.12` | 2026-03-16 | Do not upgrade unless a bug fix is required. |
| `@electric-sql/pglite` | `0.3.8` | `0.4.0` | 2026-03-17 | Keep current unless Phase 1 explicitly needs a 0.4-only fix. |
| `drizzle-orm` | `0.44.5` | `0.45.1` | 2025-12-10 | Same guidance as PGlite. |
| `lucide-react` | `0.563.0` | `0.577.0` | 2026-03-04 | Not worth touching for this phase. |
| `next` | `15.1.6` | `16.2.0` | 2026-03-18 | Framework upgrade is out of scope. |

## Architecture Patterns

### Recommended Project Structure
```text
app/
├── components/
│   ├── GraphCanvas.tsx                  # React Flow host and overlay wiring consumer
│   └── editor/WorkspaceClient.tsx       # Workspace/document shell and dispatch consumer
├── features/
│   ├── canvas-ui-entrypoints/           # Toolbar, floating menu, pane, node context menu models
│   ├── editing/                         # Editability, semantic commands, action routing
│   ├── overlay-host/                    # Shared overlay positioning and lifecycle
│   └── render/                          # Render-graph to canvas/canonical metadata interpretation
├── processes/
│   └── canvas-runtime/                  # Fixed-slot composition root, bindings, keyboard boundary
├── store/
│   └── graph.ts                         # Selection, viewport, text-edit, tabs, runtime state
└── ws/
    ├── methods.ts                       # RPC mutation methods
    └── filePatcher.ts                   # Compatibility AST patch path

libs/shared/src/lib/canonical-persistence/
├── pglite-db.ts                         # Canonical DB handle + migrations
└── repository.ts                        # Workspace/document/object persistence contracts
```

### Pattern 1: Fixed-Slot Runtime Composition
**What:** Toolbar, selection floating menu, pane context menu, and node context menu are assembled through `createCanvasRuntime()` and feature-owned `contribution.ts` files.
**When to use:** Any new authoring surface, action inventory, or shortcut that belongs to a canvas entrypoint.
**Example:**
```typescript
import toolbar from '@/features/canvas-ui-entrypoints/canvas-toolbar/contribution';
import floating from '@/features/canvas-ui-entrypoints/selection-floating-menu/contribution';
import nodeMenu from '@/features/canvas-ui-entrypoints/node-context-menu/contribution';

export function createCanvasRuntime() {
  return {
    slots: {
      canvasToolbar: createCanvasToolbarSlot(toolbar),
      selectionFloatingMenu: createSelectionFloatingMenuSlot(floating),
      nodeContextMenu: createNodeContextMenuSlot(nodeMenu),
    },
  };
}
```
Source: repo pattern adapted from `app/processes/canvas-runtime/createCanvasRuntime.ts`.

### Pattern 2: Semantic Intent Routing, Not Direct UI Mutation
**What:** UI surfaces emit intents and semantic commands; bindings and action routing decide runtime-only actions vs persisted mutations.
**When to use:** Create, rename, duplicate, style/content updates, group actions, and any future resize/rotate/group commands.
**Example:**
```typescript
const envelope = {
  surfaceId: 'selection-floating-menu',
  intentId: 'selection.style.update',
  selectionRef: { selectedNodeIds, currentFile },
  targetRef,
  payload,
};

await executeBridgeIntent(envelope);
```
Source: repo pattern adapted from `app/processes/canvas-runtime/bindings/actionDispatch.ts`.

### Pattern 3: Shell/Body Split Through Store-Owned Text Edit State
**What:** Body editing is an explicit store session (`activeTextEditNodeId`, `textEditDraft`, `textEditMode`) rather than a side effect of selection alone.
**When to use:** Entering/exiting markdown editing, suppressing overlays during writing, and deciding which shortcuts pass through.
**Example:**
```typescript
startTextEditSession({ nodeId, mode: 'markdown-source', initialDraft: initialMarkdown });
updateTextEditDraft(nextMarkdown);
requestTextEditCommit(nodeId);
clearTextEditSession();
```
Source: repo pattern adapted from `app/store/graph.ts`; Phase 1 should keep this model but use a source-first markdown mode.

### Pattern 4: Overlay Anchors Follow Selection, Not Individual Components
**What:** Floating surfaces are positioned from registered anchors in runtime state, including a computed selection-bounds anchor.
**When to use:** Selection floating menu, resize/rotate handles, group shells, and mobile-specific contextual affordances.
**Example:**
```typescript
const anchor = buildSelectionBoundsAnchor({
  selectedNodes,
  viewport: getViewport(),
});

if (anchor) registerEntrypointAnchor(anchor);
```
Source: repo pattern adapted from `app/components/GraphCanvas.tsx`.

### Anti-Patterns to Avoid
- **Editing directly in `GraphCanvas.tsx` or `WorkspaceClient.tsx` first:** ADR-0007/0008 explicitly moved feature ownership to bindings and contribution files.
- **Raw renderer/tag-name branching for action gating:** Use canonical metadata + editability/capability profiles instead.
- **A second mutation path for the same behavior:** If a feature writes both canonical DB and AST patcher independently, conflict semantics and tests will diverge.
- **Rich-text editor creep:** Phase 1 is markdown-source editing, not WYSIWYG.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Entry-point overlay lifecycle | Per-component popover state and manual positioning math | `app/features/overlay-host` + entrypoint anchors/runtime state | Dismiss, focus restore, viewport clamping, and replacement logic already exist. |
| Action gating | `if (node.type === ...)` condition sprawl | `editability.ts`, capability profiles, and `resolveNodeActionRoutingContext()` | Keeps behavior aligned with canonical metadata and future object families. |
| Keyboard orchestration | DOM event branching inside canvas components | `processes/canvas-runtime/keyboard/*` + `bindings/keyboardHost.ts` | ADR-0009 already standardized key normalization, command dispatch, and tracing. |
| File mutation | String replacement or ad hoc TSX rewrites | `app/ws/filePatcher.ts` semantic patchers | Existing AST patch path enforces content contracts, collision checks, and RPC error codes. |
| Rich markdown editing | Tiptap/Slate/ProseMirror for Phase 1 | Store-managed source editor + `react-markdown` display rendering | Fits the locked Phase 1 requirement and avoids shell/body conflict explosion. |
| Custom canvas engine | Replacing current viewport/selection primitives | React Flow + current store/runtime bindings | Existing tests and bindings already depend on it; replacement is unjustified scope. |

**Key insight:** The expensive problems in this phase are ownership, mode conflict, and mutation authority. The repo already has infrastructure for those. The planner should spend implementation effort on user behavior, not on rebuilding editor substrate.

## Common Pitfalls

### Pitfall 1: Reopening the Source-of-Truth Debate Inside Feature Work
**What goes wrong:** One plan writes file patches, another writes canonical DB rows, and the phase ends with two partial authorities.
**Why it happens:** The repo is explicitly transitional and both paths are live.
**How to avoid:** Make each plan state its authoritative write path and adapter path before task breakdown. `AUTH-01` should resolve this first.
**Warning signs:** The same requirement adds logic to both `app/ws/methods.ts` and `libs/shared/src/lib/canonical-persistence/*` without a convergence story.

### Pitfall 2: Violating the Runtime Slot/Binding Boundary
**What goes wrong:** New toolbar/menu/keyboard behavior is hard-coded into shared shell files.
**Why it happens:** `GraphCanvas.tsx` and `WorkspaceClient.tsx` are large and tempting to patch directly.
**How to avoid:** Default to contribution/model/binding files; touch shell consumers only to wire existing contracts.
**Warning signs:** New `switch` statements in `GraphCanvas.tsx` for toolbar/menu ownership or DOM-level keyboard handling.

### Pitfall 3: Treating Multi-Block Body Work as Phase 1
**What goes wrong:** BODY-03/BODY-05 work leaks into Phase 1 and blows up scope.
**Why it happens:** Older milestone docs mention Notion-style multi-block bodies, but the current phase context explicitly defers them.
**How to avoid:** Phase 1 body editing is one markdown-first content surface per object with shell/body separation.
**Warning signs:** Tasks mention block lists, table/image embeds, slash commands, or WYSIWYG plugins.

### Pitfall 4: Keyboard and Text Editing Collide
**What goes wrong:** Global shortcuts fire during body editing, or text-level undo/redo is swallowed by canvas history.
**Why it happens:** The canvas has both global commands and object-local writing state.
**How to avoid:** Route only a tiny allowlist of true global commands through while `activeTextEditNodeId` is set; let the body editor own text navigation and text undo/redo.
**Warning signs:** Esc/click-outside behavior becomes inconsistent, or body editing clears selection unexpectedly.

### Pitfall 5: Heterogeneous Multi-Selection Exposes Unsafe Actions
**What goes wrong:** Floating actions appear for selections where some nodes cannot accept the patch.
**Why it happens:** The phase requires Miro-style compact controls, which can tempt broad exposure.
**How to avoid:** Keep the existing homogeneous-selection gating in `selectionModel.ts` and extend it with capability-based checks.
**Warning signs:** Multi-select actions need special per-node fallback logic or partial failures.

### Pitfall 6: Mobile Gets a Different Editing Truth
**What goes wrong:** Desktop and mobile diverge in command semantics or persistence behavior.
**Why it happens:** Mobile needs more explicit affordances, so it is tempting to fork behavior rather than shell presentation.
**How to avoid:** Share action routing, editability, and persistence; only fork affordance/entry patterns.
**Warning signs:** Mobile-specific mutation handlers, menu inventories, or edit modes start duplicating business logic.

### Pitfall 7: Existing Placeholder Enums Masquerade as Real Product Direction
**What goes wrong:** The current `textEditMode` value `'markdown-wysiwyg'` drags Phase 1 into rich editing by implication.
**Why it happens:** Internal naming got ahead of the locked product scope.
**How to avoid:** Treat Phase 1 as markdown-source editing and normalize mode naming if touched.
**Warning signs:** Tasks begin to justify preview-in-editor, toolbar formatting, or rich-text selection behaviors.

## Code Examples

Verified patterns to follow:

### Canvas Runtime Assembly
```typescript
const runtime = createCanvasRuntime({
  contributions: {
    canvasToolbar,
    selectionFloatingMenu,
    paneContextMenu,
    nodeContextMenu,
  },
});
```
Source: repo pattern from `app/processes/canvas-runtime/createCanvasRuntime.ts`.

### Capability-Aware Node Routing Context
```typescript
const nodeContext = resolveNodeActionRoutingContext(
  node,
  currentFile,
  selectedNodeIds,
);

if (!nodeContext.editability.allowedCommands.includes('node.rename')) {
  return;
}
```
Source: repo pattern from `app/components/editor/workspaceEditUtils.ts`.

### Markdown Rendering With GFM
```typescript
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export function MarkdownBody({ source }: { source: string }) {
  return <Markdown remarkPlugins={[remarkGfm]}>{source}</Markdown>;
}
```
Source: adapted from the official `react-markdown` README and current repo usage.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Shared shell files directly owned toolbar/menu wiring | Fixed-slot runtime composition + feature-owned contributions | ADR-0007 / ADR-0008 on 2026-03-16 | New authoring work should land in contribution/model/binding files, not new shell hotspots. |
| DOM keyboard branching in `GraphCanvas` | Normalized chord -> keymap -> command -> trace boundary under `processes/canvas-runtime/keyboard` | ADR-0009 on 2026-03-16 | Phase 1 shortcut work has an established extension seam. |
| `reactflow` package line | Upstream React Flow docs now show `@xyflow/react` v12 imports | Current docs observed 2026-03-19 | Do not mix a runtime package migration into Phase 1 unless explicitly scoped. |
| Rich editor assumption for markdown bodies | Source-first markdown editing plus rendered display state | Locked by Phase 1 context on 2026-03-19 | Prevents WYSIWYG scope creep and keeps shell/body boundaries simpler. |

**Deprecated/outdated:**
- Renderer-name-first gating as the main decision surface.
- Inspector-first editing for common object actions.
- Multi-block markdown body work in Phase 1.
- New shell-owned keyboard/menu wiring that bypasses runtime bindings.

## Open Questions

1. **How does `AUTH-01` reach truly database-backed workspace/document entry in the live app shell?**
   - What we know: Canonical persistence exists in `libs/shared`, but the current app entry still proxies `/api/files` and tabs open file paths.
   - What's unclear: Whether Phase 1 should land a new canonical workspace/document entry surface or explicitly keep file tabs as an adapter for this phase.
   - Recommendation: Make this the first architectural decision in plan `01-01` and avoid mixing both models inside later plans.

2. **What is the intended implementation surface for resize/rotate?**
   - What we know: Current code exposes drag, selection, overlay anchors, and floating/context menus, but no dedicated resize/rotate handle layer is wired.
   - What's unclear: Whether the team wants React Flow built-ins, feature-owned overlay handles, or node-local affordances.
   - Recommendation: Plan resize/rotate as a dedicated slice with its own model/handle ownership, not as a side effect of drag work.

3. **Should Phase 1 rename or normalize the current text-edit mode contract?**
   - What we know: `app/store/graph.ts` includes `textEditMode: 'text' | 'markdown-wysiwyg'`, but the locked phase direction is source-first markdown.
   - What's unclear: Whether the enum name is harmless technical debt or will mislead implementation/tasks.
   - Recommendation: If touched, normalize naming early so planners and implementers do not infer rich editing requirements that are explicitly out of scope.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Bun test (primary), Vitest (shared/CLI slices), Playwright (browser e2e) |
| Config file | `package.json`, `playwright.config.ts`, `libs/cli/vitest.config.mts`, `jest.config.ts` (legacy) |
| Quick run command | `bun test app/components/GraphCanvas.test.tsx app/components/editor/WorkspaceClient.test.tsx app/store/graph.test.ts app/processes/canvas-runtime/createCanvasRuntime.test.ts app/processes/canvas-runtime/keyboard/keymap.test.ts app/processes/canvas-runtime/keyboard/dispatchKeyCommand.test.ts app/features/canvas-ui-entrypoints/canvas-toolbar/toolbarModel.test.ts app/features/canvas-ui-entrypoints/selection-floating-menu/selectionModel.test.ts app/features/canvas-ui-entrypoints/node-context-menu/buildNodeContextMenuModel.test.ts` |
| Full suite command | `bun test && bun run test:e2e` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-01 | Workspace/document open-switch-resume flow | e2e + store | `bunx playwright test e2e/tabs.spec.ts` | ✅ |
| AUTH-02 | Pan/zoom restore and keyboard zoom | unit + manual smoothness check | `bun test app/components/GraphCanvas.viewport.test.ts app/processes/canvas-runtime/keyboard/keymap.test.ts` | ✅ |
| AUTH-03 | Marquee-select, multi-select, deselect | e2e/integration | `bun test app/components/GraphCanvas.test.tsx` | ❌ Wave 0 |
| AUTH-04 | Direct drag and multi-selection movement | unit + e2e | `bun test app/components/GraphCanvas.test.tsx app/components/editor/WorkspaceClient.test.tsx` | ✅ |
| AUTH-05 | Visible resize/rotate handles | component/e2e | `bun test` (targeted file TBD) | ❌ Wave 0 |
| AUTH-06 | Delete, duplicate, copy/paste, undo/redo, select all, zoom, grouping shortcuts | unit + e2e | `bun test app/processes/canvas-runtime/keyboard/keymap.test.ts app/processes/canvas-runtime/keyboard/dispatchKeyCommand.test.ts` | ✅ partial |
| AUTH-07 | Group/ungroup and z-order behavior | component/e2e | `bun test app/components/GraphCanvas.test.tsx` | ❌ Wave 0 |
| SHAP-01 | Primary creation flow for required shape set | component/e2e | `bun test app/components/GraphCanvas.test.tsx` | ❌ Wave 0 |
| SHAP-02 | Quick edit from toolbar/floating/context surfaces | unit/component | `bun test app/features/canvas-ui-entrypoints/canvas-toolbar/toolbarModel.test.ts app/features/canvas-ui-entrypoints/selection-floating-menu/selectionModel.test.ts app/features/canvas-ui-entrypoints/node-context-menu/buildNodeContextMenuModel.test.ts` | ✅ |
| SHAP-03 | Miro-style node context menu as productivity surface | unit/component | `bun test app/features/canvas-ui-entrypoints/node-context-menu/contribution.test.ts app/features/canvas-ui-entrypoints/node-context-menu/buildNodeContextMenuModel.test.ts` | ✅ |
| SHAP-04 | Desktop/mobile canonical parity | e2e/manual mobile shell | `bun run test:e2e` | ❌ Wave 0 |
| BODY-01 | Every object has editable content surface | component + integration | `bun test app/components/editor/WorkspaceClient.test.tsx app/components/nodes/renderableContent.test.tsx` | ✅ partial |
| BODY-02 | Markdown is default object text authoring mode | component + integration | `bun test app/components/nodes/renderableContent.test.tsx app/components/editor/WorkspaceClient.test.tsx` | ✅ partial |

### Sampling Rate
- **Per task commit:** Run the relevant targeted Bun tests plus the quick run command when a task touches routing, store, canvas surfaces, or keyboard.
- **Per wave merge:** `bun test`
- **Phase gate:** `bun test && bun run test:e2e` before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `e2e/canvas-authoring-core.spec.ts` — marquee select, deselect, drag, duplicate, delete, and create-loop coverage for AUTH-03/AUTH-04/SHAP-01.
- [ ] `e2e/canvas-resize-rotate.spec.ts` — visible handle interactions for AUTH-05.
- [ ] `e2e/canvas-grouping.spec.ts` — group/ungroup, select-group entry, and z-order behavior for AUTH-07.
- [ ] `e2e/mobile-authoring.spec.ts` — desktop/mobile shell parity for SHAP-04.
- [ ] `app/processes/canvas-runtime/keyboard/phase1-shortcuts.test.ts` — delete/duplicate/select-all/group shortcut coverage for AUTH-06.
- [ ] `app/components/GraphCanvas.interactions.test.tsx` — create-mode, selection unwind, and overlay suppression during body edit.

## Sources

### Primary (HIGH confidence)
- Repo docs and phase context read directly on 2026-03-19:
  - `.planning/phases/01-canvas-core-authoring/01-CONTEXT.md`
  - `.planning/REQUIREMENTS.md`
  - `.planning/ROADMAP.md`
  - `.planning/PROJECT.md`
  - `docs/adr/ADR-0005-database-first-canvas-platform.md`
  - `docs/adr/ADR-0007-canvas-runtime-composition-root-and-fixed-slots.md`
  - `docs/adr/ADR-0008-shared-shell-one-time-adoption-via-runtime-bindings.md`
  - `docs/adr/ADR-0009-keyboard-command-boundary-and-pino-tracing.md`
  - `docs/features/database-first-canvas-platform/canvas-ui-entrypoints/README.md`
  - `docs/features/object-capability-composition/README.md`
  - `docs/features/canvas-editing/README.md`
- Repo implementation and tests read directly on 2026-03-19:
  - `app/processes/canvas-runtime/createCanvasRuntime.ts`
  - `app/components/GraphCanvas.tsx`
  - `app/components/editor/WorkspaceClient.tsx`
  - `app/store/graph.ts`
  - `app/components/editor/workspaceEditUtils.ts`
  - `app/processes/canvas-runtime/bindings/actionDispatch.ts`
  - `app/processes/canvas-runtime/bindings/keyboardHost.ts`
  - `app/ws/methods.ts`
  - `app/ws/filePatcher.ts`
  - `libs/shared/src/lib/canonical-persistence/pglite-db.ts`
- Drizzle PGlite docs: https://orm.drizzle.team/docs/connect-pglite
- React Markdown official README: https://github.com/remarkjs/react-markdown

### Secondary (MEDIUM confidence)
- React Flow current docs showing `@xyflow/react` imports: https://reactflow.dev/api-reference/react-flow-provider
- React Flow current docs utility reference: https://reactflow.dev/api-reference/utils/apply-node-changes
- Package registry checks executed locally with `npm view` on 2026-03-19 for `reactflow`, `react-markdown`, `remark-gfm`, `zustand`, `@electric-sql/pglite`, `drizzle-orm`, `lucide-react`, and `next`

### Tertiary (LOW confidence)
- `docs/reports/excalidraw-vs-magam/README.md` for benchmark framing and product comparison; useful context, but it is an internal report rather than a canonical architecture contract.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - dominated by current repo dependencies plus official package/docs verification.
- Architecture: HIGH - strongly backed by ADR-0005/0007/0008/0009 and current implementation/tests.
- Pitfalls: MEDIUM - most are directly supported by repo concerns and structure, but some Phase 1-specific failure modes remain inference until implementation starts.

**Research date:** 2026-03-19
**Valid until:** 2026-04-18
