import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { prisma } from '@/lib/prisma';
import { mediaUrl } from '@/lib/mediaUrl';
import { normalizeDoc } from '@/lib/pageBuilder/doc';
import { getWebsiteContent } from '@/server/siteContent';
import PublicPage from '@/components/pageBuilder/PublicPage';

// Pages are edited live from the page builder, so always render from the database.
export const dynamic = 'force-dynamic';

const load = cache(async (slug: string) => {
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) return null;
  const page = await prisma.page.findUnique({ where: { slug }, select: { title: true, slug: true, status: true, published: true } }).catch(() => null);
  if (!page || page.status !== 'published' || !page.published) return null;
  return { ...page, doc: normalizeDoc(page.published) };
});

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const page = await load(params.slug);
  if (!page) return {};
  const seo = page.doc.seo;
  const title = seo.title || page.title;
  const image = mediaUrl(seo.ogImage);
  return {
    title,
    description: seo.description || undefined,
    keywords: seo.keywords || undefined,
    alternates: seo.canonical ? { canonical: seo.canonical } : undefined,
    robots: seo.noindex ? { index: false, follow: false } : undefined,
    openGraph: { title, description: seo.description || undefined, type: 'website', ...(image ? { images: [image] } : {}) },
  };
}

export default async function BuilderPage({ params }: { params: { slug: string } }) {
  const page = await load(params.slug);
  if (!page) notFound();
  const site = await getWebsiteContent();
  return <PublicPage doc={page.doc} site={site} slug={page.slug} />;
}
