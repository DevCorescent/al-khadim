'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  ArrowRight, ChevronDown, Clock, Facebook, Instagram, Linkedin, Mail, Menu, MessageCircle, Phone, Search, Twitter, X, Youtube,
} from 'lucide-react';
import { useSiteConfig } from '@/lib/siteConfig';
import { normalizeFooter, normalizeNavbar, safeHref } from '@/lib/homepage/config';
import { mediaUrl } from '@/lib/mediaUrl';
import { Icon } from '@/components/homepage/icons';

export const SOCIAL_ICONS: Record<string, any> = {
  linkedin: Linkedin, instagram: Instagram, twitter: Twitter, facebook: Facebook, youtube: Youtube, whatsapp: MessageCircle,
};

export function socialEntries(footer: any): [string, string][] {
  return Object.entries(footer?.socials || {})
    .filter(([k, url]) => SOCIAL_ICONS[k] && safeHref(url as string)) as [string, string][];
}

/** The shipped Al Khadim badge; an uploaded logo in the Website Builder replaces the whole mark. */
export const DEFAULT_LOGO = '/brand/al-khadim-logo.png';

/** Logo badge with the company name beside it — or the uploaded logo for the current background. */
export function BrandMark({ nav, onDark }: { nav: any; onDark: boolean }) {
  const custom = mediaUrl(onDark ? (nav.logoImageOnDark || nav.logoImage) : nav.logoImage);
  if (custom) return <img src={custom} alt={nav.logoText || 'Logo'} className="h-10 lg:h-11 w-auto object-contain" />;
  const sub = String(nav.logoSubtitle || '').trim();
  return (
    <span className="flex items-center gap-2.5 lg:gap-3">
      <img src={DEFAULT_LOGO} alt="" width={44} height={44}
        className={`w-10 h-10 lg:w-11 lg:h-11 rounded-full shrink-0 ${onDark ? 'ring-1 ring-white/25 shadow-lg shadow-black/30' : 'shadow-md shadow-primary-900/20'}`} />
      <span className="leading-none">
        <span className={`flex items-baseline gap-1 hp-heading text-[16px] lg:text-[17px] font-bold tracking-[-0.01em] whitespace-nowrap ${onDark ? 'text-white' : 'text-hp-text'}`}>
          {nav.logoText}
          {nav.tagline && String(nav.tagline).length <= 8 && <span className="text-[10px] font-bold tracking-[0.16em] uppercase text-hp-gold">{nav.tagline}</span>}
        </span>
        {sub && <span className={`hidden sm:block mt-1 text-[9px] font-semibold tracking-[0.16em] uppercase whitespace-nowrap ${onDark ? 'text-white/55' : 'text-hp-muted'}`}>{sub}</span>}
      </span>
    </span>
  );
}

type NavLink = { label: string; href: string; children?: { label: string; href: string }[] };

