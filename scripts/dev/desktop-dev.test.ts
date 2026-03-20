import { describe, expect, it } from 'bun:test';
import {
  parseDesktopDevFlags,
  resolveDesktopOutDir,
} from './desktop-dev';

describe('desktop-dev helpers', () => {
  it('parses a positional target directory', () => {
    expect(parseDesktopDevFlags(['./workspace'])).toEqual({
      headless: false,
      targetDir: './workspace',
    });
  });

  it('parses headless mode without losing the target directory', () => {
    expect(parseDesktopDevFlags(['--headless', './workspace'])).toEqual({
      headless: true,
      targetDir: './workspace',
    });
  });

  it('resolves the desktop output directory under .magam', () => {
    expect(resolveDesktopOutDir('/repo')).toBe('/repo/.magam/desktop-host');
  });
});
