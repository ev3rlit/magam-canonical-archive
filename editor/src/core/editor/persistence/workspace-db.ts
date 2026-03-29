export interface WorkspaceDatabaseHandle {
  filePath: string;
  workspaceId: string;
}

export function describeWorkspaceDatabase(handle: WorkspaceDatabaseHandle) {
  return `${handle.workspaceId}:${handle.filePath}`;
}
