import { getDesktopHostBridge } from './hostCapabilities';

interface WorkspaceDocumentNavigationTarget {
  filePath: string;
}

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

export function navigateToDocument(documentPath: string): void {
  navigateToAppRoute(`/document/${encodeURIComponent(documentPath)}`);
}

export function navigateToWorkspaceDocument(
  rootPath: string,
  document: WorkspaceDocumentNavigationTarget,
): void {
  const normalizedRootPath = rootPath.replace(/[\\/]+$/, '').replace(/\\/g, '/');
  const normalizedFilePath = document.filePath.replace(/^\/+/, '').replace(/\\/g, '/');
  navigateToDocument(`${normalizedRootPath}/${normalizedFilePath}`);
}

export function navigateToDashboard(): void {
  navigateToAppRoute('/');
}
