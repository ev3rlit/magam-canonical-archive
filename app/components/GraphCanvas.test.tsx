import { describe, expect, it } from 'bun:test';
import {
  AUTO_RELAYOUT_MAX_ATTEMPTS,
  getChangedMindMapGroupIds,
  getEligibleAutoRelayoutGroupIds,
  shouldScheduleAutoRelayout,
} from './GraphCanvas.relayout';
import { shouldCommitDragStop } from './GraphCanvas.drag';

describe('GraphCanvas auto relayout policy', () => {
  const baseInput = {
    needsAutoLayout: true,
    hasLayouted: true,
    nodesInitialized: true,
    nodesMeasured: true,
    changedGroupIds: ['map-a'],
    inFlight: false,
    attemptCounts: new Map<string, number>(),
    maxAttempts: AUTO_RELAYOUT_MAX_ATTEMPTS,
    now: 1_000,
    lastRelayoutAts: new Map<string, number>(),
    cooldownMs: 250,
  };

  it('schedules when all guards pass and signature changed', () => {
    expect(shouldScheduleAutoRelayout(baseInput)).toBe(true);
  });

  it('does not schedule when no group signature changed', () => {
    expect(
      shouldScheduleAutoRelayout({
        ...baseInput,
        changedGroupIds: [],
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
        attemptCounts: new Map([['map-a', AUTO_RELAYOUT_MAX_ATTEMPTS]]),
      }),
    ).toBe(false);
  });

  it('does not schedule during cooldown window', () => {
    expect(
      shouldScheduleAutoRelayout({
        ...baseInput,
        now: 1_200,
        lastRelayoutAts: new Map([['map-a', 1_000]]),
      }),
    ).toBe(false);
  });

  it('keeps relayout eligibility isolated per changed group', () => {
    expect(
      shouldScheduleAutoRelayout({
        ...baseInput,
        changedGroupIds: ['map-a', 'map-b'],
        attemptCounts: new Map([['map-a', AUTO_RELAYOUT_MAX_ATTEMPTS]]),
      }),
    ).toBe(true);
  });
});

describe('GraphCanvas auto relayout group helpers', () => {
  it('detects only the groups whose quantized signatures changed', () => {
    expect(
      getChangedMindMapGroupIds(
        new Map([
          ['map-a', 'map-a.root:200x100'],
          ['map-b', 'map-b.root:180x80'],
        ]),
        new Map([
          ['map-a', 'map-a.root:198x100'],
          ['map-b', 'map-b.root:180x80'],
        ]),
      ),
    ).toEqual(['map-a']);
  });

  it('returns only groups that still have retry budget and are outside cooldown', () => {
    expect(
      getEligibleAutoRelayoutGroupIds({
        changedGroupIds: ['map-a', 'map-b', 'map-c'],
        attemptCounts: new Map([
          ['map-a', AUTO_RELAYOUT_MAX_ATTEMPTS],
          ['map-b', 1],
        ]),
        maxAttempts: AUTO_RELAYOUT_MAX_ATTEMPTS,
        now: 1_000,
        lastRelayoutAts: new Map([
          ['map-b', 900],
          ['map-c', 100],
        ]),
        cooldownMs: 250,
      }),
    ).toEqual(['map-c']);
  });
});

describe('GraphCanvas drag-stop commit policy', () => {
  it('drag 시작/종료 좌표가 같으면 커밋하지 않는다', () => {
    expect(
      shouldCommitDragStop({
        origin: { x: 100, y: 200 },
        current: { x: 100, y: 200 },
      }),
    ).toBe(false);
  });

  it('좌표가 변경되면 drag-stop 1회 커밋 대상으로 본다', () => {
    expect(
      shouldCommitDragStop({
        origin: { x: 100, y: 200 },
        current: { x: 130, y: 210 },
      }),
    ).toBe(true);
  });
});
