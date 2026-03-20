import { describe, expect, it } from 'bun:test';
import {
  buildCliDevCommand,
  findTargetArgIndex,
  resolveDevTargetDir,
} from './app-dev';

describe('app-dev command helpers', () => {
  const repoRoot = '/repo';

  it('resolves the default target directory to examples', () => {
    expect(resolveDevTargetDir(repoRoot)).toBe('/repo/examples');
  });

  it('finds the positional target arg after option pairs', () => {
    expect(findTargetArgIndex(['--port', '3002', './workspace'])).toBe(2);
  });

  it('injects a default target when none is supplied', () => {
    expect(buildCliDevCommand({
      repoRoot,
      args: ['--port', '3002'],
    })).toEqual([
      'bun',
      '--watch',
      'run',
      'cli.ts',
      'dev',
      '/repo/examples',
      '--port',
      '3002',
    ]);
  });

  it('replaces a supplied target with the resolved absolute path', () => {
    expect(buildCliDevCommand({
      repoRoot,
      args: ['./custom-target', '--warmup-retries', '2'],
    })).toEqual([
      'bun',
      '--watch',
      'run',
      'cli.ts',
      'dev',
      '/repo/custom-target',
      '--warmup-retries',
      '2',
    ]);
  });
});
