'use client';

import clsx from 'clsx';
import { buildHierarchyTree } from '@/core/editor/model/editor-geometry';
import { useEditorStore } from '@/core/editor/model/editor-store';
import type { EditorHierarchyNode } from '@/core/editor/model/editor-types';
import { WidgetBase } from '@/shared/ui/WidgetBase';

function HierarchyBranch({ node }: { node: EditorHierarchyNode }) {
  const toggleHierarchyNode = useEditorStore((state) => state.toggleHierarchyNode);
  const selectOnly = useEditorStore((state) => state.selectOnly);
  const toggleSelection = useEditorStore((state) => state.toggleSelection);

  return (
    <li className="outliner-branch">
      <div
        className={clsx('outliner-row', {
          'outliner-row--selected': node.selected,
        })}
        style={{ paddingLeft: `${node.depth * 18 + 8}px` }}
      >
        {node.children.length > 0 ? (
          <button
            aria-label={node.isCollapsed ? 'Expand children' : 'Collapse children'}
            className="outliner-row__toggle"
            onClick={() => toggleHierarchyNode(node.object.id)}
            type="button"
          >
            {node.isCollapsed ? '+' : '-'}
          </button>
        ) : (
          <span className="outliner-row__spacer" />
        )}
        <button
          className="outliner-row__button"
          onClick={(event) => {
            if (event.shiftKey) {
              toggleSelection(node.object.id);
              return;
            }
            selectOnly(node.object.id);
          }}
          type="button"
        >
          <span className="outliner-row__name">{node.object.name}</span>
          {node.selectedDescendantCount > 0 ? (
            <span className="outliner-row__badge">+{node.selectedDescendantCount}</span>
          ) : null}
          {!node.object.visible ? <span className="outliner-row__meta">Hidden</span> : null}
          {node.object.locked ? <span className="outliner-row__meta">Locked</span> : null}
        </button>
      </div>
      {node.children.length > 0 && !node.isCollapsed ? (
        <ul className="outliner-branch__children">
          {node.children.map((child) => (
            <HierarchyBranch key={child.object.id} node={child} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function OutlinerPanel() {
  const sceneObjects = useEditorStore((state) => state.scene.objects);
  const selection = useEditorStore((state) => state.selection);
  const collapsedNodeIds = useEditorStore((state) => state.panels.collapsedNodeIds);

  const tree = buildHierarchyTree({
    objects: sceneObjects,
    selection,
    collapsedNodeIds,
  });

  return (
    <WidgetBase
      bodyClassName="editor-panel__body--compact"
      collapsible
      entryDelayMs={120}
      panelId="outliner"
      side="left"
      subtitle={sceneObjects.length > 0 ? `${sceneObjects.length} objects` : undefined}
      title="Hierarchy"
    >
      <div data-testid="outliner-panel">
        {tree.length > 0 ? (
          <div className="outliner-root">
            <ul className="outliner-tree">
              {tree.map((node) => (
                <HierarchyBranch key={node.object.id} node={node} />
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </WidgetBase>
  );
}
