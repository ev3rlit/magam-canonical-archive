import type { Metadata } from 'next';
import { Caveat, Gaegu, Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const gaegu = Gaegu({
  subsets: ['latin'],
  variable: '--font-gaegu',
  weight: ['400', '700'],
});
const caveat = Caveat({
  subsets: ['latin'],
  variable: '--font-caveat',
  weight: ['400', '700'],
});

const KR_FALLBACKS = '"Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", "Segoe UI", system-ui, sans-serif';
const fontPresetCSS = `:root {
  --font-preset-hand-gaegu: ${gaegu.style.fontFamily}, ${KR_FALLBACKS};
  --font-preset-hand-caveat: ${caveat.style.fontFamily}, ${KR_FALLBACKS};
  --font-preset-sans-inter: ${inter.style.fontFamily}, ${KR_FALLBACKS};
}`;

export const metadata: Metadata = {
  title: '최범휘',
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
      <body className={`${inter.className} ${inter.variable} ${gaegu.variable} ${caveat.variable}`}>{children}</body>
    </html>
  );
}
