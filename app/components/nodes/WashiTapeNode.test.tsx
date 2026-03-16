import { describe, expect, it } from 'bun:test';
import { getWashiLabel, resolveWashiTapeSurfaceStyle } from './WashiTapeNode';

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

  it('applies runtime style layers onto the tape surface', () => {
    expect(resolveWashiTapeSurfaceStyle({
      baseStyle: {
        backgroundColor: '#fde68a',
        opacity: 0.84,
      },
      runtimePayload: {
        style: {
          boxShadow: '0 0 0 1px #f59e0b',
        },
        groupHoverStyle: {
          backgroundColor: '#fcd34d',
        },
      },
      isHovered: false,
      isFocused: false,
      isActive: false,
      isGroupHovered: true,
    })).toEqual({
      backgroundColor: '#fcd34d',
      opacity: 0.84,
      boxShadow: '0 0 0 1px #f59e0b',
    });
  });
});
