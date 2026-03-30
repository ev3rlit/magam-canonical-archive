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
});
