import { describe, expect, it } from 'bun:test';
import { getWashiLabel } from './WashiTapeNode';

describe('WashiTapeNode helpers', () => {
  it('extracts text label from children', () => {
    const label = getWashiLabel(
      [
        { type: 'text', text: 'Release' },
        { type: 'graph-markdown', content: 'Candidate' },
      ],
      'fallback',
    );

    expect(label).toBe('Release Candidate');
  });

  it('falls back to provided label when children text is empty', () => {
    const label = getWashiLabel([], 'fallback label');
    expect(label).toBe('fallback label');
  });
});
