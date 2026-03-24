import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider } from '@/features/theme/provider';
import {
  ensureFontPresetStyle,
  initializeThemeDocument,
} from '@/features/theme/document';
import { RendererAppShell } from './RendererAppShell';

ensureFontPresetStyle(document);
initializeThemeDocument(window, document);

const container = document.getElementById('root');
if (!container) {
  throw new Error('Desktop renderer root container is missing.');
}

createRoot(container).render(
  <StrictMode>
    <ThemeProvider>
      <RendererAppShell />
    </ThemeProvider>
  </StrictMode>,
);
