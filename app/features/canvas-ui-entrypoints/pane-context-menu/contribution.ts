import { paneMenuItems } from './paneMenuItems';
import type { PaneContextMenuContribution } from './types';

const paneContextMenuContribution = {
  paneMenuItems,
} satisfies PaneContextMenuContribution;

export default paneContextMenuContribution;
