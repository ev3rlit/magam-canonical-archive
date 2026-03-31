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
  chrome = 'panel',
  collapsible = false,
  entryDelayMs = 0,
  headerActions,
  panelClassName,
  panelId,
  side,
  subtitle,
  title,
  titleClassName,
}: {
  bodyClassName?: string;
  children: ReactNode;
  chrome?: 'panel' | 'canvas';
  collapsible?: boolean;
  entryDelayMs?: number;
  headerActions?: ReactNode;
  panelClassName?: string;
  panelId?: EditorPanelId;
  side: 'left' | 'center' | 'right' | 'bottom';
  subtitle?: string;
  title: string;
  titleClassName?: string;
}) {
  const panels = useEditorStore((state) => state.panels);
  const openMobilePanel = useEditorStore((state) => state.openMobilePanel);
  const showPanel = useEditorStore((state) => state.showPanel);
  const togglePanel = useEditorStore((state) => state.togglePanel);

  const isExpanded = collapsible && panelId ? panels.open[panelId] : true;
  const isMobileActive = collapsible && panelId ? panels.mobileOpenPanel === panelId : false;
  const directionLabel = isExpanded ? 'Collapse' : 'Expand';
  const toggleGlyph = side === 'left'
    ? (isExpanded ? '<' : '>')
    : side === 'right'
      ? (isExpanded ? '>' : '<')
      : (isExpanded ? 'v' : '^');

  const handlePeek = () => {
    if (!panelId) {
      return;
    }
    if (isMobileViewport()) {
      openMobilePanel(panelId);
      return;
    }
    showPanel(panelId);
  };

  const handleToggle = () => {
    if (!panelId) {
      return;
    }
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
          'widget-shell--canvas': chrome === 'canvas',
          'widget-shell--collapsed': collapsible && !isExpanded,
          'widget-shell--mobile-active': isMobileActive,
        })}
        style={{
          ['--widget-enter-delay' as string]: `${entryDelayMs}ms`,
        }}
      >
        {collapsible ? (
          <button
            aria-label={`${directionLabel} ${title}`}
            className="widget-shell__peek"
            onClick={handlePeek}
            title={`${directionLabel} ${title}`}
            type="button"
          >
            <span className="widget-shell__peek-label">{title}</span>
          </button>
        ) : null}
        <section className={clsx('editor-panel widget-shell__panel', panelClassName)}>
          <div className="editor-panel__header">
            <div>
              <h2 className={clsx('editor-panel__title', titleClassName)}>{title}</h2>
              {subtitle ? <p className="editor-panel__subtitle">{subtitle}</p> : null}
            </div>
            <div className="widget-shell__header-actions">
              {headerActions}
              {collapsible ? (
                <button
                  aria-label={`${directionLabel} ${title}`}
                  className="widget-shell__toggle"
                  onClick={handleToggle}
                  title={`${directionLabel} ${title}`}
                  type="button"
                >
                  <span className="widget-shell__toggle-glyph">{toggleGlyph}</span>
                </button>
              ) : null}
            </div>
          </div>
          <div className={clsx('editor-panel__body', bodyClassName)}>{children}</div>
        </section>
      </div>
    </>
  );
}
