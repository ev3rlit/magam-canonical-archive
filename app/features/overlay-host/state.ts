import { resolveOverlayPosition } from './positioning';
import type {
  OverlayDismissReason,
  OverlayHostState,
  OverlayInstanceState,
  OverlaySize,
  OverlayViewport,
} from './types';

export type OverlayHostAction =
  | { type: 'UPSERT_INSTANCE'; instance: OverlayInstanceState }
  | { type: 'DISMISS_INSTANCE'; instanceId: string; reason: OverlayDismissReason; at: number }
  | { type: 'MEASURE_INSTANCE'; instanceId: string; size: OverlaySize; viewport: OverlayViewport }
  | { type: 'REFLOW_ALL'; viewport: OverlayViewport };

export const initialOverlayHostState: OverlayHostState = {
  active: [],
};

export function sortActiveOverlays(active: OverlayInstanceState[]): OverlayInstanceState[] {
  return active.slice().sort((left, right) => {
    if (left.priority !== right.priority) {
      return left.priority - right.priority;
    }

    return left.openedAt - right.openedAt;
  });
}

export function resolveTopmostOverlay(
  active: OverlayInstanceState[],
): OverlayInstanceState | null {
  return active.length > 0 ? active[active.length - 1] : null;
}

export function overlayHostReducer(
  state: OverlayHostState,
  action: OverlayHostAction,
): OverlayHostState {
  if (action.type === 'UPSERT_INSTANCE') {
    const nextActive = state.active.filter((item) => item.instanceId !== action.instance.instanceId);
    nextActive.push(action.instance);
    return {
      ...state,
      active: sortActiveOverlays(nextActive),
    };
  }

  if (action.type === 'DISMISS_INSTANCE') {
    const dismissed = state.active.find((item) => item.instanceId === action.instanceId);
    if (!dismissed) {
      return state;
    }

    return {
      active: state.active.filter((item) => item.instanceId !== action.instanceId),
      lastDismissed: {
        slot: dismissed.slot,
        reason: action.reason,
        at: action.at,
      },
    };
  }

  if (action.type === 'MEASURE_INSTANCE') {
    let changed = false;
    const nextActive = state.active.map((item) => {
      if (item.instanceId !== action.instanceId) {
        return item;
      }

      if (
        item.measuredSize.width === action.size.width
        && item.measuredSize.height === action.size.height
      ) {
        return item;
      }

      changed = true;
      return {
        ...item,
        measuredSize: action.size,
        resolvedPosition: resolveOverlayPosition({
          anchor: item.anchor,
          overlaySize: action.size,
          placement: item.placement,
          viewport: action.viewport,
        }),
      };
    });

    return changed ? { ...state, active: sortActiveOverlays(nextActive) } : state;
  }

  if (action.type === 'REFLOW_ALL') {
    return {
      ...state,
      active: sortActiveOverlays(state.active.map((item) => ({
        ...item,
        resolvedPosition: resolveOverlayPosition({
          anchor: item.anchor,
          overlaySize: item.measuredSize,
          placement: item.placement,
          viewport: action.viewport,
        }),
      }))),
    };
  }

  return state;
}
