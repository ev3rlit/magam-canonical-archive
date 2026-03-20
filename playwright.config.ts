import { defineConfig } from '@playwright/test';

function resolvePort(name: string, fallback: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    return fallback;
  }

  return /^\d+$/.test(value) ? value : fallback;
}

const appPort = resolvePort('PLAYWRIGHT_APP_PORT', '4173');
const wsPort = resolvePort('PLAYWRIGHT_WS_PORT', '3001');
const baseURL = `http://127.0.0.1:${appPort}`;

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL,
    viewport: { width: 1440, height: 900 },
    headless: true,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: `bash -lc 'MAGAM_WS_PORT=${wsPort} bun run ws:dev & trap "kill 0" EXIT; cd app && NEXT_PUBLIC_MAGAM_WS_PORT=${wsPort} bun run dev:next -- --hostname 127.0.0.1 --port ${appPort}'`,
    url: baseURL,
    reuseExistingServer: process.env.PLAYWRIGHT_REUSE_SERVER === '1'
      ? true
      : !process.env.CI,
    timeout: 120_000,
  },
  reporter: [['list']],
});
