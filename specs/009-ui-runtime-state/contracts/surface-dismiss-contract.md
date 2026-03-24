# Contract: Surface Dismiss and Exclusivity

## Purpose

Normalize open/close behavior across toolbar, pane menu, node menu, and selection-floating surfaces.

## Surface Kinds

- `toolbar-create-menu`
- `toolbar-preset-menu`
- `pane-context-menu`
- `node-context-menu`
- `selection-floating-menu`

## Rules

1. Only one primary surface may be open at any time.
2. Opening any primary surface replaces the currently open primary surface.
3. `pane-context-menu` and `node-context-menu` are mutually exclusive.
4. Selection change dismisses `node-context-menu` and `selection-floating-menu`.
5. Viewport change dismisses surfaces marked `dismissOnViewportChange`.
6. Canvas click or explicit close action dismisses currently open dismissible surface.

## Trigger Matrix

| Trigger | Expected Outcome |
|---|---|
| Open new primary surface | Previous primary surface closes |
| Selection change | Selection-dependent surfaces close |
| Viewport pan/zoom | Viewport-sensitive surfaces close or recalc per policy |
| Outside click/canvas click | Active dismissible surface closes |
| Node deletion/owner invalidation | Surface and related anchor cleanup run |

## Guarantees

- Dismiss logic is shared instead of duplicated in each component.
- Surface conflicts resolve deterministically.
