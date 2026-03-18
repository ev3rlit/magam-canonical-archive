import type { ActionDispatchRecipe } from './actionRoutingBridge.types';

const ACTION_DISPATCH_RECIPES: Record<string, ActionDispatchRecipe> = {
  'create-node': {
    id: 'create-node',
    steps: [{ action: 'node.create', onFailure: 'stop' }],
    rollbackPolicy: 'intent-scoped',
    requiresOptimistic: true,
  },
  'rename-node': {
    id: 'rename-node',
    steps: [{ action: 'node.rename', onFailure: 'stop' }],
    rollbackPolicy: 'intent-scoped',
    requiresOptimistic: true,
  },
  'create-mindmap-child': {
    id: 'create-mindmap-child',
    steps: [{ action: 'mindmap.child.create', onFailure: 'stop' }],
    rollbackPolicy: 'intent-scoped',
    requiresOptimistic: true,
  },
  'create-mindmap-sibling': {
    id: 'create-mindmap-sibling',
    steps: [{ action: 'mindmap.sibling.create', onFailure: 'stop' }],
    rollbackPolicy: 'intent-scoped',
    requiresOptimistic: true,
  },
  'style-update': {
    id: 'style-update',
    steps: [{ action: 'node.style.update', onFailure: 'stop' }],
    rollbackPolicy: 'intent-scoped',
    requiresOptimistic: true,
  },
};

export function getActionDispatchRecipe(recipeId: string): ActionDispatchRecipe | undefined {
  return ACTION_DISPATCH_RECIPES[recipeId];
}
