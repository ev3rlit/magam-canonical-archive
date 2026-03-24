import React from 'react';
import { cn } from '@/utils/cn';
import { Home, Component, LayoutTemplate, Settings } from 'lucide-react';
import { getWorkspaceCopy } from '../copy';

interface SidebarItemProps {
  icon: React.ReactNode;
  label: string;
  isActive?: boolean;
  onClick?: () => void;
}

function SidebarItem({ icon, label, isActive, onClick }: SidebarItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 w-full px-4 py-3 rounded-xl transition-colors font-inter text-sm font-medium',
        isActive
          ? 'bg-primary/10 text-primary font-semibold'
          : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
      )}
    >
      {React.cloneElement(icon as React.ReactElement, {
        size: 18,
        className: isActive ? 'text-primary' : 'text-on-surface-variant'
      })}
      {label}
    </button>
  );
}

export function DashboardSidebar() {
  const copy = getWorkspaceCopy().sidebar;
  return (
    <aside className="flex flex-col h-full w-64 bg-surface-container-low text-on-surface p-4 flex-shrink-0">
      <div className="flex items-center px-4 py-4 mb-6">
        <h1 className="font-manrope font-bold text-headline-sm text-on-surface tracking-tight">{copy.brand}</h1>
      </div>

      <nav className="flex-1 space-y-1">
        <SidebarItem icon={<Home />} label={copy.workspaces} isActive />
        <SidebarItem icon={<LayoutTemplate />} label={copy.templates} />
        <SidebarItem icon={<Component />} label={copy.components} />
      </nav>

      <div className="mt-auto">
        <SidebarItem icon={<Settings />} label={copy.settings} />
      </div>
    </aside>
  );
}
