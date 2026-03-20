'use client';

import type { MagamDesktopBridge } from '@/lib/desktop/bridge-contract';

declare global {
  interface Window {
    magamDesktop?: MagamDesktopBridge;
  }
}

export async function pickWorkspaceRootPath(input: {
  title: string;
  defaultPath?: string | null;
}): Promise<string | null> {
  const bridge = typeof window !== 'undefined' ? window.magamDesktop : undefined;
  if (bridge?.pickDirectory) {
    const selection = await bridge.pickDirectory({
      title: input.title,
      defaultPath: input.defaultPath ?? undefined,
    });
    return selection?.path?.trim() || null;
  }

  const value = window.prompt(input.title, input.defaultPath ?? '')?.trim();
  return value || null;
}

export async function copyTextWithDesktopBridge(text: string): Promise<void> {
  const bridge = typeof window !== 'undefined' ? window.magamDesktop : undefined;
  if (bridge?.copyText) {
    await bridge.copyText({ text });
    return;
  }

  if (typeof navigator?.clipboard?.writeText !== 'function') {
    throw new Error('Clipboard API is not available');
  }

  await navigator.clipboard.writeText(text);
}
