export const AUTO_RELAYOUT_DEBOUNCE_MS = 120;
export const AUTO_RELAYOUT_COOLDOWN_MS = 250;
export const AUTO_RELAYOUT_MAX_ATTEMPTS = 3;
export const AUTO_RELAYOUT_QUANTIZATION_PX = 2;

type AutoRelayoutDecisionInput = {
  needsAutoLayout: boolean;
  hasLayouted: boolean;
  nodesInitialized: boolean;
  nodesMeasured: boolean;
  signature: string;
  lastSignature: string | null;
  inFlight: boolean;
  attemptCount: number;
  maxAttempts: number;
  now: number;
  lastRelayoutAt: number;
  cooldownMs: number;
};

export function shouldScheduleAutoRelayout(input: AutoRelayoutDecisionInput): boolean {
  if (!input.needsAutoLayout) return false;
  if (!input.hasLayouted) return false;
  if (!input.nodesInitialized || !input.nodesMeasured) return false;
  if (input.signature.length === 0) return false;
  if (input.signature === input.lastSignature) return false;
  if (input.inFlight) return false;
  if (input.attemptCount >= input.maxAttempts) return false;
  if (input.now - input.lastRelayoutAt < input.cooldownMs) return false;
  return true;
}
