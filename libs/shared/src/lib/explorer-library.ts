export { CanonicalPersistenceRepository } from './canonical-persistence/repository';
export type { CanonicalDb } from './canonical-persistence/pglite-db';
export {
  libraryCollections,
  libraryItemCollections,
  libraryItems,
  libraryItemVersions,
} from './canonical-persistence/schema';
export { errResult, okResult, toAssetItem, toReferenceItem, toTemplateItem } from './canonical-persistence/records';
export type {
  LibraryCollection,
  LibraryItemRecord,
  LibraryItemVersion,
  PersistenceResult,
  ReferenceTarget,
} from './canonical-persistence/records';
