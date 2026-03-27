# Command Language Contract

## Mandatory Published Vocabulary

### Canvas-owned

- `canvas.node.create`
- `canvas.node.move`
- `canvas.node.reparent`
- `canvas.node.resize`
- `canvas.node.rotate`
- `canvas.node.presentation-style.update`
- `canvas.node.render-profile.update`
- `canvas.node.rename`
- `canvas.node.delete`
- `canvas.node.z-order.update`

### Object-owned

- `object.content.update`
- `object.capability.patch`
- `object.body.block.insert`
- `object.body.block.update`
- `object.body.block.remove`
- `object.body.block.reorder`

## Translation Rule

- UI intent names such as `selection.content.update`, `node.move.absolute`, `node.style.update`, and `node.group.update` remain adapter language.
- shared runtime normalizes them into published commands before dispatch.
- current `canonical-mutation` operations are lower-level execution language and require a translator layer.

## Ownership Split

- node label/display identity flows route to `canvas.node.rename`
- visual property changes route to `canvas.node.presentation-style.update` or `canvas.node.render-profile.update`
- canonical content and ordered body block changes route to object-owned commands

## Body Block Targeting

- public input accepts `selection`, `anchor`, or `index`
- runtime resolves them before commit
- replay uses canonical `blockId` target plus resolved placement vocabulary

## Explicit Exclusion

- group membership is not promoted into v1 published vocabulary in this feature
- export, viewport, and selection-only overlay actions are app behavior, not runtime mutation commands
