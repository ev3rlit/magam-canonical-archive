import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from '@/features/theme/provider';
import { fontPresetCSS } from '@/features/theme/document';
import { getThemeBootstrapScript } from '@/features/theme/runtime';

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
    <html lang="en" suppressHydrationWarning data-theme="light">
      <head>
        <style dangerouslySetInnerHTML={{ __html: fontPresetCSS }} />
        <script dangerouslySetInnerHTML={{ __html: getThemeBootstrapScript() }} />
      </head>
      <body className="bg-background text-foreground antialiased">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
