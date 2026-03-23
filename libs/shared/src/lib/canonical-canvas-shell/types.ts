export interface CanonicalCanvasShellRecord {
  canvasId: string;
  workspaceId: string;
  filePath: string | null;
  surfaceIds: string[];
  nodeCount: number;
  bindingCount: number;
  latestRevision: number | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface ListCanonicalCanvasShellInput {
  targetDir: string;
  workspaceId?: string;
}

export interface GetCanonicalCanvasShellInput {
  targetDir: string;
  canvasId: string;
  workspaceId?: string;
}

export interface CreateCanonicalCanvasShellInput {
  targetDir: string;
  workspaceId?: string;
  canvasId?: string;
  filePath?: string | null;
  actor?: {
    kind: 'user' | 'agent' | 'system';
    id: string;
  };
}
