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
      <body className={`${inter.className} ${inter.variable} ${gaegu.variable} ${caveat.variable}`}>{children}</body>
    </html>
  );
}
