'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Eye, Loader2, PencilLine } from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { normalizeDoc } from '@/lib/pageBuilder/doc';
import { buildInitialHomepage, normalizeFooter, normalizeHomepage, normalizeNavbar } from '@/lib/homepage/config';
import PublicPage from '@/components/pageBuilder/PublicPage';

/**
 * Staff-only preview of a page's draft (or of a revision with ?rev=), shown
 * in the real site chrome. The editor can also hand over unsaved changes via
 * sessionStorage (?local=1).
 */
export default function PagePreview({ params, searchParams }: { params: { id: string }; searchParams: { rev?: string; local?: string } }) {
  const { isAuthenticated, _hasHydrated } = useAuth();
  const [local, setLocal] = useState<any>(null);
  useEffect(() => {
    if (searchParams.local !== '1') return;
    try { const raw = sessionStorage.getItem(`pb-preview-${params.id}`); if (raw) setLocal(JSON.parse(raw)); } catch { /* ignore */ }
  }, [params.id, searchParams.local]);

  const page = useQuery({
    queryKey: ['pb-preview', params.id, searchParams.rev],
    enabled: _hasHydrated && isAuthenticated,
    queryFn: async () => {
      if (searchParams.rev) {
        const { data } = await api.get(`/pages/${params.id}/revisions/${searchParams.rev}`);
        return { title: data.title, slug: '', draft: data.content, label: data.label, createdAt: data.createdAt };
      }
      return (await api.get(`/pages/${params.id}`)).data;
    },
  });
  const site = useQuery({
    queryKey: ['pb-site-content'],
    queryFn: () => api.get('/site-config').then(r => r.data),
    staleTime: 60_000,
  });

  if (_hasHydrated && !isAuthenticated) {
    return <div className="min-h-screen grid place-items-center text-sm text-gray-500">Sign in to the admin panel to preview pages. <Link href="/login" className="underline ml-1">Sign in</Link></div>;
  }
  if (!page.data || !site.data) {
    return <div className="min-h-screen grid place-items-center text-gray-400">{page.isError ? 'Page not found' : <Loader2 className="animate-spin" />}</div>;
  }
  const cfg = site.data || {};
  const content = {
    homepage: cfg.homepage ? normalizeHomepage(cfg.homepage) : buildInitialHomepage(),
    navbar: normalizeNavbar(cfg.navbar),
    footer: normalizeFooter(cfg.footer),
  };
  const doc = normalizeDoc(local ?? page.data.draft);
  const banner = (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[70] flex items-center gap-3 rounded-full bg-gray-900/90 backdrop-blur text-white text-xs font-semibold pl-4 pr-1.5 py-1.5 shadow-2xl">
      <Eye size={14} className="text-amber-300" />
      {searchParams.rev ? `Revision preview — ${page.data.label || 'saved version'}` : local ? 'Preview of unsaved changes' : 'Draft preview'}
      <Link href={`/admin/pages/${params.id}/edit`} className="flex items-center gap-1.5 rounded-full bg-white/15 hover:bg-white/25 px-3 py-1.5"><PencilLine size={12} /> Edit</Link>
    </div>
  );
  return <PublicPage doc={doc} site={content} slug={page.data.slug} banner={banner} />;
}
