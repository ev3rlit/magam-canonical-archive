'use client';

import type { MagamDesktopBridge } from '@/lib/desktop/bridge-contract';
import { getHostRuntime } from '@/features/host/renderer/createHostRuntime';

declare global {
  interface Window {
    magamDesktop?: MagamDesktopBridge;
  }
}

export async function pickWorkspaceRootPath(input: {
  title: string;
  defaultPath?: string | null;
}): Promise<string | null> {
  // try new host runtime payload first
  const runtime = typeof window !== 'undefined' ? getHostRuntime() : undefined;
  if (runtime?.capabilities?.workspace?.selectWorkspace) {
    const selection = await runtime.capabilities.workspace.selectWorkspace();
    return selection?.path?.trim() || null;
  }
  
  // fallback to old bridge
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

export async function pickWorkspaceSaveLocation(input: {
  title: string;
  defaultPath?: string | null;
}): Promise<string | null> {
  const runtime = typeof window !== 'undefined' ? getHostRuntime() : undefined;
  if (runtime?.capabilities?.workspace?.chooseSaveLocation) {
    const selection = await runtime.capabilities.workspace.chooseSaveLocation();
    return selection?.path?.trim() || null;
  }

  return pickWorkspaceRootPath(input);
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
