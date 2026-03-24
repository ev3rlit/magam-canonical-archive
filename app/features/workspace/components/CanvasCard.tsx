import React from 'react';
import type { SidebarCanvasEntry } from '@/components/ui/Sidebar';
import { FileImage } from 'lucide-react';
import { getWorkspaceCopy } from '../copy';

interface CanvasCardProps {
  canvas: SidebarCanvasEntry;
  onClick: () => void;
}

export function CanvasCard({ canvas, onClick }: CanvasCardProps) {
  const copy = getWorkspaceCopy().shared;
  return (
    <div
      onClick={onClick}
      className={`p-0 cursor-pointer bg-surface-container-lowest rounded-2xl shadow-[0_8px_32px_rgba(44,47,48,0.06)] hover:shadow-[0_12px_48px_rgba(44,47,48,0.1)] hover:-translate-y-1 transition-all group flex flex-col relative overflow-hidden h-64`}
    >
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-primary-container opacity-0 group-hover:opacity-100 transition-opacity z-10" />
      
      {/* Thumbnail Area - Using generic placeholder for now as snapshot URL logic requires integration */}
      <div className="flex-1 bg-surface-container-low flex items-center justify-center overflow-hidden border-b border-white/5 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/5 mix-blend-multiply" />
        <FileImage size={48} className="text-on-surface-variant opacity-20 group-hover:scale-110 transition-transform duration-500" />
      </div>

      <div className="p-4 bg-surface-container-lowest">
        <h3 className="font-manrope font-semibold text-base text-on-surface group-hover:text-primary transition-colors line-clamp-1">
          {canvas.title || copy.untitledCanvas}
        </h3>
        <div className="flex items-center justify-between mt-1">
          <p className="font-inter text-xs text-on-surface-variant truncate">
            {copy.canvasLabel}
          </p>
          <span className="text-[10px] font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full whitespace-nowrap ml-2">
            {copy.canvasLabel}
          </span>
        </div>
      </div>
    </div>
  );
}
