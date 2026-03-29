'use client';

import clsx from 'clsx';
import type { ReactNode } from 'react';
import { useEditorStore } from '@/core/editor/model/editor-store';
import type { EditorPanelId } from '@/core/editor/model/editor-types';

function isMobileViewport() {
  return typeof window !== 'undefined' && window.matchMedia('(max-width: 920px)').matches;
}

export function WidgetBase({
  bodyClassName,
  children,
  panelId,
  side,
  subtitle,
  title,
}: {
  bodyClassName?: string;
  children: ReactNode;
  panelId: EditorPanelId;
  side: 'left' | 'right';
  subtitle?: string;
  title: string;
}) {
  const panels = useEditorStore((state) => state.panels);
  const openMobilePanel = useEditorStore((state) => state.openMobilePanel);
  const showPanel = useEditorStore((state) => state.showPanel);
  const togglePanel = useEditorStore((state) => state.togglePanel);

  const isExpanded = panels.open[panelId];
  const isMobileActive = panels.mobileOpenPanel === panelId;
  const directionLabel = isExpanded ? 'Collapse' : 'Expand';

  const handlePeek = () => {
    if (isMobileViewport()) {
      openMobilePanel(panelId);
      return;
    }
    showPanel(panelId);
  };

  const handleToggle = () => {
    if (isMobileViewport()) {
      openMobilePanel(isMobileActive ? null : panelId);
      return;
    }
    togglePanel(panelId);
  };

  return (
    <>
      {isMobileActive ? (
        <button
          aria-label={`Close ${title}`}
          className="widget-shell__backdrop"
          onClick={() => openMobilePanel(null)}
          type="button"
        />
      ) : null}
      <div
        className={clsx('widget-shell', `widget-shell--${side}`, {
          'widget-shell--collapsed': !isExpanded,
          'widget-shell--mobile-active': isMobileActive,
        })}
      >
        <button
          aria-label={`${directionLabel} ${title}`}
          className="widget-shell__peek"
          onClick={handlePeek}
          title={`${directionLabel} ${title}`}
          type="button"
        >
          <span className="widget-shell__peek-label">{title}</span>
        </button>
        <section className="editor-panel widget-shell__panel">
          <div className="editor-panel__header">
            <div>
              <h2 className="editor-panel__title">{title}</h2>
              {subtitle ? <p className="editor-panel__subtitle">{subtitle}</p> : null}
            </div>
            <button
              aria-label={`${directionLabel} ${title}`}
              className="widget-shell__toggle"
              onClick={handleToggle}
              title={`${directionLabel} ${title}`}
              type="button"
            >
              {side === 'left' ? (isExpanded ? '<' : '>') : (isExpanded ? '>' : '<')}
            </button>
          </div>
          <div className={clsx('editor-panel__body', bodyClassName)}>{children}</div>
        </section>
      </div>
    </>
  );
}
