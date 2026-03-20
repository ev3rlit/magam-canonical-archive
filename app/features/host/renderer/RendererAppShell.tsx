'use client';

import { useEffect } from 'react';
import { WorkspaceClient } from '@/components/editor/WorkspaceClient';
import { getHostRuntime } from './createHostRuntime';

const KR_FALLBACKS =
  '"Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", "Segoe UI", system-ui, sans-serif';
const HANDWRITING_FALLBACKS =
  '"Comic Sans MS", "Segoe Print", "Marker Felt", "Bradley Hand", cursive';
const SANS_FALLBACKS =
  '"Helvetica Neue", Arial, "Liberation Sans", sans-serif';
const fontPresetCSS = `:root {
  --font-preset-hand-gaegu: ${HANDWRITING_FALLBACKS}, ${KR_FALLBACKS};
  --font-preset-hand-caveat: ${HANDWRITING_FALLBACKS}, ${KR_FALLBACKS};
  --font-preset-sans-inter: ${SANS_FALLBACKS}, ${KR_FALLBACKS};
}`;

export function RendererAppShell() {
  useEffect(() => {
    void getHostRuntime().bootstrap.markLoading();
  }, []);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: fontPresetCSS }} />
      <WorkspaceClient />
    </>
  );
}
