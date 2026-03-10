import * as React from 'react';
import { EmbedScopeContext, useEmbedScope } from '../context/EmbedScopeContext';

/**
 * Low-level scoping primitive.
 * Prefer `frame(...)` for new reusable public APIs.
 */
export function EmbedScope({ id, children }: { id: string; children: React.ReactNode }) {
  const parentScope = useEmbedScope();
  const fullScope = parentScope ? `${parentScope}.${id}` : id;
  return <EmbedScopeContext.Provider value={fullScope}>{children}</EmbedScopeContext.Provider>;
}
