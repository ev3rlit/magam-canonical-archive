import { getHostRuntime } from './createHostRuntime';

export function resolveHostApiPath(path: string): string {
  if (typeof window === 'undefined') {
    return path;
  }

  const runtime = getHostRuntime();
  if (runtime.mode !== 'desktop-primary') {
    return path;
  }

  return path;
}
