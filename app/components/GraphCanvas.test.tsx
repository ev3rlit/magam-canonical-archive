import { describe, expect, it } from 'bun:test';
import { shouldScheduleAutoRelayout } from './GraphCanvas.relayout';

describe('GraphCanvas auto relayout policy', () => {
  const baseInput = {
    needsAutoLayout: true,
    hasLayouted: true,
    nodesInitialized: true,
    nodesMeasured: true,
    signature: 'map.a:100x50',
    lastSignature: 'map.a:98x50',
    inFlight: false,
    attemptCount: 0,
    maxAttempts: 3,
    now: 1_000,
    lastRelayoutAt: 0,
    cooldownMs: 250,
  };

  it('schedules when all guards pass and signature changed', () => {
    expect(shouldScheduleAutoRelayout(baseInput)).toBe(true);
  });

  it('does not schedule when signature is unchanged', () => {
    expect(
      shouldScheduleAutoRelayout({
        ...baseInput,
        lastSignature: 'map.a:100x50',
      }),
    ).toBe(false);
  });

  it('does not schedule while layout is in-flight', () => {
    expect(
      shouldScheduleAutoRelayout({
        ...baseInput,
        inFlight: true,
      }),
    ).toBe(false);
  });

  it('does not schedule after max attempts reached', () => {
    expect(
      shouldScheduleAutoRelayout({
        ...baseInput,
        attemptCount: 3,
      }),
    ).toBe(false);
  });

  it('does not schedule during cooldown window', () => {
    expect(
      shouldScheduleAutoRelayout({
        ...baseInput,
        now: 1_200,
        lastRelayoutAt: 1_000,
      }),
    ).toBe(false);
  });
});