/** Desktop menu links; a link with children opens its dropdown on hover or keyboard focus. */
function DesktopLinks({ links, onDark, isActive, className = '' }: {
  links: NavLink[]; onDark: boolean; isActive: (href: string) => boolean; className?: string;
}) {
  return (
    <ul className={`flex items-center ${className}`}>
      {links.map(l => {
        const kids = (l.children || []).filter(c => c?.label && safeHref(c.href));
        const active = isActive(l.href) || kids.some(c => isActive(c.href));
        return (
          <li key={`${l.href}-${l.label}`} className="relative group">
            <Link href={safeHref(l.href)} aria-haspopup={kids.length ? 'true' : undefined}
              className={`relative flex items-center gap-0.5 px-2.5 2xl:px-3 py-2 text-[13.5px] font-medium whitespace-nowrap transition-colors ${onDark
                ? active ? 'text-white' : 'text-white/75 hover:text-white'
                : active ? 'text-hp-primary' : 'text-hp-text/80 hover:text-hp-primary'}`}>
              {l.label}
              {kids.length > 0 && <ChevronDown size={13} className="opacity-60 transition-transform group-hover:rotate-180 group-focus-within:rotate-180" />}
              <span className={`absolute left-2.5 right-2.5 -bottom-0.5 h-[2px] rounded-full bg-hp-gold transition-transform origin-left ${active ? 'scale-x-100' : 'scale-x-0'}`} />
            </Link>
            {kids.length > 0 && (
              <div className="invisible opacity-0 translate-y-1 group-hover:visible group-hover:opacity-100 group-hover:translate-y-0 group-focus-within:visible group-focus-within:opacity-100 group-focus-within:translate-y-0 transition-all duration-150 absolute left-0 top-full pt-2 z-50">
                <div className="min-w-[230px] bg-white rounded-hp-card shadow-2xl ring-1 ring-black/5 p-2 border-t-2 border-hp-gold">
                  {kids.map(c => (
                    <Link key={`${c.href}-${c.label}`} href={safeHref(c.href)}
                      className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-[13.5px] font-medium transition-colors ${isActive(c.href) ? 'text-hp-primary bg-hp-sand' : 'text-hp-text hover:bg-hp-sand hover:text-hp-primary'}`}>
                      {c.label} <ArrowRight size={13} className="opacity-40" />
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function LoginMenu({ nav, onDark, links, small = false }: { nav: any; onDark: boolean; links: any[]; small?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);
  if (!nav.showLogin || !links.length) return null;
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(v => !v)} aria-expanded={open}
        className={small
          ? 'flex items-center gap-1 h-full text-[12px] font-medium text-white/75 hover:text-hp-gold whitespace-nowrap transition-colors'
          : `flex items-center gap-1 px-3 py-2 rounded-full text-[13.5px] font-medium whitespace-nowrap transition-colors ${onDark ? 'text-white hover:bg-white/10' : 'text-hp-text hover:bg-hp-text/5'}`}>
        {nav.loginLabel || 'Log in'} <ChevronDown size={small ? 12 : 14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-60 bg-white rounded-hp-card shadow-2xl ring-1 ring-black/5 p-2 z-50" style={{ animation: 'hpFadeUp .16s ease both' }}>
          {links.map((l: any) => (
            <Link key={l.href} href={safeHref(l.href)} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-hp-text hover:bg-hp-sand transition-colors">
              <span className="grid place-items-center w-8 h-8 rounded-lg bg-hp-primary/10 text-hp-primary"><Icon name={l.icon} fallback="UserCheck" size={15} /></span>
              {l.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

/** Job search from the header: submits to the careers page. */
function HeaderSearch({ placeholder, onClose }: { placeholder: string; onClose: () => void }) {
  const [q, setQ] = useState('');
  const router = useRouter();
  return (
    <form onSubmit={e => { e.preventDefault(); router.push(q.trim() ? `/careers?q=${encodeURIComponent(q.trim())}` : '/careers'); onClose(); }}
      className="flex items-center gap-2 bg-white rounded-full ring-1 ring-hp-gold/50 shadow-xl pl-4 pr-1.5 py-1.5 w-[min(420px,80vw)]"
      style={{ animation: 'hpFadeUp .16s ease both' }}>
      <Search size={16} className="text-hp-muted shrink-0" />
      <input autoFocus value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Escape' && onClose()}
        placeholder={placeholder} className="flex-1 min-w-0 bg-transparent text-sm text-hp-text focus:outline-none py-1.5" />
      <button type="submit" className="px-4 py-2 rounded-full bg-hp-primary text-white text-xs font-semibold hover:bg-hp-primary-dark">Search</button>
      <button type="button" onClick={onClose} aria-label="Close search" className="grid place-items-center w-8 h-8 rounded-full text-hp-muted hover:bg-hp-sand"><X size={15} /></button>
    </form>
  );
}

/**
 * Site header: one slim bar, plus — on the homepage, from tablets up — a thin
 * dark utility strip above it (tagline, phone, log-in, language) that slides
 * away once the visitor scrolls. The homepage passes its server-loaded config
 * (and, in the builder preview, the unsaved draft); other pages read the store.
 */
export default function Navbar({ config, footerConfig, overDarkHero, flagStripe }: {
  config?: any; footerConfig?: any; overDarkHero?: boolean; flagStripe?: boolean;
} = {}) {
  const storeNav = useSiteConfig(s => s.navbar);
  const storeHome = useSiteConfig(s => s.homepage);
  const showStripe = flagStripe ?? storeHome?.theme?.flagStripe ?? true;
  const storeFooter = useSiteConfig(s => s.footer);
  const nav = normalizeNavbar(config ?? storeNav);
  const footer = normalizeFooter(footerConfig ?? storeFooter);
  const pathname = usePathname() || '/';

  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileGroup, setMobileGroup] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 24);
    fn();
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);
  useEffect(() => { setMobileOpen(false); setSearchOpen(false); }, [pathname]);
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  const home = pathname === '/';
  const strip = home && nav.topBarEnabled;
  const transparent = !!overDarkHero && nav.transparentOnHero && !scrolled && !mobileOpen;
  const onDark = transparent;
  const socials = nav.topBarSocials ? socialEntries(footer) : [];
  const links: NavLink[] = (nav.links || []).filter((l: any) => l?.label && safeHref(l.href));
  const loginLinks = (nav.loginLinks || []).filter((l: any) => l?.label && safeHref(l.href));
  const isActive = (href: string) => {
    const h = safeHref(href);
    if (!h || h.includes('#') || h.includes('?')) return false;
    return h === '/' ? pathname === '/' : pathname === h || pathname.startsWith(h + '/');
  };
  const phone = nav.expertPhone || nav.topBarPhone;
  const cta = nav.ctaLabel && safeHref(nav.ctaHref);
  const lang = nav.langLabel && safeHref(nav.langHref);
  const stripText = String(nav.headerTagline || nav.topBarText || '').replace(/\s*\n\s*/g, ' ');
  const tel = (p: string) => `tel:${String(p).replace(/\s/g, '')}`;

  return (
    <header className={`fixed top-0 inset-x-0 z-50 transition-transform duration-300 ${strip && scrolled ? 'md:-translate-y-9' : ''}`}>
      {/* Utility strip */}
      {strip && (
        <div className={`hidden md:block relative z-20 h-9 text-white/70 text-[12px] backdrop-blur-xl backdrop-saturate-150 border-b border-white/[0.06] transition-colors duration-300 ${transparent ? 'bg-hp-ink/55' : 'bg-hp-ink/90'}`}>
          <div className="max-w-[1360px] mx-auto h-full px-5 sm:px-8 lg:px-10 flex items-center gap-6">
            <p className="truncate flex items-center gap-2">
              <span aria-hidden className="inline-flex h-2.5 w-4 rounded-[2px] overflow-hidden shrink-0">
                <span className="w-1 bg-[#C8102E]" /><span className="flex-1 flex flex-col"><span className="flex-1 bg-[#00732F]" /><span className="flex-1 bg-white" /><span className="flex-1 bg-black" /></span>
              </span>
              {stripText}
            </p>
            <div className="ml-auto flex items-center gap-5 h-full shrink-0">
              {nav.topBarHours && <span className="hidden 2xl:flex items-center gap-1.5"><Clock size={12} /> {nav.topBarHours}</span>}
              {nav.topBarEmail && <a href={`mailto:${nav.topBarEmail}`} className="hidden xl:flex items-center gap-1.5 hover:text-hp-gold transition-colors"><Mail size={12} /> {nav.topBarEmail}</a>}
              {phone && (
                <a href={tel(phone)} className="flex items-center gap-1.5 hover:text-hp-gold transition-colors">
                  <Phone size={12} className="text-hp-gold" />
                  <span className="hidden lg:inline text-white/50">{nav.expertLabel || 'Talk to our experts'}</span>
                  <span className="font-semibold text-white">{phone}</span>
                </a>
              )}
              {socials.length > 0 && (
                <span className="hidden lg:flex items-center gap-3">
                  {socials.map(([k, url]) => { const I = SOCIAL_ICONS[k]; return <a key={k} href={safeHref(url)} target="_blank" rel="noopener noreferrer" aria-label={k} className="hover:text-hp-gold transition-colors"><I size={13} /></a>; })}
                </span>
              )}
              {lang && (
                <span className="flex items-center gap-2 pl-5 border-l border-white/15">
                  <span className="text-white font-semibold">EN</span>
                  <a href={safeHref(nav.langHref)} lang="ar" className="hp-arabic hover:text-hp-gold">{nav.langLabel}</a>
                </span>
              )}
              {nav.showLogin && loginLinks.length > 0 && (
                <span className="h-full flex items-center pl-5 border-l border-white/15"><LoginMenu nav={nav} onDark links={loginLinks} small /></span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main bar */}
      <div className={`relative z-10 backdrop-blur-xl backdrop-saturate-150 transition-[background-color,box-shadow,border-color] duration-500 border-b ${transparent
        ? 'bg-gradient-to-b from-hp-ink/45 to-hp-ink/15 border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
        : 'bg-white/75 border-hp-text/[0.06] shadow-[0_10px_30px_-18px_rgba(6,30,38,0.28)]'}`}>
        <div className="max-w-[1360px] mx-auto px-5 sm:px-8 lg:px-10 h-16 lg:h-[72px] flex items-center gap-4">
          <Link href="/" className="shrink-0" aria-label={`${nav.logoText} home`}>
            <BrandMark nav={nav} onDark={onDark} />
          </Link>
          <nav aria-label="Main" className="hidden xl:block mx-auto">
            <DesktopLinks links={links} onDark={onDark} isActive={isActive} />
          </nav>
          <div className="ml-auto xl:ml-0 flex items-center gap-1.5">
            {nav.showSearch && (
              <div className="hidden sm:block relative">
                <button type="button" onClick={() => setSearchOpen(v => !v)} aria-label="Search jobs" aria-expanded={searchOpen}
                  className={`grid place-items-center w-9 h-9 rounded-full transition-colors ${onDark ? 'text-white hover:bg-white/10' : 'text-hp-text/80 hover:bg-hp-sand hover:text-hp-text'}`}><Search size={16} /></button>
                {searchOpen && (
                  <div className="absolute right-0 top-full mt-3"><HeaderSearch placeholder={nav.searchPlaceholder || 'Search jobs…'} onClose={() => setSearchOpen(false)} /></div>
                )}
              </div>
            )}
            {!strip && <div className="hidden xl:block"><LoginMenu nav={nav} onDark={onDark} links={loginLinks} /></div>}
            {cta && (
              <Link href={safeHref(nav.ctaHref)}
                className="group hidden sm:inline-flex items-center gap-1.5 ml-1 pl-4 pr-3.5 h-9 rounded-full text-[13px] font-semibold whitespace-nowrap bg-hp-gold text-hp-ink hover:brightness-105 shadow-sm shadow-hp-gold/30 transition">
                {nav.ctaLabel} <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
              </Link>
            )}
            <button type="button" onClick={() => setMobileOpen(v => !v)} aria-label={mobileOpen ? 'Close menu' : 'Open menu'} aria-expanded={mobileOpen}
              className={`xl:hidden grid place-items-center w-10 h-10 rounded-full transition-colors ${onDark ? 'text-white bg-white/10' : 'text-hp-text bg-hp-sand'}`}>
              {mobileOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>
        {!transparent && showStripe && <div aria-hidden className="hp-flag-stripe h-[3px]" />}
        {/* Fade-blur: the glass melts into the page instead of ending in a hard edge. */}
        {!mobileOpen && (
          <div aria-hidden className={`absolute inset-x-0 top-full h-8 pointer-events-none backdrop-blur-[6px] [mask-image:linear-gradient(to_bottom,black,transparent)] [-webkit-mask-image:linear-gradient(to_bottom,black,transparent)] transition-colors duration-500 ${transparent ? 'bg-gradient-to-b from-hp-ink/15 to-transparent' : 'bg-gradient-to-b from-white/40 to-transparent'}`} />
        )}

        {/* Menu for phones, tablets and small laptops */}
        {mobileOpen && (
          <div className="xl:hidden absolute inset-x-0 top-full h-[calc(100dvh-100%)] bg-white overflow-y-auto border-t border-hp-text/5" style={{ animation: 'hpFadeUp .2s ease both' }}>
            <div className="max-w-2xl mx-auto">
              {nav.showSearch && (
                <form className="px-5 pt-5" onSubmit={e => {
                  e.preventDefault();
                  const q = String(new FormData(e.currentTarget).get('q') || '').trim();
                  window.location.href = q ? `/careers?q=${encodeURIComponent(q)}` : '/careers';
                }}>
                  <div className="flex items-center gap-2 rounded-full bg-hp-sand px-4">
                    <Search size={15} className="text-hp-muted" />
                    <input name="q" placeholder={nav.searchPlaceholder || 'Search jobs…'} className="flex-1 bg-transparent py-3 text-[15px] focus:outline-none" />
                  </div>
                </form>
              )}
              <div className="px-3 py-3">
                {links.map(l => {
                  const kids = (l.children || []).filter(c => c?.label && safeHref(c.href));
                  const key = `${l.href}-${l.label}`;
                  const open = mobileGroup === key;
                  if (!kids.length) {
                    return (
                      <Link key={key} href={safeHref(l.href)}
                        className={`flex items-center px-4 py-3 rounded-xl text-[15px] font-medium border-b border-hp-text/[0.05] ${isActive(l.href) ? 'text-hp-primary' : 'text-hp-text'}`}>
                        {l.label}
                      </Link>
                    );
                  }
                  return (
                    <div key={key} className="border-b border-hp-text/[0.05]">
                      <button type="button" onClick={() => setMobileGroup(open ? null : key)} aria-expanded={open}
                        className="w-full flex items-center justify-between px-4 py-3 text-[15px] font-medium text-hp-text">
                        {l.label} <ChevronDown size={16} className={`text-hp-muted transition-transform ${open ? 'rotate-180' : ''}`} />
                      </button>
                      {open && (
                        <div className="pb-2 pl-4">
                          {[{ label: `All ${l.label.toLowerCase()}`, href: l.href }, ...kids].map(c => (
                            <Link key={`${c.href}-${c.label}`} href={safeHref(c.href)} className="flex items-center justify-between px-4 py-2 rounded-lg text-[14px] text-hp-muted hover:text-hp-primary">
                              {c.label} <ArrowRight size={13} className="text-hp-gold" />
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {nav.showLogin && loginLinks.length > 0 && (
                <div className="px-5 pb-5">
                  <p className="px-2 pb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-hp-muted">{nav.loginLabel || 'Log in'}</p>
                  <div className="grid grid-cols-3 gap-2">
                    {loginLinks.map((l: any) => (
                      <Link key={l.href} href={safeHref(l.href)} className="flex flex-col items-center gap-1.5 px-2 py-3 rounded-xl bg-hp-sand/70 text-[12px] font-semibold text-hp-text text-center">
                        <Icon name={l.icon} fallback="UserCheck" size={17} className="text-hp-primary" />
                        {l.label}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
              {cta && (
                <div className="px-5 pb-5">
                  <Link href={safeHref(nav.ctaHref)} className="flex justify-center w-full px-5 py-3.5 rounded-full bg-hp-gold text-hp-ink text-[15px] font-semibold">{nav.ctaLabel}</Link>
                </div>
              )}
              {phone && (
                <a href={tel(phone)} className="mx-5 mb-24 flex items-center gap-3 p-4 rounded-hp-card bg-hp-ink text-white">
                  <span className="grid place-items-center w-9 h-9 rounded-full ring-1 ring-hp-gold/60 text-hp-gold"><Phone size={15} /></span>
                  <span><span className="block text-[11px] text-white/60">{nav.expertLabel || 'Talk to our experts'}</span><span className="text-[15px] font-semibold">{phone}</span></span>
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
