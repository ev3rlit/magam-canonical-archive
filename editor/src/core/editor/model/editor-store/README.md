# Editor Store Modules

`editor-store.ts` is the composition root for the canvas editor store.

The rule for this directory is simple:

- `editor-store.ts` wires the flat `useEditorStore` surface together.
- `store-types.ts` owns the assembled store and env contracts.
- `env.ts` carries the narrow capabilities shared by action modules.
- `history.ts` owns snapshot capture, compare, and restore logic.
- `*-actions.ts` files own stateful store mutations for one responsibility area.
- `*-commands.ts` files own reusable helper logic that should stay independent from zustand wiring.
- `selectors.ts` owns the exported read helpers used outside the store.

## Current Ownership

- `panel-actions.ts`
  - reset
  - active tool and temporary tool override
  - panel visibility and viewport updates
- `selection-actions.ts`
  - selection changes
  - marquee state
  - move, resize, rotate selection
- `scene-actions.ts`
  - scene action composition root
- `scene-creation-actions.ts`
  - object creation and placement
  - template instantiation
- `scene-mutation-actions.ts`
  - object field and patch updates
- `scene-clipboard-actions.ts`
  - copy, paste, duplicate
- `scene-structure-actions.ts`
  - z-order changes
  - delete, group, ungroup
- `body-editor-actions.ts`
  - body editor session lifecycle
  - draft commit and discard
- `overlay-actions.ts`
  - context menu
  - focus requests
- `object-commands.ts`
  - object factories and patch sanitization
  - clone and clipboard helpers
- `selection-commands.ts`
  - selection normalization
  - overlay reset helpers
  - transform helpers

## Working Rules

- Keep the external API stable through `editor-store.ts`.
- Prefer adding a new action module over growing the composition root.
- Prefer pure helpers in `*-commands.ts` when the logic does not need `set/get`.
- Do not widen `EditorStoreEnv` unless a module cannot work with the existing narrow capabilities.
- If a helper needs object ID generation, pass it in explicitly instead of importing store globals.

## Verification

Run these from the repo root:

- `bun run test:editor:store`
- `bun run test:editor:ui`
- `bun run typecheck:editor`

Or from `editor/` directly:

- `bun run test:store`
- `bun run test:ui`
