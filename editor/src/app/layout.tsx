import type { Metadata } from 'next';
import { Inter, Manrope } from 'next/font/google';
import './styles/foundation.css';
import './styles/shell.css';
import './styles/widget-base.css';
import './styles/panel-widgets.css';
import './styles/canvas-widget.css';
import { AppProvider } from '@/app/providers/AppProvider';
import { ThemeProvider } from '@/app/providers/ThemeProvider';

const headlineFont = Manrope({
  subsets: ['latin'],
  variable: '--font-headline',
  display: 'swap',
});

const bodyFont = Inter({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Magam Editor',
  description: 'Canvas-first editor shell for the Magam reset.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html className={`${headlineFont.variable} ${bodyFont.variable}`} lang="en">
      <body>
        <ThemeProvider>
          <AppProvider>{children}</AppProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
