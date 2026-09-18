'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { useSiteConfig } from '@/lib/siteConfig';

function SiteConfigLoader() {
  const fetchConfig = useSiteConfig(s => s.fetchConfig);
  useEffect(() => { fetchConfig(); }, [fetchConfig]);
  return null;
}

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30000,
        // Retry once for network/server errors, never for auth or client errors (401/403/404…).
        retry: (count, err: any) => count < 1 && !(err?.response?.status >= 400 && err?.response?.status < 500),
      },
    },
  }));
  return (
    <QueryClientProvider client={queryClient}>
      <SiteConfigLoader />
      {children}
    </QueryClientProvider>
  );
}
