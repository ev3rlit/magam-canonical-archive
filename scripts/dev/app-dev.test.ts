import { describe, expect, it } from 'bun:test';
import { buildCliDevCommand, findTargetArgIndex, resolveDevTargetDir } from './app-dev';

describe('app dev bootstrap helpers', () => {
  const repoRoot = '/repo/magam';

  it('default target directory는 examples를 사용한다', () => {
    expect(resolveDevTargetDir(repoRoot)).toBe('/repo/magam/examples');
  });

  it('MAGAM_TARGET_DIR 상대 경로를 repo root 기준 절대 경로로 변환한다', () => {
    expect(resolveDevTargetDir(repoRoot, './notes')).toBe('/repo/magam/notes');
  });

  it('옵션 값은 target directory로 오인하지 않는다', () => {
    expect(findTargetArgIndex(['--port', '4100', '--debug'])).toBe(-1);
    expect(findTargetArgIndex(['--port', '4100', './notes'])).toBe(2);
  });

  it('target directory 인자가 없으면 기본 target을 cli.ts dev 앞에 주입한다', () => {
    expect(buildCliDevCommand({
      repoRoot,
      args: ['--port', '4100'],
      envTargetDir: './notes',
    })).toEqual([
      'bun',
      '--watch',
      'run',
      'cli.ts',
      'dev',
      '/repo/magam/notes',
      '--port',
      '4100',
    ]);
  });

  it('명시된 target directory 인자는 절대 경로로 정규화한다', () => {
    expect(buildCliDevCommand({
      repoRoot,
      args: ['./custom', '--debug'],
      envTargetDir: './notes',
    })).toEqual([
      'bun',
      '--watch',
      'run',
      'cli.ts',
      'dev',
      '/repo/magam/custom',
      '--debug',
    ]);
  });
});
