import { Inter } from 'next/font/google';

import { Toaster } from '@/components/ui/toaster';
import { AuthProvider } from '@/contexts/auth-context';
import { QueryProvider } from '@/contexts/query-provider';

import type { Metadata } from 'next';

import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter', // Optional: if you want to use it as a CSS variable
});

export const metadata: Metadata = {
  title: 'EMA - Electric Magnitudes Analizer',
  description: 'Analise a conformidade energética com base nas resoluções da ANEEL.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${inter.variable}`}>
      <head>{/* Removed direct font links, next/font handles this */}</head>
      <body
        className={`flex min-h-screen flex-col bg-background font-body text-foreground antialiased ${inter.className}`}
      >
        <QueryProvider>
          <AuthProvider>
            <div className="flex-grow">{children}</div>
            <Toaster />
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
