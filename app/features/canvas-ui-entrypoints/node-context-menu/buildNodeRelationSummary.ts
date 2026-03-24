import type { NodeContextSnapshot, NodeRelationSummary } from './types';

export function buildNodeRelationSummary(snapshot: NodeContextSnapshot): NodeRelationSummary {
  const relations = snapshot.nodeContext?.relations;
  const isMindmapMember = relations?.isMindmapMember ?? snapshot.nodeFamily === 'mindmap-member';

  return {
    ...(relations?.sourceKind ? { sourceKind: relations.sourceKind } : {}),
    ...(relations?.parentSourceId ? { parentSourceId: relations.parentSourceId } : {}),
    ...(relations?.groupId ? { groupId: relations.groupId } : {}),
    ...(relations?.frameScope ? { frameScope: relations.frameScope } : {}),
    hasParentRelation: relations?.hasParentRelation ?? Boolean(relations?.parentSourceId),
    isGroupMember: relations?.isGroupMember ?? Boolean(relations?.groupId),
    isMindmapMember,
    isFrameScoped: relations?.isFrameScoped ?? Boolean(relations?.frameScope),
  };
}
