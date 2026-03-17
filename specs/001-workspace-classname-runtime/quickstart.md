# Quickstart: Workspace `className` Runtime

## Goal

Validate class-category-first runtime styling behavior and safelist/bootstrap coexistence before implementation handoff.

## Prerequisites

- Feature branch: `001-workspace-classname-runtime`
- Repository dependencies installed
- Local dev command available via Bun scripts

## Local run

```bash
bun run dev
```

## Manual validation checklist

1. Open a workspace example that contains objects with existing styling/size props surfaces.
2. Edit only `className` on an eligible object and confirm immediate visual update.
3. Confirm current selection and editor context stay stable.
4. Apply three rapid consecutive edits on the same object and confirm last-write-wins behavior.
5. Validate v1 priority category: size (`w-*`, `h-*`, `min/max-*`) updates correctly.
6. Validate v1 priority category: basic visual styling (background/text color and size/font/tracking/border/radius/opacity plus padding-margin-gap basics) updates correctly.
7. Validate v1 priority category: shadow/elevation updates correctly.
8. Validate v1 priority category: outline/emphasis updates correctly, including sticker-outline-like emphasis.
9. Reopen/rerender canvas and confirm last accepted style state is preserved.
10. Validate `dark:`, `md:`, `lg:`, `xl:`, and `2xl:` tokens only activate when runtime context matches.
11. Validate `hover:` tokens apply only on pointer hover and do not overwrite the base inline style payload at rest.
12. Validate `focus:` tokens apply only when the node root is focused and that eligible nodes expose a focusable runtime surface.
13. Validate `active:` tokens apply only while pointer press is active on the node root.
14. Validate `group-hover:` tokens apply on `groupId`-backed grouped nodes and remain diagnosable on ungrouped nodes.
15. Enter mixed supported/unsupported category input and confirm partial apply with diagnostics.
16. Apply `className=""` or remove class input and confirm style reset is applied.
17. Apply class input to a non-eligible object and confirm out-of-scope diagnostic behavior.
18. Start dev bootstrap with runtime styling path enabled and confirm safelist generation still executes.
19. Confirm workspace style edits do not regress the existing safelist/bootstrap development flow.

## Suggested automated verification targets

- `app/features/workspace-styling/classCategories.test.ts`
- `app/features/workspace-styling/eligibility.test.ts`
- `app/features/workspace-styling/interpreter.test.ts`
- `app/features/workspace-styling/smoke.test.ts`
- `app/features/workspace-styling/sessionState.test.ts`
- `app/components/editor/WorkspaceClient.test.tsx`
- `app/components/GraphCanvas.test.tsx`
- `app/hooks/useFileSync.test.ts`
- `scripts/dev/app-dev.test.ts`

## Expected outcomes aligned to spec

- SC-001/SC-002: style-only edits update immediately while editor context remains stable.
- SC-003/SC-004: deterministic outcomes and persistence across reopen/rerender.
- SC-005/SC-006: unsupported and mixed inputs remain diagnosable.
- SC-007: documented support surface is usable without additional guidance.
- SC-008: v1 priority categories match documented expected behavior.
- SC-009: safelist/bootstrap coexistence checks continue to pass with runtime styling path.

## Latest verification

- 2026-03-15: `bun test app/features/workspace-styling/*.test.ts app/components/editor/WorkspaceClient.test.tsx app/components/GraphCanvas.test.tsx scripts/dev/app-dev.test.ts`
- Result: 67 passing, 0 failing
- Covered slices: class categories, eligibility, interpreter payloads, diagnostics, session freshness, GraphCanvas selection-retention policy, WorkspaceClient diagnostics flattening, bootstrap coexistence helpers, sticky/sticker/washi smoke validation
- 2026-03-15: running dev stack render smoke via `http://localhost:3005/api/render`
- Sticky smoke: `status=200`, `nodeCount=24`, node types included `graph-text`, `graph-sticker`, `graph-sticky`, `graph-washi-tape`
- Sticker smoke: `status=200`, `nodeCount=24`, node types were `graph-sticker`
- 2026-03-16: `bun test app/features/workspace-styling/*.test.ts app/components/nodes/BaseNode.test.tsx`
- Result: 41 passing, 0 failing
- Covered slices: hover/focus interaction layers, wider responsive variants, unsupported variant diagnostics, BaseNode hover/focus style layering
- 2026-03-16: `bun test app/features/workspace-styling/*.test.ts app/components/nodes/BaseNode.test.tsx app/components/nodes/WashiTapeNode.test.tsx app/features/render/parseRenderGraph.test.ts app/store/graph.test.ts`
- Result: 81 passing, 0 failing
- Covered slices: `group-hover` payloads and grouped-node diagnostics, parser className surfaces for image/washi, group hover registry state, washitape tape-surface runtime style layering
- 2026-03-16: `bun test app/components/editor/WorkspaceClient.test.tsx app/components/GraphCanvas.test.tsx scripts/dev/app-dev.test.ts app/hooks/useFileSync.test.ts`
- Result: 60 passing, 0 failing
- 2026-03-16: live browser smoke on `examples/runtime_interactions.tsx` via `http://localhost:3005`
- Hover smoke: baseline vs hover screenshot diff `2.70%`
- Focus smoke: baseline vs focus screenshot diff `2.70%`, active element was `DIV` with `tabIndex=0`
- Active smoke: baseline vs active screenshot diff `0.73%`

## Smoke expectations for real surfaces

- Sticky: size + visual + shadow categories should resolve and apply.
- Sticker: shadow + outline/emphasis categories should resolve and apply.
- WashiTape: runtime `className` now targets the tape body surface; grouped washi can additionally react to `group-hover`.
- Image: runtime `className` now targets the frame/wrapper surface.
