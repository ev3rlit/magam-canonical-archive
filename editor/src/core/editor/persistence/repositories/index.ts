export interface WorkspaceRepository {
  getWorkspaceId(): string;
}

export interface CanvasRepository {
  listCanvasIds(): Promise<string[]>;
}
