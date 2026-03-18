import { overlayHostReducer } from './state';
import { isValidOverlayAnchor } from './positioning';
import type {
  OverlayContribution,
  OverlayDismissReason,
  OverlayHostState,
  OverlayInstanceState,
  OverlaySlotKind,
  OverlayViewport,
} from './types';

function overlayError(code: string): Error {
  return new Error(code);
}

let overlaySequence = 0;

export function createOverlayInstanceId(slot: OverlaySlotKind): string {
  overlaySequence += 1;
  return `${slot}:${overlaySequence}`;
}

function assertContribution(contribution: OverlayContribution): void {
  if (!isValidOverlayAnchor(contribution.anchor)) {
    throw overlayError('OVERLAY_CONTRIBUTION_INVALID');
  }

  if (!Number.isInteger(contribution.priority)) {
    throw overlayError('OVERLAY_PRIORITY_INVALID');
  }

  if (
    contribution.focusPolicy?.openTarget === 'explicit-target'
    && !contribution.focusPolicy.openTargetId
  ) {
    throw overlayError('OVERLAY_FOCUS_TARGET_INVALID');
  }

  if (
    contribution.focusPolicy?.restoreTarget === 'explicit-target'
    && !contribution.focusPolicy.restoreTargetId
  ) {
    throw overlayError('OVERLAY_FOCUS_TARGET_INVALID');
  }
}

function toInstance(
  contribution: OverlayContribution,
  instanceId: string,
  openedAt: number,
  viewport: OverlayViewport,
): OverlayInstanceState {
  return {
    ...contribution,
    instanceId,
    openedAt,
    measuredSize: contribution.estimatedSize,
    resolvedPosition: {
      x: contribution.anchor.type === 'selection-bounds'
        ? contribution.anchor.x
        : contribution.anchor.x,
      y: contribution.anchor.type === 'selection-bounds'
        ? contribution.anchor.y
        : contribution.anchor.y,
    },
  };
}

function resolveReplacementCandidate(
  state: OverlayHostState,
  contribution: OverlayContribution,
): OverlayInstanceState | null {
  return state.active.find((item) => (
    item.slot === contribution.slot
    || (
      Boolean(item.replaceKey)
      && Boolean(contribution.replaceKey)
      && item.replaceKey === contribution.replaceKey
    )
  )) ?? null;
}

export function openOverlay(input: {
  state: OverlayHostState;
  contribution: OverlayContribution;
  viewport: OverlayViewport;
  now?: number;
}): {
  state: OverlayHostState;
  instanceId: string;
  replacedInstance?: OverlayInstanceState;
} {
  assertContribution(input.contribution);

  const now = input.now ?? Date.now();
  const replacedInstance = resolveReplacementCandidate(input.state, input.contribution) ?? undefined;
  const instanceId = createOverlayInstanceId(input.contribution.slot);
  const baseState = replacedInstance
    ? overlayHostReducer(input.state, {
      type: 'DISMISS_INSTANCE',
      instanceId: replacedInstance.instanceId,
      reason: 'programmatic-replace',
      at: now,
    })
    : input.state;

  const nextState = overlayHostReducer(baseState, {
    type: 'UPSERT_INSTANCE',
    instance: toInstance(input.contribution, instanceId, now, input.viewport),
  });

  return {
    state: overlayHostReducer(nextState, {
      type: 'REFLOW_ALL',
      viewport: input.viewport,
    }),
    instanceId,
    replacedInstance,
  };
}

export function closeOverlay(input: {
  state: OverlayHostState;
  instanceId: string;
  reason: OverlayDismissReason;
  now?: number;
}): {
  state: OverlayHostState;
  closedInstance?: OverlayInstanceState;
} {
  if (!input.reason) {
    throw overlayError('OVERLAY_DISMISS_REASON_REQUIRED');
  }

  const closedInstance = input.state.active.find((item) => item.instanceId === input.instanceId);
  if (!closedInstance) {
    throw overlayError('OVERLAY_INSTANCE_NOT_FOUND');
  }

  return {
    state: overlayHostReducer(input.state, {
      type: 'DISMISS_INSTANCE',
      instanceId: input.instanceId,
      reason: input.reason,
      at: input.now ?? Date.now(),
    }),
    closedInstance,
  };
}

export function replaceOverlay(input: {
  state: OverlayHostState;
  instanceId: string;
  contribution: OverlayContribution;
  viewport: OverlayViewport;
  now?: number;
}): {
  state: OverlayHostState;
  instanceId: string;
  replacedInstance: OverlayInstanceState;
} {
  const target = input.state.active.find((item) => item.instanceId === input.instanceId);
  if (!target) {
    throw overlayError('OVERLAY_REPLACE_TARGET_INVALID');
  }

  const result = openOverlay({
    state: input.state,
    contribution: input.contribution,
    viewport: input.viewport,
    now: input.now,
  });

  return {
    state: result.state,
    instanceId: result.instanceId,
    replacedInstance: target,
  };
}

export function closeOverlayBySlot(input: {
  state: OverlayHostState;
  slot: OverlaySlotKind;
  reason: OverlayDismissReason;
  now?: number;
}): {
  state: OverlayHostState;
  closedInstances: OverlayInstanceState[];
} {
  if (!input.reason) {
    throw overlayError('OVERLAY_DISMISS_REASON_REQUIRED');
  }

  let nextState = input.state;
  const closedInstances = input.state.active.filter((item) => item.slot === input.slot);
  const at = input.now ?? Date.now();

  closedInstances.forEach((instance) => {
    nextState = overlayHostReducer(nextState, {
      type: 'DISMISS_INSTANCE',
      instanceId: instance.instanceId,
      reason: input.reason,
      at,
    });
  });

  return {
    state: nextState,
    closedInstances,
  };
}

export function measureOverlay(input: {
  state: OverlayHostState;
  instanceId: string;
  size: OverlayContribution['estimatedSize'];
  viewport: OverlayViewport;
}): OverlayHostState {
  return overlayHostReducer(input.state, {
    type: 'MEASURE_INSTANCE',
    instanceId: input.instanceId,
    size: input.size,
    viewport: input.viewport,
  });
}

export function reflowOverlays(input: {
  state: OverlayHostState;
  viewport: OverlayViewport;
}): OverlayHostState {
  return overlayHostReducer(input.state, {
    type: 'REFLOW_ALL',
    viewport: input.viewport,
  });
}
