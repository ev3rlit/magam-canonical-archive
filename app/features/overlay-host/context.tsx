import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import {
  closeOverlay,
  measureOverlay,
  openOverlay,
  replaceOverlay,
  reflowOverlays,
} from './commands';
import { resolveOverlayZIndex } from './layers';
import {
  canDismissOverlay,
  focusOverlayOnOpen,
  isOutsideOverlay,
  restoreFocusForOverlay,
} from './lifecycle';
import { initialOverlayHostState, resolveTopmostOverlay } from './state';
import { getWindowViewport } from './positioning';
import type {
  OverlayContribution,
  OverlayDismissReason,
  OverlayHostApi,
  OverlayHostState,
  OverlayInstanceState,
} from './types';

type OverlayHostContextValue = OverlayHostApi & {
  active: OverlayInstanceState[];
};

const OverlayHostContext = createContext<OverlayHostContextValue | null>(null);

function runDismissEffects(instances: OverlayInstanceState[], reason: OverlayDismissReason): void {
  instances.forEach((instance) => {
    instance.onDismiss?.(reason);
    void restoreFocusForOverlay(instance);
  });
}

function OverlayHostItem(input: {
  instance: OverlayInstanceState;
  order: number;
  registerElement: (instanceId: string, element: HTMLElement | null) => void;
  onMeasure: (instanceId: string, element: HTMLElement) => void;
  close: OverlayHostApi['close'];
  isTopMost: boolean;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const { instance, registerElement, onMeasure } = input;

  useLayoutEffect(() => {
    registerElement(instance.instanceId, ref.current);
    if (ref.current) {
      onMeasure(instance.instanceId, ref.current);
    }

    return () => {
      registerElement(instance.instanceId, null);
    };
  }, [
    instance.instanceId,
    instance.anchor,
    instance.render,
    onMeasure,
    registerElement,
  ]);

  return createPortal(
    <div
      ref={ref}
      data-overlay-instance-id={instance.instanceId}
      data-overlay-slot={instance.slot}
      style={{
        position: 'fixed',
        left: `${instance.resolvedPosition.x}px`,
        top: `${instance.resolvedPosition.y}px`,
        zIndex: resolveOverlayZIndex(instance.priority, input.order),
        pointerEvents: 'auto',
      }}
    >
      {instance.render({
        instanceId: instance.instanceId,
        close: (reason = 'programmatic-close') => input.close(instance.instanceId, reason),
        isTopMost: input.isTopMost,
      })}
    </div>,
    document.body,
  );
}

export function OverlayHostProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<OverlayHostState>(initialOverlayHostState);
  const stateRef = useRef(state);
  const elementMapRef = useRef(new Map<string, HTMLElement | null>());
  const previousTopMostIdRef = useRef<string | null>(null);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const registerElement = useCallback((instanceId: string, element: HTMLElement | null) => {
    if (element) {
      elementMapRef.current.set(instanceId, element);
      return;
    }

    elementMapRef.current.delete(instanceId);
  }, []);

  const onMeasure = useCallback((instanceId: string, element: HTMLElement) => {
    const nextState = measureOverlay({
      state: stateRef.current,
      instanceId,
      size: {
        width: element.getBoundingClientRect().width,
        height: element.getBoundingClientRect().height,
      },
      viewport: getWindowViewport(),
    });

    if (nextState !== stateRef.current) {
      stateRef.current = nextState;
      setState(nextState);
    }
  }, []);

  const open = useCallback((contribution: OverlayContribution) => {
    const result = openOverlay({
      state: stateRef.current,
      contribution,
      viewport: getWindowViewport(),
    });

    if (result.replacedInstance) {
      runDismissEffects([result.replacedInstance], 'programmatic-replace');
    }

    stateRef.current = result.state;
    setState(result.state);
    return result.instanceId;
  }, []);

  const close = useCallback((instanceId: string, reason: OverlayDismissReason) => {
    const result = closeOverlay({
      state: stateRef.current,
      instanceId,
      reason,
    });

    stateRef.current = result.state;
    setState(result.state);
    if (result.closedInstance) {
      runDismissEffects([result.closedInstance], reason);
    }
  }, []);

  const replace = useCallback((instanceId: string, contribution: OverlayContribution) => {
    const result = replaceOverlay({
      state: stateRef.current,
      instanceId,
      contribution,
      viewport: getWindowViewport(),
    });

    stateRef.current = result.state;
    setState(result.state);
    runDismissEffects([result.replacedInstance], 'programmatic-replace');
    return result.instanceId;
  }, []);

  const closeBySlot = useCallback((slot: OverlayInstanceState['slot'], reason: OverlayDismissReason) => {
    const result = closeOverlayBySlot({
      state: stateRef.current,
      slot,
      reason,
    });

    stateRef.current = result.state;
    setState(result.state);
    if (result.closedInstances.length > 0) {
      runDismissEffects(result.closedInstances, reason);
    }
  }, []);

  const getActive = useCallback(() => stateRef.current.active, []);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    const handlePointer = (event: MouseEvent | TouchEvent) => {
      const topMost = resolveTopmostOverlay(stateRef.current.active);
      if (!topMost || !canDismissOverlay(topMost, 'outside-pointer')) {
        return;
      }

      const root = elementMapRef.current.get(topMost.instanceId);
      if (!isOutsideOverlay(root, event.target)) {
        return;
      }

      close(topMost.instanceId, 'outside-pointer');
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return;
      }

      const topMost = resolveTopmostOverlay(stateRef.current.active);
      if (!topMost || !canDismissOverlay(topMost, 'escape-key')) {
        return;
      }

      event.preventDefault();
      close(topMost.instanceId, 'escape-key');
    };

    const handleResize = () => {
      const nextState = reflowOverlays({
        state: stateRef.current,
        viewport: getWindowViewport(),
      });
      stateRef.current = nextState;
      setState(nextState);
    };

    document.addEventListener('mousedown', handlePointer, true);
    document.addEventListener('touchstart', handlePointer, true);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleResize);

    return () => {
      document.removeEventListener('mousedown', handlePointer, true);
      document.removeEventListener('touchstart', handlePointer, true);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleResize);
    };
  }, [close]);

  useEffect(() => {
    const topMost = resolveTopmostOverlay(state.active);
    const nextTopMostId = topMost?.instanceId ?? null;
    if (!nextTopMostId || previousTopMostIdRef.current === nextTopMostId) {
      previousTopMostIdRef.current = nextTopMostId;
      return;
    }

    previousTopMostIdRef.current = nextTopMostId;
    requestAnimationFrame(() => {
      const root = elementMapRef.current.get(nextTopMostId) ?? null;
      focusOverlayOnOpen(root, topMost.focusPolicy);
    });
  }, [state.active]);

  useEffect(() => {
    return () => {
      if (stateRef.current.active.length > 0) {
        // Canvas host teardown is scoped to canvas-level overlays only.
        runDismissEffects(stateRef.current.active, 'viewport-teardown');
      }
    };
  }, []);

  const value = useMemo<OverlayHostContextValue>(() => ({
    open,
    close,
    replace,
    closeBySlot,
    getActive,
    active: state.active,
  }), [close, closeBySlot, getActive, open, replace, state.active]);

  return (
    <OverlayHostContext.Provider value={value}>
      {children}
      {typeof document !== 'undefined' && state.active.map((instance, index) => (
        <OverlayHostItem
          key={instance.instanceId}
          instance={instance}
          order={index}
          registerElement={registerElement}
          onMeasure={onMeasure}
          close={close}
          isTopMost={index === state.active.length - 1}
        />
      ))}
    </OverlayHostContext.Provider>
  );
}

export function useOverlayHost(): OverlayHostContextValue {
  const context = useContext(OverlayHostContext);
  if (!context) {
    // Global dialogs/search/tab menus must stay outside this provider boundary.
    throw new Error('OVERLAY_SCOPE_VIOLATION');
  }

  return context;
}
