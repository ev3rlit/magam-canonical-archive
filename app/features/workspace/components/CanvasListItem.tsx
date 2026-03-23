import React from 'react';
import type { SidebarDocumentEntry } from '@/components/ui/Sidebar';
import { ChevronRight, FileCode2 } from 'lucide-react';

interface CanvasListItemProps {
  document: SidebarDocumentEntry;
  onClick: () => void;
}

export function CanvasListItem({ document, onClick }: CanvasListItemProps) {
  return (
    <div
      onClick={onClick}
      className="flex items-center px-4 py-3 cursor-pointer bg-surface-container-lowest hover:bg-surface-container-low rounded-xl transition-colors group"
    >
      <div className="w-10 h-10 rounded-lg bg-surface flex items-center justify-center text-primary font-manrope font-bold text-sm mr-4 shadow-[inset_0_2px_4px_rgba(44,47,48,0.02)]">
        <FileCode2 size={20} className="text-primary/70" />
      </div>
      
      <div className="flex-1 min-w-0 flex items-center gap-4">
        <h3 className="font-manrope font-semibold text-sm text-on-surface group-hover:text-primary transition-colors truncate">
          {document.title || 'Untitled Canvas'}
        </h3>
        <p className="font-inter text-xs text-on-surface-variant truncate hidden sm:block">
          {document.relativePath}
        </p>
      </div>

      <div className="flex items-center gap-4">
        <span className="text-[10px] font-medium text-on-surface-variant bg-surface-container-highest px-2 py-1 rounded-md hidden md:block">
          Last edited recently
        </span>
        <ChevronRight size={16} className="text-on-surface-variant opacity-0 group-hover:opacity-100 transition-opacity -translate-x-2 group-hover:translate-x-0" />
      </div>
    </div>
  );
}
