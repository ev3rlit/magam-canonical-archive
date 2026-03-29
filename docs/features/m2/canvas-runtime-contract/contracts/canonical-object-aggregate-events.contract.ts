import type {
  BodyBlockIdV1,
  CanvasDomainEventMetaV1,
  CanonicalObjectCapabilityNameV1,
  CanonicalObjectIdV1,
  ResolvedBodyBlockPositionV1,
} from './canvas-runtime-core.contract';

// Events emitted by the Canonical Object Aggregate.

export interface ObjectContentUpdatedEventV1 {
  name: 'ObjectContentUpdated';
  meta: CanvasDomainEventMetaV1;
  data: {
    objectId: CanonicalObjectIdV1;
  };
}

export interface ObjectCapabilityPatchedEventV1 {
  name: 'ObjectCapabilityPatched';
  meta: CanvasDomainEventMetaV1;
  data: {
    objectId: CanonicalObjectIdV1;
    capability: CanonicalObjectCapabilityNameV1;
  };
}

export interface ObjectBodyBlockInsertedEventV1 {
  name: 'ObjectBodyBlockInserted';
  meta: CanvasDomainEventMetaV1;
  data: {
    objectId: CanonicalObjectIdV1;
    blockId: BodyBlockIdV1;
  };
}

export interface ObjectBodyBlockUpdatedEventV1 {
  name: 'ObjectBodyBlockUpdated';
  meta: CanvasDomainEventMetaV1;
  data: {
    objectId: CanonicalObjectIdV1;
    blockId: BodyBlockIdV1;
  };
}

export interface ObjectBodyBlockRemovedEventV1 {
  name: 'ObjectBodyBlockRemoved';
  meta: CanvasDomainEventMetaV1;
  data: {
    objectId: CanonicalObjectIdV1;
    blockId: BodyBlockIdV1;
  };
}

export interface ObjectBodyBlockReorderedEventV1 {
  name: 'ObjectBodyBlockReordered';
  meta: CanvasDomainEventMetaV1;
  data: {
    objectId: CanonicalObjectIdV1;
    blockId: BodyBlockIdV1;
    position: ResolvedBodyBlockPositionV1;
  };
}

export type CanonicalObjectAggregateEventV1 =
  | ObjectContentUpdatedEventV1
  | ObjectCapabilityPatchedEventV1
  | ObjectBodyBlockInsertedEventV1
  | ObjectBodyBlockUpdatedEventV1
  | ObjectBodyBlockRemovedEventV1
  | ObjectBodyBlockReorderedEventV1;
