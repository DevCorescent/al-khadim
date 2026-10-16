import type { Metadata } from 'next';
import { cache } from 'react';
import HomeRenderer from '@/components/homepage/HomeRenderer';
import { getWebsiteContent } from '@/server/siteContent';
import { mediaUrl } from '@/lib/mediaUrl';

// Content is edited live from the Website Builder, so always render from the database.
export const dynamic = 'force-dynamic';

const load = cache(getWebsiteContent);

export async function generateMetadata({ searchParams }: { searchParams: Record<string, string> }): Promise<Metadata> {
  const { homepage } = await load();
  const { seo } = homepage;
  const image = mediaUrl(seo.ogImage);
  return {
    title: seo.title,
    description: seo.description,
    keywords: seo.keywords,
    openGraph: { title: seo.title, description: seo.description, type: 'website', ...(image ? { images: [image] } : {}) },
    ...(searchParams?.preview === '1' ? { robots: { index: false, follow: false } } : {}),
  };
}

export default async function HomePage({ searchParams }: { searchParams: Record<string, string> }) {
  const content = await load();
  return <HomeRenderer initial={content} preview={searchParams?.preview === '1'} />;
}
