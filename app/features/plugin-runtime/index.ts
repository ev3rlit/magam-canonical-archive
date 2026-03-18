import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type PropsWithChildren,
} from 'react';
import { PluginRuntimeRegistry } from './registry';
import { registerExamplePluginCatalog } from './examples';

const PluginRuntimeRegistryContext = createContext<PluginRuntimeRegistry | null>(null);

export function PluginRuntimeProvider({ children }: PropsWithChildren): JSX.Element {
  const registryRef = useRef<PluginRuntimeRegistry | null>(null);
  if (!registryRef.current) {
    registryRef.current = new PluginRuntimeRegistry();
  }

  const registry = registryRef.current;
  useEffect(() => {
    registerExamplePluginCatalog(registry);
  }, [registry]);

  const contextValue = useMemo(() => registry, [registry]);
  return React.createElement(
    PluginRuntimeRegistryContext.Provider,
    { value: contextValue },
    children,
  );
}

export function usePluginRuntimeRegistry(): PluginRuntimeRegistry {
  const context = useContext(PluginRuntimeRegistryContext);
  if (!context) {
    throw new Error('usePluginRuntimeRegistry must be used inside PluginRuntimeProvider.');
  }
  return context;
}

export * from './types';
export * from './registry';
export * from './loader';
export * from './capabilityGate';
export * from './bridge';
export * from './iframeHost';
export * from './instanceHydration';
export * from './fallback';
