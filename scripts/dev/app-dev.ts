#!/usr/bin/env bun

import { spawn } from 'bun';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const OPTION_KEYS_WITH_VALUE = new Set([
  '--port',
  '-p',
  '--warmup-timeout',
  '--warmup-retries',
  '--warmup-paths',
]);

function resolveRepoRoot(): string {
  return resolve(fileURLToPath(new URL('../..', import.meta.url)));
}

export function resolveDevTargetDir(repoRoot: string, rawTargetDir?: string): string {
  const targetDir = rawTargetDir && rawTargetDir.trim().length > 0
    ? rawTargetDir
    : './examples';
  return resolve(repoRoot, targetDir);
}

export function findTargetArgIndex(args: string[]): number {
  for (let index = 0; index < args.length; index += 1) {
    const current = args[index];

    if (OPTION_KEYS_WITH_VALUE.has(current)) {
      index += 1;
      continue;
    }

    if (!current.startsWith('-')) {
      return index;
    }
  }

  return -1;
}

export function buildCliDevCommand(input: {
  repoRoot: string;
  args: string[];
  envTargetDir?: string;
}): string[] {
  const forwardedArgs = [...input.args];
  const targetIndex = findTargetArgIndex(forwardedArgs);

  if (targetIndex === -1) {
    forwardedArgs.unshift(resolveDevTargetDir(input.repoRoot, input.envTargetDir));
  } else {
    forwardedArgs[targetIndex] = resolveDevTargetDir(input.repoRoot, forwardedArgs[targetIndex]);
  }

  return ['bun', '--watch', 'run', 'cli.ts', 'dev', ...forwardedArgs];
}

async function run(): Promise<void> {
  const repoRoot = resolveRepoRoot();
  const targetDir = resolveDevTargetDir(repoRoot, process.env.MAGAM_TARGET_DIR);

  const generateTailwindSafelist = spawn({
    cmd: ['node', 'scripts/generate-tailwind-workspace-safelist.mjs', targetDir],
    cwd: repoRoot,
    env: process.env,
    stdio: ['inherit', 'inherit', 'inherit'],
  });

  const safelistExitCode = await generateTailwindSafelist.exited;
  if (safelistExitCode !== 0) {
    process.exit(safelistExitCode);
  }

  const buildCore = spawn({
    cmd: ['bun', 'run', 'build:core'],
    cwd: repoRoot,
    env: process.env,
    stdio: ['inherit', 'inherit', 'inherit'],
  });

  const buildExitCode = await buildCore.exited;
  if (buildExitCode !== 0) {
    process.exit(buildExitCode);
  }

  const cliDev = spawn({
    cmd: buildCliDevCommand({
      repoRoot,
      args: process.argv.slice(2),
      envTargetDir: targetDir,
    }),
    cwd: repoRoot,
    env: process.env,
    stdio: ['inherit', 'inherit', 'inherit'],
  });

  const shutdown = () => {
    cliDev.kill();
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  const exitCode = await cliDev.exited;
  process.exit(exitCode);
}

if (import.meta.main) {
  await run();
}
