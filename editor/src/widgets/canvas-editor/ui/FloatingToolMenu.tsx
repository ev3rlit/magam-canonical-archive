'use client';

import clsx from 'clsx';
import { useEditorStore } from '@/core/editor/model/editor-store';
import type { EditorTool } from '@/core/editor/model/editor-types';
import { EditorIcon, type EditorIconName } from '@/shared/ui/EditorIcon';

const CREATE_TOOLS: Array<{
  tool: Exclude<EditorTool, 'select' | 'pan'>;
  icon: EditorIconName;
  label: string;
}> = [
  { tool: 'shape', icon: 'shape', label: 'Create shape' },
  { tool: 'sticky', icon: 'sticky', label: 'Create sticky note' },
  { tool: 'text', icon: 'text', label: 'Create text' },
  { tool: 'image', icon: 'image', label: 'Create image' },
  { tool: 'frame', icon: 'frame', label: 'Create frame' },
];

export function FloatingToolMenu() {
  const activeTool = useEditorStore((state) => state.activeTool);
  const setActiveTool = useEditorStore((state) => state.setActiveTool);
  const createObjectAtViewportCenter = useEditorStore((state) => state.createObjectAtViewportCenter);

  return (
    <div className="floating-tool-menu">
      <div className="floating-tool-menu__cluster">
        <button
          className={clsx('floating-tool-menu__button', {
            'floating-tool-menu__button--active': activeTool === 'select',
          })}
          aria-label="Select tool"
          onClick={() => setActiveTool('select')}
          title="Select"
          type="button"
        >
          <EditorIcon name="cursor" />
        </button>
        <button
          className={clsx('floating-tool-menu__button', {
            'floating-tool-menu__button--active': activeTool === 'pan',
          })}
          aria-label="Pan tool"
          onClick={() => setActiveTool('pan')}
          title="Pan"
          type="button"
        >
          <EditorIcon name="pan" />
        </button>
      </div>
      <div className="floating-tool-menu__divider" />
      <div className="floating-tool-menu__cluster">
        {CREATE_TOOLS.map(({ tool, icon, label }) => (
          <button
            className="floating-tool-menu__button"
            key={tool}
            onClick={() => createObjectAtViewportCenter(tool)}
            aria-label={label}
            title={label}
            type="button"
          >
            <EditorIcon name={icon} />
          </button>
        ))}
      </div>
    </div>
  );
}
