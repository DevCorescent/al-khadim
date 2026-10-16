'use client';
import Link from 'next/link';
import { ArrowRight, Clock, Mail, MapPin, Phone } from 'lucide-react';
import { useSiteConfig } from '@/lib/siteConfig';
import { normalizeFooter, normalizeNavbar, safeHref } from '@/lib/homepage/config';
import { BrandMark, SOCIAL_ICONS, socialEntries } from './Navbar';

/** The contact column takes whatever width the link columns leave on the 12-col grid. */
const CONTACT_SPAN: Record<number, string> = { 0: 'lg:col-span-8', 1: 'lg:col-span-6', 2: 'lg:col-span-4', 3: 'lg:col-span-2' };

/**
 * Site footer. Like the Navbar, the homepage passes its server-loaded (or draft)
 * config and other pages read the shared store.
 */
export default function Footer({ config, navConfig }: { config?: any; navConfig?: any } = {}) {
  const storeFooter = useSiteConfig(s => s.footer);
  const storeNav = useSiteConfig(s => s.navbar);
  const f = normalizeFooter(config ?? storeFooter);
  const nav = normalizeNavbar(navConfig ?? storeNav);
  // The footer brand follows its own fields, falling back to the header's logo.
  const brand = {
    ...nav, logoText: f.logoText || nav.logoText,
    tagline: String(f.tagline || '').length <= 8 ? f.tagline : nav.tagline,
    logoSubtitle: String(f.tagline || '').length > 8 ? f.tagline : nav.logoSubtitle,
    logoImage: f.logoImage, logoImageOnDark: f.logoImage || nav.logoImageOnDark,
  };
  const socials = f.showSocials ? socialEntries(f) : [];
  const columns = (f.columns || []).filter((c: any) => c?.title || c?.links?.length);
  const legal = (f.legalLinks || []).filter((l: any) => l?.label && safeHref(l.href));
  const copyright = String(f.copyright || '').replace('{year}', String(new Date().getFullYear()));
  const mapHref = safeHref(f.mapUrl);

  return (
    <footer className="relative bg-hp-ink text-white/60 overflow-hidden">
      <div aria-hidden className="absolute inset-0 hp-pattern opacity-[0.035] pointer-events-none" />
      {f.showFlagStripe && <div aria-hidden className="hp-flag-stripe h-1 relative" />}

      {f.ctaEnabled && (f.ctaTitle || f.ctaLabel) && (
        <div className="relative max-w-[1360px] mx-auto px-5 sm:px-8 lg:px-10 pt-14">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 p-8 md:p-10 rounded-[calc(var(--hp-radius-card)*1.4)] overflow-hidden relative"
            style={{ background: 'linear-gradient(120deg, rgb(var(--hp-primary)), rgb(var(--hp-primary-dark)))' }}>
            <div aria-hidden className="absolute inset-0 hp-pattern opacity-[0.08]" />
            <div className="relative">
              {f.ctaTitle && <p className="hp-heading text-2xl md:text-3xl font-semibold text-white">{f.ctaTitle}</p>}
              {f.ctaText && <p className="text-white/75 mt-2">{f.ctaText}</p>}
            </div>
            {f.ctaLabel && safeHref(f.ctaHref) && (
              <Link href={safeHref(f.ctaHref)} className="relative group shrink-0 inline-flex items-center gap-2 px-6 py-3.5 rounded-hp-btn bg-hp-gold text-hp-ink font-semibold hover:brightness-110 transition">
                {f.ctaLabel} <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
              </Link>
            )}
          </div>
        </div>
      )}

      <div className="relative max-w-[1360px] mx-auto px-5 sm:px-8 lg:px-10 pt-14 pb-10">
        <div className="grid grid-cols-2 lg:grid-cols-12 gap-10">
          <div className="col-span-2 lg:col-span-4">
            <Link href="/" className="inline-block mb-5"><BrandMark nav={brand} onDark /></Link>
            {f.description && <p className="text-sm leading-relaxed max-w-sm">{f.description}</p>}
            {socials.length > 0 && (
              <div className="flex gap-2 mt-6">
                {socials.map(([k, url]) => {
                  const I = SOCIAL_ICONS[k];
                  return (
                    <a key={k} href={safeHref(url)} target="_blank" rel="noopener noreferrer" aria-label={k}
                      className="grid place-items-center w-10 h-10 rounded-full ring-1 ring-white/15 text-white/70 hover:bg-hp-gold hover:text-hp-ink hover:ring-hp-gold transition-all">
                      <I size={16} />
                    </a>
                  );
                })}
              </div>
            )}
          </div>

          {columns.map((col: any, i: number) => (
            <div key={i} className="lg:col-span-2">
              {col.title && <p className="text-white font-semibold text-sm mb-5">{col.title}</p>}
              <ul className="space-y-3">
                {(col.links || []).filter((l: any) => l?.label && safeHref(l.href)).map((l: any, j: number) => (
                  <li key={j}>
                    <Link href={safeHref(l.href)} className="text-sm hover:text-hp-gold transition-colors">{l.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div className={`col-span-2 ${CONTACT_SPAN[columns.length] || 'lg:col-span-4'}`}>
            <p className="text-white font-semibold text-sm mb-5">Contact</p>
            <ul className="space-y-4 text-sm">
              {f.address && (
                <li className="flex gap-3">
                  <MapPin size={16} className="text-hp-gold shrink-0 mt-0.5" />
                  {mapHref ? <a href={mapHref} target="_blank" rel="noopener noreferrer" className="hover:text-hp-gold transition-colors">{f.address}</a> : <span>{f.address}</span>}
                </li>
              )}
              {f.phone && (
                <li className="flex gap-3"><Phone size={16} className="text-hp-gold shrink-0 mt-0.5" />
                  <a href={`tel:${String(f.phone).replace(/\s/g, '')}`} className="hover:text-hp-gold transition-colors">{f.phone}</a></li>
              )}
              {f.email && (
                <li className="flex gap-3"><Mail size={16} className="text-hp-gold shrink-0 mt-0.5" />
                  <a href={`mailto:${f.email}`} className="hover:text-hp-gold transition-colors">{f.email}</a></li>
              )}
              {f.hours && <li className="flex gap-3"><Clock size={16} className="text-hp-gold shrink-0 mt-0.5" /><span>{f.hours}</span></li>}
            </ul>
          </div>
        </div>
      </div>

      <div className="relative border-t border-white/10">
        <div className="max-w-[1360px] mx-auto px-5 sm:px-8 lg:px-10 py-6 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
          <div>
            <p>{copyright}</p>
            {f.licenseText && <p className="text-white/40 mt-1">{f.licenseText}</p>}
          </div>
          {legal.length > 0 && (
            <ul className="flex flex-wrap gap-x-6 gap-y-2">
              {legal.map((l: any, i: number) => <li key={i}><Link href={safeHref(l.href)} className="hover:text-hp-gold transition-colors">{l.label}</Link></li>)}
            </ul>
          )}
        </div>
      </div>
    </footer>
  );
}
