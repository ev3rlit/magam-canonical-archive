#!/usr/bin/env bun

import { spawn } from 'bun';
import { existsSync, readdirSync, statSync } from 'fs';
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

function listFilesRecursively(rootDir: string): string[] {
  const files: string[] = [];

  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) {
        continue;
      }

      const fullPath = resolve(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }

      files.push(fullPath);
    }
  };

  if (existsSync(rootDir)) {
    walk(rootDir);
  }

  return files;
}

export function shouldBuildCore(repoRoot: string): boolean {
  const coreRoot = resolve(repoRoot, 'libs/core');
  const distDir = resolve(coreRoot, 'dist');
  const sourceDir = resolve(coreRoot, 'src');

  const buildInputs = [
    ...listFilesRecursively(sourceDir),
    resolve(coreRoot, 'package.json'),
    resolve(coreRoot, 'tsup.config.ts'),
    resolve(coreRoot, 'tsconfig.lib.json'),
  ].filter((filePath) => existsSync(filePath));

  if (buildInputs.length === 0) {
    return false;
  }

  const distFiles = listFilesRecursively(distDir);
  if (distFiles.length === 0) {
    return true;
  }

  const newestInputMtime = Math.max(
    ...buildInputs.map((filePath) => statSync(filePath).mtimeMs),
  );
  const oldestOutputMtime = Math.min(
    ...distFiles.map((filePath) => statSync(filePath).mtimeMs),
  );

  return newestInputMtime > oldestOutputMtime;
}

async function run(): Promise<void> {
  const repoRoot = resolveRepoRoot();
  const targetDir = resolveDevTargetDir(repoRoot, process.env.MAGAM_TARGET_DIR);

  if (shouldBuildCore(repoRoot)) {
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
  } else {
    console.log('[DevBootstrap] libs/core/dist is up to date, skipping build:core');
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
