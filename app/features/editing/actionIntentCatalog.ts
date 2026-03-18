import type {
  ActionIntentCatalogEntry,
  ActionRoutingIntent,
  EntryPointSurface,
} from './actionRoutingBridge.types';

const ACTION_INTENT_CATALOG: ActionIntentCatalogEntry[] = [
  {
    surface: 'canvas-toolbar',
    intent: 'create-node',
    intentType: 'mutation',
    dispatchRecipeId: 'create-node',
    gatingProfile: 'create-node',
  },
  {
    surface: 'pane-context-menu',
    intent: 'create-node',
    intentType: 'mutation',
    dispatchRecipeId: 'create-node',
    gatingProfile: 'create-node',
  },
  {
    surface: 'node-context-menu',
    intent: 'rename-node',
    intentType: 'mutation',
    dispatchRecipeId: 'rename-node',
    gatingProfile: 'rename-node',
  },
  {
    surface: 'node-context-menu',
    intent: 'create-mindmap-child',
    intentType: 'mutation',
    dispatchRecipeId: 'create-mindmap-child',
    gatingProfile: 'create-mindmap-child',
  },
  {
    surface: 'node-context-menu',
    intent: 'create-mindmap-sibling',
    intentType: 'mutation',
    dispatchRecipeId: 'create-mindmap-sibling',
    gatingProfile: 'create-mindmap-sibling',
  },
  {
    surface: 'selection-floating-menu',
    intent: 'style-update',
    intentType: 'mutation',
    dispatchRecipeId: 'style-update',
    gatingProfile: 'style-update',
  },
];

export function listActionIntentCatalogEntries(): ActionIntentCatalogEntry[] {
  return ACTION_INTENT_CATALOG.slice();
}

export function getActionIntentCatalogEntry(
  surface: EntryPointSurface,
  intent: ActionRoutingIntent,
): ActionIntentCatalogEntry | undefined {
  return ACTION_INTENT_CATALOG.find((entry) => entry.surface === surface && entry.intent === intent);
}
