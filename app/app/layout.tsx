import type { Metadata } from 'next';
import './globals.css';

const KR_FALLBACKS = '"Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", "Segoe UI", system-ui, sans-serif';
const HANDWRITING_FALLBACKS = '"Comic Sans MS", "Segoe Print", "Marker Felt", "Bradley Hand", cursive';
const SANS_FALLBACKS = '"Helvetica Neue", Arial, "Liberation Sans", sans-serif';
const fontPresetCSS = `:root {
  --font-preset-hand-gaegu: ${HANDWRITING_FALLBACKS}, ${KR_FALLBACKS};
  --font-preset-hand-caveat: ${HANDWRITING_FALLBACKS}, ${KR_FALLBACKS};
  --font-preset-sans-inter: ${SANS_FALLBACKS}, ${KR_FALLBACKS};
}`;

export const metadata: Metadata = {
  title: 'magam',
  description: 'AI-Native Programmatic Whiteboard',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <style dangerouslySetInnerHTML={{ __html: fontPresetCSS }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
