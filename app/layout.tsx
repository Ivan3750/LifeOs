import type { Metadata, Viewport } from 'next';
import { JetBrains_Mono, Onest } from 'next/font/google';
import './globals.css';

const onest = Onest({ variable: '--font-onest', subsets: ['latin', 'cyrillic'], weight: ['400', '500', '600', '700', '800'] });
const mono = JetBrains_Mono({ variable: '--font-mono', subsets: ['latin', 'cyrillic'], weight: ['500', '600'] });

export const metadata: Metadata = {
  title: 'LifeOs',
  description: 'Особиста ОС життя: один екран, що каже, що робити зараз. Фокус, задачі, звички, здоровʼя і цілі.',
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: 'LifeOs', statusBarStyle: 'black-translucent' },
  icons: { icon: '/icon.svg' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ECEBE8' },
    { media: '(prefers-color-scheme: dark)', color: '#0D0C0B' },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // font variables live on <html> because the theme tokens on :root reference them
    <html lang="uk" className={`${onest.variable} ${mono.variable}`} suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
