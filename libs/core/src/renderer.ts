import * as ReactReconciler from 'react-reconciler';
import type { ReactNode } from 'react';
import * as HostConfig from './reconciler/hostConfig';
import { Container } from './reconciler/hostConfig';
import { applyLayout } from './layout/elk';
import { resolveMindMapEmbeds } from './reconciler/resolveMindMapEmbeds';
import { resolveTreeAnchors } from './reconciler/resolveTreeAnchors';
import { extractCanvasMeta } from './reconciler/extractCanvasMeta';
import { ResultAsync, ok, err, fromPromise } from './result';
import { RenderError, LayoutError } from './result';

const Reconciler = (ReactReconciler as any).default || ReactReconciler;

// @ts-ignore
let reconciler: any = null;

function getReconciler() {
  if (!reconciler) {
    // @ts-ignore
    reconciler = Reconciler(HostConfig);
  }
  return reconciler;
}

const LEGACY_ROOT = 0;

// ... (existing helper function code to be kept)

export function renderToGraph(element: ReactNode): ResultAsync<Container, RenderError | LayoutError> {
  const container: Container = { type: 'root', children: [] };
  let capturedError: Error | null = null;

  const root = getReconciler().createContainer(
    container,
    LEGACY_ROOT,
    null,
    false,
    null,
    '',
    (e: Error) => {
      capturedError = e;
    },
    null,
  );

  // Wrap reconciliation in a Promise-like structure since it involves microtask timing
  const renderPromise = new Promise<'RECONCILED' | 'ERROR'>((resolve) => {
    try {
      getReconciler().updateContainer(element, root, null, () => {
        // completion callback
      });
      // Wait for microtasks (useEffect/rendering effects)
      setTimeout(() => {
        if (capturedError) resolve('ERROR');
        else resolve('RECONCILED');
      }, 0);
    } catch (e) {
      console.error('[Renderer] Reconciliation Error:', e);
      capturedError = e as Error;
      resolve('ERROR');
    }
  });

  return fromPromise(
    renderPromise,
    (e) => new RenderError('Unexpected error during reconciliation promise', e)
  ).andThen((status) => {
    if (status === 'ERROR' || capturedError) {
      return err(new RenderError('Reconciliation failed', capturedError));
    }
    return ok(resolveTreeAnchors(resolveMindMapEmbeds(extractCanvasMeta(container))));
  }).andThen(applyLayout);
}
