import { createIdleOverlays } from './selection-commands';
import type { EditorStore, EditorStoreEnv } from './store-types';

export function createPanelActions(
  env: EditorStoreEnv,
  createInitialState: () => Partial<EditorStore>,
  clearHistory: () => void,
): Pick<
  EditorStore,
  | 'reset'
  | 'setActiveTool'
  | 'togglePanel'
  | 'showPanel'
  | 'openMobilePanel'
  | 'toggleHierarchyNode'
  | 'setViewportRect'
  | 'panViewport'
  | 'setZoom'
  | 'setTemporaryToolOverride'
> {
  return {
    reset: () => {
      clearHistory();
      env.setState(createInitialState());
    },
    setActiveTool: (tool) => {
      if (env.getState().overlays.isBodyEditorOpen) {
        env.getState().commitActiveBodyEditor();
      }
      env.setState({
        activeTool: tool,
        temporaryToolOverride: null,
        overlays: createIdleOverlays(),
      });
    },
    togglePanel: (panelId) => {
      env.setState((state) => ({
        panels: {
          ...state.panels,
          open: {
            ...state.panels.open,
            [panelId]: !state.panels.open[panelId],
          },
        },
      }));
    },
    showPanel: (panelId) => {
      env.setState((state) => ({
        panels: {
          ...state.panels,
          open: {
            ...state.panels.open,
            [panelId]: true,
          },
          mobileOpenPanel: env.shouldUseMobilePanel() ? panelId : state.panels.mobileOpenPanel,
        },
      }));
    },
    openMobilePanel: (panelId) => {
      env.setState((state) => ({
        panels: {
          ...state.panels,
          mobileOpenPanel: panelId,
        },
      }));
    },
    toggleHierarchyNode: (objectId) => {
      env.setState((state) => {
        const collapsed = new Set(state.panels.collapsedNodeIds);
        if (collapsed.has(objectId)) {
          collapsed.delete(objectId);
        } else {
          collapsed.add(objectId);
        }

        return {
          panels: {
            ...state.panels,
            collapsedNodeIds: [...collapsed],
          },
        };
      });
    },
    setViewportRect: (width, height) => {
      env.setState((state) => ({
        viewport: {
          ...state.viewport,
          width,
          height,
        },
      }));
    },
    panViewport: (deltaX, deltaY) => {
      env.setState((state) => ({
        viewport: {
          ...state.viewport,
          x: state.viewport.x + deltaX,
          y: state.viewport.y + deltaY,
        },
      }));
    },
    setZoom: (nextZoom) => {
      env.setState((state) => ({
        viewport: {
          ...state.viewport,
          zoom: Math.max(0.65, Math.min(nextZoom, 1.6)),
        },
      }));
    },
    setTemporaryToolOverride: (tool) => {
      env.setState((state) => {
        if (tool === 'pan' && state.activeTool === 'pan') {
          return state;
        }
        if (state.temporaryToolOverride === tool) {
          return state;
        }
        return {
          temporaryToolOverride: tool,
        };
      });
    },
  };
}
