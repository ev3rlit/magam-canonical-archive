import { describe, expect, it } from 'bun:test';
import { buildQuickOpenEntries } from './QuickOpenDialog';

describe('buildQuickOpenEntries', () => {
  const files = ['pages/home.tsx', 'pages/washi.tsx'];
  const commands = [
    {
      id: 'washi:focus-next',
      label: 'Washi: Focus next',
      keywords: ['washi', 'focus'],
    },
    {
      id: 'washi:preset:pastel-dots',
      label: 'Washi: Apply preset pastel-dots',
      keywords: ['preset', 'pastel'],
    },
  ];

  it('returns file + command entries for generic search', () => {
    const entries = buildQuickOpenEntries(files, commands, 'washi');

    expect(entries.some((entry) => entry.kind === 'file')).toBe(true);
    expect(entries.some((entry) => entry.kind === 'command')).toBe(true);
  });

  it('supports command-only mode with > prefix', () => {
    const entries = buildQuickOpenEntries(files, commands, '>preset');

    expect(entries.every((entry) => entry.kind === 'command')).toBe(true);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.kind).toBe('command');
  });

  it('matches command keywords during filtering', () => {
    const entries = buildQuickOpenEntries(files, commands, 'focus');

    const commandIds = entries
      .filter((entry): entry is Extract<(typeof entries)[number], { kind: 'command' }> => entry.kind === 'command')
      .map((entry) => entry.command.id);

    expect(commandIds).toContain('washi:focus-next');
  });
});
