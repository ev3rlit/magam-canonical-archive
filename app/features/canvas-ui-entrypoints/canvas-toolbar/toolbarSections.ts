import type { ToolbarSectionContribution } from '@/processes/canvas-runtime/types';
import type { CanvasToolbarSectionDefinition } from './types';

export const canvasToolbarSectionInventory = [
  {
    sectionId: 'interaction',
    label: 'Interaction',
    order: 10,
  },
  {
    sectionId: 'create',
    label: 'Create',
    order: 20,
  },
  {
    sectionId: 'viewport',
    label: 'Viewport',
    order: 30,
  },
  {
    sectionId: 'canvas-global',
    label: 'Canvas',
    order: 40,
  },
] as const satisfies readonly CanvasToolbarSectionDefinition[];

export const canvasToolbarSectionContributions: ToolbarSectionContribution[] =
  canvasToolbarSectionInventory.map((section) => ({
    sectionId: section.sectionId,
    label: section.label,
    order: section.order,
  }));
