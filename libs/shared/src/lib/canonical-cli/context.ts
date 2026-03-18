import type { CanonicalDb } from '../canonical-persistence';
import { CanonicalPersistenceRepository } from '../canonical-persistence';

export interface HeadlessServiceContext {
  db: CanonicalDb;
  repository: CanonicalPersistenceRepository;
  targetDir: string;
  dataDir: string | null;
  defaultWorkspaceId: string;
}
