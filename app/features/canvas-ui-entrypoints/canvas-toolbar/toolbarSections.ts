import type { ToolbarSectionContribution } from '@/processes/canvas-runtime/types';
import type { CanvasToolbarSectionDefinition } from './types';
import { getCanvasUiCopy } from '@/features/canvas-ui-entrypoints/copy';

const copy = getCanvasUiCopy().toolbar.sections;

export const canvasToolbarSectionInventory = [
  {
    sectionId: 'interaction',
    label: copy.interaction,
    order: 10,
  },
  {
    sectionId: 'create',
    label: copy.create,
    order: 20,
  },
  {
    sectionId: 'viewport',
    label: copy.viewport,
    order: 30,
  },
  {
    sectionId: 'canvas-global',
    label: copy.canvas,
    order: 40,
  },
] as const satisfies readonly CanvasToolbarSectionDefinition[];

export const canvasToolbarSectionContributions: ToolbarSectionContribution[] =
  canvasToolbarSectionInventory.map((section) => ({
    sectionId: section.sectionId,
    label: section.label,
    order: section.order,
  }));
