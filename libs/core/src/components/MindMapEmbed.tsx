import * as React from 'react';
import { MindMapEmbedContext, useMindMapEmbed } from '../context/MindMapEmbedContext';
import type { FromProp } from './Node';

export interface MindMapEmbedProps {
  id: string;
  from?: FromProp;
  sourceFile?: string;
  children?: React.ReactNode;
}

/**
 * Low-level MindMap subtree primitive.
 * Prefer `frame(...)` for new reusable public APIs.
 */
export function MindMapEmbed({ id, from, sourceFile, children }: MindMapEmbedProps) {
  const parentEmbed = useMindMapEmbed();
  const scope = parentEmbed ? `${parentEmbed.scope}.${id}` : id;

  return (
    <MindMapEmbedContext.Provider
      value={{ scope, from, sourceFile: sourceFile ?? parentEmbed?.sourceFile }}
    >
      {children}
    </MindMapEmbedContext.Provider>
  );
}
