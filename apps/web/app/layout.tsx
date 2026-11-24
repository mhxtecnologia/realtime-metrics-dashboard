import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import type { ReactNode } from 'react';
import { THEME_BOOT_SCRIPT } from '@/lib/theme';
import './globals.css';

export const metadata: Metadata = {
  title: 'Realtime metrics dashboard',
  description: 'Live sales, latency, errors and online users streamed over a WebSocket.',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f7f8fa' },
    { media: '(prefers-color-scheme: dark)', color: '#0f1216' },
  ],
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Nonce gerado no middleware por requisição; libera só este script inline na CSP.
  const nonce = (await headers()).get('x-nonce') ?? undefined;

  return (
    // O script de tema altera atributos do <html> antes da hidratação.
    <html lang="en" suppressHydrationWarning>
      <head>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
