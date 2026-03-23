export interface CanonicalDocumentShellRecord {
  documentId: string;
  workspaceId: string;
  filePath: string | null;
  surfaceIds: string[];
  nodeCount: number;
  bindingCount: number;
  latestRevision: number | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface ListCanonicalDocumentShellInput {
  targetDir: string;
  workspaceId?: string;
}

export interface GetCanonicalDocumentShellInput {
  targetDir: string;
  documentId: string;
  workspaceId?: string;
}

export interface CreateCanonicalDocumentShellInput {
  targetDir: string;
  workspaceId?: string;
  documentId?: string;
  filePath?: string | null;
  actor?: {
    kind: 'user' | 'agent' | 'system';
    id: string;
  };
}
