import { type ComponentType } from 'react';
import type { CanvasEntrypointCreateNodeType } from '@/features/canvas-ui-entrypoints/contracts';
import type { EntrypointSurfaceKind } from '@/features/canvas-ui-entrypoints/ui-runtime-state';

export type ContextMenuTargetType = 'node' | 'pane';
export type CreatableNodeType = CanvasEntrypointCreateNodeType;

export interface ContextMenuActionsContext {
    fitView?: () => void;
    copyImageToClipboard?: (nodeIds?: string[]) => Promise<void> | void;
    openExportDialog?: (scope: 'selection' | 'full', nodeIds?: string[]) => void;
    selectMindMapGroupByNodeId?: (nodeId: string) => void;
    renameNode?: (nodeId: string) => Promise<void> | void;
    createCanvasNode?: (nodeType: CreatableNodeType, screenPosition: { x: number; y: number }) => Promise<void> | void;
    createMindMapChild?: (nodeId: string) => Promise<void> | void;
    createMindMapSibling?: (nodeId: string) => Promise<void> | void;
}

export interface ContextMenuContext {
    type: ContextMenuTargetType;
    /** 우클릭 화면 좌표 */
    position: { x: number; y: number };
    /** shared runtime-state anchor id */
    anchorId?: string;
    /** shared runtime-state surface kind */
    surfaceKind?: Extract<EntrypointSurfaceKind, 'pane-context-menu' | 'node-context-menu'>;
    /** type === 'node'일 때 해당 노드 ID */
    nodeId?: string;
    /** type === 'node'일 때 해당 노드 family */
    nodeFamily?: string;
    /** 현재 선택된 노드 ID 목록 */
    selectedNodeIds: string[];
    /** 선택적 실행 액션 브릿지 */
    actions?: ContextMenuActionsContext;
}

/** 메뉴 아이템 (실행 가능한 액션) */
export interface ContextMenuAction {
    type: 'action';
    id: string;
    label: string;
    icon?: ComponentType<{ className?: string }>;
    /** 키보드 단축키 표시용 (실행은 별도) */
    shortcut?: string;
    /** 메뉴 아이템이 보일 조건. false 반환 시 숨김 */
    when?: (ctx: ContextMenuContext) => boolean;
    /** 클릭 시 실행할 핸들러 */
    handler: (ctx: ContextMenuContext) => void | Promise<void>;
    /** 그룹 내 정렬 순서 (작을수록 위) */
    order?: number;
}

/** 구분선 */
export interface ContextMenuSeparator {
    type: 'separator';
}

/** 서브메뉴 */
export interface ContextMenuSubmenu {
    type: 'submenu';
    id: string;
    label: string;
    icon?: ComponentType<{ className?: string }>;
    when?: (ctx: ContextMenuContext) => boolean;
    children: ContextMenuItem[];
    order?: number;
}

/** 메뉴 아이템 유니온 타입 */
export type ContextMenuItem = ContextMenuAction | ContextMenuSeparator | ContextMenuSubmenu;
