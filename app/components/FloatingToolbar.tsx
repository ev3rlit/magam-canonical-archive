'use client';

import React from 'react';
import { MousePointer2, Hand, ZoomIn, ZoomOut, Maximize } from 'lucide-react';
import { cn } from '@/utils/cn';
import { FontSelector } from './FontSelector';


export type InteractionMode = 'pointer' | 'hand';

interface FloatingToolbarProps {
    interactionMode: InteractionMode;
    onInteractionModeChange: (mode: InteractionMode) => void;
    onZoomIn: () => void;
    onZoomOut: () => void;
    onFitView: () => void;
}

export const FloatingToolbar: React.FC<FloatingToolbarProps> = ({
    interactionMode,
    onInteractionModeChange,
    onZoomIn,
    onZoomOut,
    onFitView,
}) => {
    return (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 p-1.5 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-full shadow-xl">
            {/* Mode Toggle */}
            <ToolbarButton
                active={interactionMode === 'pointer'}
                onClick={() => onInteractionModeChange('pointer')}
                title="Selection Mode (V)"
                icon={<MousePointer2 className="w-4 h-4" />}
            />
            <ToolbarButton
                active={interactionMode === 'hand'}
                onClick={() => onInteractionModeChange('hand')}
                title="Pan Mode (H)"
                icon={<Hand className="w-4 h-4" />}
            />

            {/* Divider */}
            <div className="w-px h-4 bg-slate-300 dark:bg-slate-700 mx-1" />

            {/* Zoom Controls */}
            <ToolbarButton
                onClick={onZoomIn}
                title="Zoom In (+)"
                icon={<ZoomIn className="w-4 h-4" />}
            />
            <ToolbarButton
                onClick={onZoomOut}
                title="Zoom Out (-)"
                icon={<ZoomOut className="w-4 h-4" />}
            />
            <ToolbarButton
                onClick={onFitView}
                title="Fit View (Space)"
                icon={<Maximize className="w-4 h-4" />}
            />

            {/* Divider */}
            <div className="w-px h-4 bg-slate-300 dark:bg-slate-700 mx-1" />

            {/* Global Font Selector */}
            <FontSelector />

        </div>
    );
};

interface ToolbarButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    active?: boolean;
    icon: React.ReactNode;
}

const ToolbarButton: React.FC<ToolbarButtonProps> = ({ active, icon, className, ...props }) => {
    return (
        <button
            type="button"
            className={cn(
                "p-2 rounded-md transition-all duration-200",
                "hover:bg-slate-100 dark:hover:bg-slate-800",
                active
                    ? "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400"
                    : "text-slate-500 dark:text-slate-400",
                className
            )}
            {...props}
        >
            {icon}
        </button>
    );
};
