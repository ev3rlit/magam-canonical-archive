import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RendererAppShell } from './RendererAppShell';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Desktop renderer root container is missing.');
}

createRoot(container).render(
  <StrictMode>
    <RendererAppShell />
  </StrictMode>,
);
