import { describe, expect, it } from 'bun:test';
import { resolveDesktopOutDir } from './build';
import { parseDesktopDevFlags } from './dev';

describe('desktop dev helpers', () => {
  it('parses a positional target directory', () => {
    expect(parseDesktopDevFlags(['./workspace'])).toEqual({
      devtools: false,
      headless: false,
      targetDir: './workspace',
    });
  });

  it('parses devtools and headless flags together', () => {
    expect(parseDesktopDevFlags(['--devtools', '--headless', './workspace'])).toEqual({
      devtools: true,
      headless: true,
      targetDir: './workspace',
    });
  });

  it('resolves the desktop output directory under .magam', () => {
    expect(resolveDesktopOutDir('/repo')).toBe('/repo/.magam/desktop-host');
  });
});
