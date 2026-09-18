import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Toaster } from 'react-hot-toast';
import Providers from '@/components/Providers';
import MobileBottomNav from '@/components/MobileBottomNav';
import PublicAIWidget from '@/components/PublicAIWidget';

export const metadata: Metadata = {
  title: 'Al Khadim LLC — Empowering Careers, Elevating Business',
  description: 'Al Khadim LLC is a premier HR consultancy in UAE offering placement, recruitment, outsourcing, and management consultancy services since 2017.',
  keywords: 'HR consultancy UAE, recruitment agency Dubai, manpower outsourcing, placement services UAE',
  openGraph: {
    title: 'Al Khadim LLC',
    description: 'Empowering Careers, Elevating Business: Building future together',
    type: 'website',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,600;0,700;1,600;1,700&display=swap" rel="stylesheet" />
        <meta name="theme-color" content="#0a0a10" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </head>
      <body className="pb-[88px] lg:pb-0">
        <Providers>
          {children}
          <MobileBottomNav />
          <PublicAIWidget />
          <Toaster
            position="top-center"
            toastOptions={{
              duration: 3500,
              style: { fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '14px', fontWeight: 500 },
            }}
          />
        </Providers>
      </body>
    </html>
  );
}
