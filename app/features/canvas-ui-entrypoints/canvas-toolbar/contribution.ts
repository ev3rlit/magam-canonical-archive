import type { CanvasRuntimeContribution } from '@/processes/canvas-runtime/types';
import { canvasToolbarSectionContributions } from './toolbarSections';

export const canvasToolbarContribution = {
  toolbarSections: canvasToolbarSectionContributions,
} satisfies CanvasRuntimeContribution;

export default canvasToolbarContribution;
