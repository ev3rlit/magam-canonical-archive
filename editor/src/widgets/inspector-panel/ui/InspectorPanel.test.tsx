// @vitest-environment jsdom

import type { ReactNode } from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppProvider } from '../../../app/providers/AppProvider';
import { useEditorStore } from '../../../core/editor/model/editor-store';
import { InspectorPanel } from './InspectorPanel';

function renderInProvider(children: ReactNode, root: Root) {
  act(() => {
    root.render(
      <AppProvider>
        {children}
      </AppProvider>,
    );
  });
}

function findInputByLabel(container: HTMLElement, label: string) {
  const labels = Array.from(container.querySelectorAll('.inspector-field'));
  const match = labels.find((field) => field.querySelector('.inspector-field__label')?.textContent === label);
  return match?.querySelector('input') as HTMLInputElement | null;
}

describe('InspectorPanel geometry controls', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    window.matchMedia = window.matchMedia ?? (((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    })) as typeof window.matchMedia);
    useEditorStore.getState().reset();
    useEditorStore.getState().setViewportRect(1200, 800);
    useEditorStore.getState().createObjectAtViewportCenter('shape');
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('renders and updates the rotation field', () => {
    renderInProvider(<InspectorPanel />, root);

    const rotationInput = findInputByLabel(container, 'Rotation');
    expect(rotationInput).toBeTruthy();
    if (!rotationInput) {
      throw new Error('Rotation input not found');
    }

    const valueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    act(() => {
      valueSetter?.call(rotationInput, '450');
      rotationInput.dispatchEvent(new Event('input', { bubbles: true }));
      rotationInput.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(useEditorStore.getState().scene.objects[0]?.rotation).toBe(90);
  });

  it('renders appearance editors and applies shape plus fill changes', () => {
    renderInProvider(<InspectorPanel />, root);

    expect(container.textContent).toContain('스타일');
    expect(container.textContent).toContain('모양');
    expect(container.textContent).toContain('채우기');
    expect(container.textContent).toContain('테두리');

    const pillButton = container.querySelector('[aria-label="캡슐"]') as HTMLButtonElement;
    expect(pillButton).toBeTruthy();

    act(() => {
      pillButton.click();
    });

    const colorInputs = container.querySelectorAll('.object-style-editor__color-input');
    const fillColorInput = colorInputs[0] as HTMLInputElement;
    expect(fillColorInput).toBeTruthy();

    const valueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    act(() => {
      valueSetter?.call(fillColorInput, '#112233');
      fillColorInput.dispatchEvent(new Event('input', { bubbles: true }));
      fillColorInput.dispatchEvent(new Event('change', { bubbles: true }));
    });

    const shape = useEditorStore.getState().scene.objects[0]!;
    expect(shape.shapeVariant).toBe('pill');
    expect(shape.fillColor).toBe('#112233');
  });

  it('hides the shape editor for non-shape objects', () => {
    useEditorStore.getState().reset();
    useEditorStore.getState().setViewportRect(1200, 800);
    useEditorStore.getState().createObjectAtViewportCenter('sticky');

    renderInProvider(<InspectorPanel />, root);

    expect(container.textContent).toContain('채우기');
    expect(container.textContent).toContain('테두리');
    expect(container.querySelector('[aria-label="사각형"]')).toBeNull();
  });

  it('focuses the requested appearance section', () => {
    renderInProvider(<InspectorPanel />, root);

    const shapeId = useEditorStore.getState().selection.primaryId!;
    const focusTargets = container.querySelectorAll('.inspector-focus-target');
    const borderTarget = focusTargets[1] as HTMLDivElement;
    expect(borderTarget).toBeTruthy();

    act(() => {
      useEditorStore.getState().requestStyleFocus(shapeId, 'border');
    });

    expect(document.activeElement).toBe(borderTarget);
  });
});
