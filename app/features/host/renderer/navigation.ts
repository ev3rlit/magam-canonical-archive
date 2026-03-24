import { getDesktopHostBridge } from './hostCapabilities';

function isDesktopRenderer(): boolean {
  return getDesktopHostBridge() !== null;
}

export function buildAppNavigationTarget(route: string): string {
  const normalizedRoute = route.startsWith('/') ? route : `/${route}`;
  return isDesktopRenderer()
    ? `#${normalizedRoute}`
    : `/app${normalizedRoute}`;
}

export function navigateToAppRoute(route: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  const target = buildAppNavigationTarget(route);
  if (target.startsWith('#')) {
    window.location.hash = target.slice(1);
    return;
  }

  window.location.href = target;
}

export function navigateToWorkspaceDetail(workspaceId: string): void {
  navigateToAppRoute(`/workspace/${workspaceId}`);
}

export function navigateToCanvas(canvasId: string): void {
  navigateToAppRoute(`/canvas/${encodeURIComponent(canvasId)}`);
}

export function navigateToWorkspaceCanvas(canvasId: string): void {
  navigateToCanvas(canvasId);
}

export function navigateToDashboard(): void {
  navigateToAppRoute('/');
}
