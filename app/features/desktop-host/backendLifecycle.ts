import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';

export interface DesktopBackendLifecycleConfig {
  appStateDbPath: string;
  bunBin: string;
  httpPort: number;
  repoRoot: string;
  workspacePath: string;
  wsPort: number;
}

export interface DesktopBackendHandle {
  httpBaseUrl: string;
  httpPort: number;
  stop: () => Promise<void>;
  wsPort: number;
  wsUrl: string;
}

function pipeChildOutput(label: string, child: ChildProcess): void {
  child.stdout?.on('data', (chunk) => {
    process.stdout.write(`[${label}] ${String(chunk)}`);
  });
  child.stderr?.on('data', (chunk) => {
    process.stderr.write(`[${label}] ${String(chunk)}`);
  });
}

function spawnProcess(
  label: string,
  cmd: string[],
  cwd: string,
  env: NodeJS.ProcessEnv,
): ChildProcess {
  const child = spawn(cmd[0], cmd.slice(1), {
    cwd,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  pipeChildOutput(label, child);
  return child;
}

async function waitForHttpHealth(httpBaseUrl: string, timeoutMs = 30_000): Promise<void> {
  const startedAt = Date.now();

  while ((Date.now() - startedAt) < timeoutMs) {
    try {
      const response = await fetch(`${httpBaseUrl}/health`, {
        cache: 'no-store',
      });
      if (response.ok) {
        return;
      }
    } catch {
      // Wait until the backend is ready.
    }

    await new Promise((resolveDelay) => setTimeout(resolveDelay, 250));
  }

  throw new Error(`Desktop backend did not become ready within ${timeoutMs}ms.`);
}

async function stopChildProcess(child: ChildProcess | null | undefined): Promise<void> {
  if (!child || child.exitCode !== null || child.killed) {
    return;
  }

  child.kill('SIGTERM');
  await Promise.race([
    once(child, 'exit').then(() => undefined).catch(() => undefined),
    new Promise((resolveTimeout) => setTimeout(resolveTimeout, 5_000)),
  ]);

  if (child.exitCode === null && !child.killed) {
    child.kill('SIGKILL');
  }
}

export async function startDesktopBackend(
  config: DesktopBackendLifecycleConfig,
): Promise<DesktopBackendHandle> {
  const env = {
    ...process.env,
    MAGAM_APP_STATE_DB_PATH: config.appStateDbPath,
    MAGAM_HTTP_PORT: String(config.httpPort),
    MAGAM_TARGET_DIR: config.workspacePath,
    MAGAM_WS_PORT: String(config.wsPort),
  };

  const httpProcess = spawnProcess(
    'desktop-http',
    [config.bunBin, 'run', 'libs/cli/src/bin.ts', 'serve', config.workspacePath],
    config.repoRoot,
    env,
  );
  const wsProcess = spawnProcess(
    'desktop-ws',
    [config.bunBin, 'run', 'app/ws/server.ts'],
    config.repoRoot,
    env,
  );

  const httpBaseUrl = `http://127.0.0.1:${config.httpPort}`;
  const wsUrl = `ws://127.0.0.1:${config.wsPort}`;

  try {
    await waitForHttpHealth(httpBaseUrl);
  } catch (error) {
    await Promise.all([
      stopChildProcess(httpProcess),
      stopChildProcess(wsProcess),
    ]);
    throw error;
  }

  return {
    httpBaseUrl,
    httpPort: config.httpPort,
    async stop() {
      await Promise.all([
        stopChildProcess(httpProcess),
        stopChildProcess(wsProcess),
      ]);
    },
    wsPort: config.wsPort,
    wsUrl,
  };
}
