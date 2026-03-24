import React from 'react';
import { useGraphStore } from '@/store/graph';
import { Layers, MousePointer2 } from 'lucide-react';
import { Badge } from './Badge';

export const Footer: React.FC = () => {
  const { selectedNodeIds } = useGraphStore();
  const count = selectedNodeIds.length;

  return (
    <footer className="flex h-9 select-none items-center justify-between bg-muted/72 px-4 text-xs text-foreground/58 shadow-[inset_0_1px_0_rgb(var(--color-border)/0.08)]">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5 transition-colors">
          <MousePointer2 className="w-3.5 h-3.5" />
          {count === 0 ? (
            <span>No selection</span>
          ) : (
            <Badge variant="primary">
              Selected: {count} node{count === 1 ? '' : 's'}
            </Badge>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex cursor-default items-center gap-1.5 transition-colors hover:text-foreground/72">
          <Layers className="w-3.5 h-3.5" />
          <span>Master</span>
        </div>
        <span>UTF-8</span>
        <span>TypeScript React</span>
      </div>
    </footer>
  );
};
