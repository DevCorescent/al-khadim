import { prisma } from '@/lib/prisma';
import {
  buildInitialHomepage, normalizeFooter, normalizeHomepage, normalizeNavbar,
  type HomepageConfig,
} from '@/lib/homepage/config';

export interface WebsiteContent {
  homepage: HomepageConfig;
  navbar: ReturnType<typeof normalizeNavbar>;
  footer: ReturnType<typeof normalizeFooter>;
}

/**
 * The public website documents, read straight from the database so the homepage
 * renders on the server with its real content (no flash of defaults, indexable).
 * A database outage degrades to the shipped defaults instead of a 500.
 */
export async function getWebsiteContent(): Promise<WebsiteContent> {
  try {
    const rows = await prisma.siteConfig.findMany({
      where: { key: { in: ['homepage', 'navbar', 'footer', 'hero', 'sections'] } },
    });
    const get = (k: string) => rows.find(r => r.key === k)?.value;
    const legacy = { hero: get('hero'), sections: get('sections') };
    return {
      homepage: normalizeHomepage(get('homepage'), legacy),
      navbar: normalizeNavbar(get('navbar')),
      footer: normalizeFooter(get('footer')),
    };
  } catch (err) {
    console.error('[siteContent] falling back to defaults:', err);
    return { homepage: buildInitialHomepage(), navbar: normalizeNavbar(null), footer: normalizeFooter(null) };
  }
}
