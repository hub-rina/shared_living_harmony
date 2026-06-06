import type { Metadata, Viewport } from 'next';
import { Nunito, Fraunces } from 'next/font/google';
import { AuthProvider } from '@/lib/use-auth';
import { ServiceWorkerRegistrar } from '@/components/service-worker-registrar';
import './globals.css';

const nunito = Nunito({
  subsets: ['latin'],
  variable: '--font-nunito',
  display: 'swap',
  weight: ['400', '500', '600', '700', '800'],
});

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  display: 'swap',
  axes: ['SOFT', 'WONK', 'opsz'],
});

const fontVariables = [nunito.variable, fraunces.variable].join(' ');

export const metadata: Metadata = {
  title: 'HOOMA',
  description: 'Fair chore rotation, photo-flagged messes, and a single Harmony Score for your shared home.',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'HOOMA' },
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/icon-192.png', type: 'image/png', sizes: '192x192' },
    ],
    apple: '/apple-icon.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#4d6e51',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={fontVariables}>
      <body className="min-h-dvh antialiased">
        <ServiceWorkerRegistrar />
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
