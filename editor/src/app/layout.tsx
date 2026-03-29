import type { Metadata } from 'next';
import './globals.css';
import { AppProvider } from '@/app/providers/AppProvider';
import { ThemeProvider } from '@/app/providers/ThemeProvider';

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
    <html lang="en">
      <body>
        <ThemeProvider>
          <AppProvider>{children}</AppProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
