export const AUTO_RELAYOUT_DEBOUNCE_MS = 120;
export const AUTO_RELAYOUT_COOLDOWN_MS = 250;
export const AUTO_RELAYOUT_MAX_ATTEMPTS = 2;
export const AUTO_RELAYOUT_QUANTIZATION_PX = 2;

type AutoRelayoutDecisionInput = {
  needsAutoLayout: boolean;
  hasLayouted: boolean;
  nodesInitialized: boolean;
  nodesMeasured: boolean;
  changedGroupIds: string[];
  inFlight: boolean;
  attemptCounts: ReadonlyMap<string, number>;
  maxAttempts: number;
  now: number;
  lastRelayoutAts: ReadonlyMap<string, number>;
  cooldownMs: number;
};

type EligibleAutoRelayoutGroupsInput = Pick<
  AutoRelayoutDecisionInput,
  'changedGroupIds' | 'attemptCounts' | 'maxAttempts' | 'now' | 'lastRelayoutAts' | 'cooldownMs'
>;

export function getChangedMindMapGroupIds(
  nextSignatures: ReadonlyMap<string, string>,
  lastSignatures: ReadonlyMap<string, string> | null | undefined,
): string[] {
  const groupIds = new Set<string>(nextSignatures.keys());
  if (lastSignatures) {
    lastSignatures.forEach((_signature, groupId) => {
      groupIds.add(groupId);
    });
  }

  return [...groupIds]
    .sort((leftGroupId, rightGroupId) => leftGroupId.localeCompare(rightGroupId))
    .filter((groupId) => (nextSignatures.get(groupId) ?? '') !== (lastSignatures?.get(groupId) ?? ''));
}

export function getEligibleAutoRelayoutGroupIds(
  input: EligibleAutoRelayoutGroupsInput,
): string[] {
  return input.changedGroupIds.filter((groupId) => {
    const attemptCount = input.attemptCounts.get(groupId) ?? 0;
    if (attemptCount >= input.maxAttempts) {
      return false;
    }

    const lastRelayoutAt = input.lastRelayoutAts.get(groupId) ?? 0;
    return input.now - lastRelayoutAt >= input.cooldownMs;
  });
}

export function shouldScheduleAutoRelayout(input: AutoRelayoutDecisionInput): boolean {
  if (!input.needsAutoLayout) return false;
  if (!input.hasLayouted) return false;
  if (!input.nodesInitialized || !input.nodesMeasured) return false;
  if (input.changedGroupIds.length === 0) return false;
  if (input.inFlight) return false;
  return getEligibleAutoRelayoutGroupIds(input).length > 0;
}
