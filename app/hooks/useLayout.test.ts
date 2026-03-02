import { describe, expect, it } from 'bun:test';
import { canStartLayout } from './useLayout';

describe('useLayout re-entry guard helper', () => {
  it('returns true when no layout is running', () => {
    expect(canStartLayout(false)).toBe(true);
  });

  it('returns false when a layout is already running', () => {
    expect(canStartLayout(true)).toBe(false);
  });
});
