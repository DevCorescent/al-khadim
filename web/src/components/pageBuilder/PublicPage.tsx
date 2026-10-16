'use client';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { fontsHref, themeVars } from '@/lib/homepage/config';
import type { WebsiteContent } from '@/server/siteContent';
import type { PageDoc } from '@/lib/pageBuilder/types';
import PageRenderer from './PageRenderer';

/** A builder page inside the site chrome (theme, navbar, footer). */
export default function PublicPage({ doc, site, slug, banner }: { doc: PageDoc; site: WebsiteContent; slug?: string; banner?: React.ReactNode }) {
  const theme = site.homepage.theme;
  const { showNavbar, showFooter, navOverlay } = doc.settings;
  const topBar = site.navbar.topBarEnabled;
  return (
    <div className="hp-root bg-hp-surface" style={themeVars(theme) as React.CSSProperties}>
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="stylesheet" href={fontsHref(theme)} />
      {banner}
      {showNavbar && <Navbar config={site.navbar} footerConfig={site.footer} overDarkHero={navOverlay} flagStripe={theme.flagStripe} />}
      <main>
        {showNavbar && !navOverlay && <div aria-hidden className={topBar ? 'h-[67px] md:h-[103px] lg:h-[111px]' : 'h-[67px] lg:h-[75px]'} />}
        <PageRenderer doc={doc} slug={slug} />
      </main>
      {showFooter && <Footer config={site.footer} navConfig={site.navbar} />}
    </div>
  );
}
