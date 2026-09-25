'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Search, X, Briefcase, Users, Menu, ShieldCheck, ChevronDown } from 'lucide-react';
import { useSiteConfig } from '@/lib/siteConfig';

const DEFAULT_LINKS = [
  { label: 'Find Talent', href: '/services' },
  { label: 'Find Work',   href: '/careers' },
  { label: 'Candidates',  href: '/candidates' },
  { label: 'About',       href: '/about' },
  { label: 'Contact',     href: '/contact' },
];

const suggestions = {
  work: ['Software Engineer', 'HR Manager', 'Civil Engineer', 'Financial Analyst', 'Project Manager'],
  hire: ['Executive Search', 'Bulk Hiring', 'Contract Staffing', 'Visa Assistance', 'Recruitment'],
};

const LOGIN_OPTIONS = [
  { label: 'Candidate',  href: '/candidate/login', icon: Briefcase },
  { label: 'Company',    href: '/company/login',   icon: Users },
  { label: 'Staff / Admin', href: '/login',         icon: ShieldCheck },
];

export default function Navbar() {
  const [scrolled,   setScrolled]   = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchMode, setSearchMode] = useState<'work' | 'hire'>('work');
  const [query,      setQuery]      = useState('');
  const [mobileMenu, setMobileMenu] = useState(false);
  const [loginMenuOpen, setLoginMenuOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router   = useRouter();
  const pathname = usePathname();
  const navbar   = useSiteConfig(s => s.navbar);

  const links    = navbar?.links    || DEFAULT_LINKS;
  const ctaLabel = navbar?.ctaLabel || 'Get Started';
  const ctaHref  = navbar?.ctaHref  || '/enquiry';
  const logoText = navbar?.logoText || 'Al Khadim';
  const tagline  = navbar?.tagline  || 'LLC';
  const logoImg  = navbar?.logoImage;

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 16);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  useEffect(() => {
    if (searchOpen) setTimeout(() => inputRef.current?.focus(), 80);
  }, [searchOpen]);

  useEffect(() => { setMobileMenu(false); setSearchOpen(false); setLoginMenuOpen(false); }, [pathname]);

  function closeSearch() { setSearchOpen(false); setQuery(''); }

  function submit(q?: string) {
    const val = (q ?? query).trim();
    router.push(searchMode === 'work'
      ? (val ? `/careers?q=${encodeURIComponent(val)}` : '/careers')
      : (val ? `/enquiry?service=${encodeURIComponent(val)}` : '/enquiry'));
    closeSearch();
  }

  const filtered = suggestions[searchMode].filter(s =>
    !query || s.toLowerCase().includes(query.toLowerCase())
  );

  /* ─── pill appearance ─── */
  const pill: React.CSSProperties = {
    background:          scrolled ? 'rgba(8,8,14,0.88)' : 'rgba(8,8,14,0.62)',
    backdropFilter:      'blur(24px) saturate(180%)',
    WebkitBackdropFilter:'blur(24px) saturate(180%)',
    border:              '1px solid rgba(255,255,255,0.09)',
    boxShadow:           scrolled
      ? '0 12px 40px rgba(0,0,0,0.32), 0 1px 0 rgba(255,255,255,0.06) inset'
      : '0 4px 24px rgba(0,0,0,0.16), 0 1px 0 rgba(255,255,255,0.06) inset',
    transition:          'background 0.3s ease, box-shadow 0.3s ease',
  };

  /* ─── shared hover helpers ─── */
  const hoverIn  = (e: React.MouseEvent) => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(255,255,255,0.07)'; el.style.color = '#fff'; };
  const hoverOut = (e: React.MouseEvent, active = false) => { const el = e.currentTarget as HTMLElement; el.style.background = active ? 'rgba(255,255,255,0.1)' : 'transparent'; el.style.color = active ? '#fff' : 'rgba(255,255,255,0.55)'; };

  return (
    <>
      {/* ─────────────── DESKTOP ─────────────── */}
      <nav className="hidden lg:block fixed top-0 inset-x-0 z-50 pointer-events-none"
        style={{ paddingTop: 20, paddingLeft: 24, paddingRight: 24 }}>
        <div className="max-w-[1100px] mx-auto pointer-events-auto">
          <div className="flex items-center gap-2 rounded-[20px] px-3 py-2" style={pill}>

            {/* ── Logo ── */}
            <Link href="/" className="flex items-center gap-2.5 shrink-0 pr-1">
              {logoImg
                ? <img src={logoImg} alt={logoText} className="h-8 w-auto object-contain brightness-0 invert"/>
                : <>
                    <div className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0"
                      style={{background:'#2563EB',boxShadow:'0 2px 12px rgba(37,99,235,0.5)'}}>
                      <span className="text-white font-black text-[11px] tracking-tight">AK</span>
                    </div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-white font-bold text-[15px] tracking-tight leading-none">{logoText}</span>
                      <span className="text-[9px] font-bold tracking-widest uppercase px-1.5 py-0.5 rounded-md leading-none"
                        style={{background:'rgba(255,255,255,0.08)',color:'rgba(255,255,255,0.4)'}}>{tagline}</span>
                    </div>
                  </>
              }
            </Link>

            {/* ── Divider ── */}
            <div className="w-px self-stretch my-2 shrink-0" style={{background:'rgba(255,255,255,0.09)'}}/>

            {/* ── Nav links (hidden when search open) ── */}
            {!searchOpen && (
              <div className="flex items-center gap-0.5 flex-1 min-w-0">
                {links.map((link: any) => {
                  const active = pathname === link.href || (link.href !== '/' && pathname.startsWith(link.href + '/'));
                  return (
                    <Link key={link.href} href={link.href}
                      className="text-[13px] font-medium px-3 py-2 rounded-xl whitespace-nowrap transition-none"
                      style={{color: active ? '#fff' : 'rgba(255,255,255,0.55)', background: active ? 'rgba(255,255,255,0.1)' : 'transparent'}}
                      onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLElement).style.color='rgba(255,255,255,0.9)'; (e.currentTarget as HTMLElement).style.background='rgba(255,255,255,0.07)'; }}}
                      onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLElement).style.color='rgba(255,255,255,0.55)'; (e.currentTarget as HTMLElement).style.background='transparent'; }}}>
                      {link.label}
                    </Link>
                  );
                })}
              </div>
            )}

            {/* ── Search expanded ── */}
            {searchOpen && (
              <div className="flex items-center gap-2 flex-1 min-w-0 relative">
                {/* Mode toggle */}
                <div className="flex shrink-0 rounded-xl overflow-hidden text-[11px] font-bold"
                  style={{border:'1px solid rgba(255,255,255,0.1)'}}>
                  {(['work','hire'] as const).map(m => (
                    <button key={m} onClick={() => setSearchMode(m)}
                      className="flex items-center gap-1.5 px-3 py-2 transition-colors"
                      style={{background: searchMode===m ? '#2563EB' : 'transparent', color: searchMode===m ? '#fff' : 'rgba(255,255,255,0.45)', borderLeft: m==='hire' ? '1px solid rgba(255,255,255,0.08)' : 'none'}}>
                      {m==='work' ? <Briefcase size={10}/> : <Users size={10}/>}
                      {m==='work' ? 'Jobs' : 'Talent'}
                    </button>
                  ))}
                </div>

                {/* Input */}
                <div className="flex-1 relative">
                  <div className="flex items-center rounded-xl overflow-hidden"
                    style={{border:'1px solid rgba(255,255,255,0.15)',background:'rgba(255,255,255,0.07)'}}>
                    <Search size={13} className="ml-3 shrink-0" style={{color:'rgba(255,255,255,0.35)'}}/>
                    <input ref={inputRef} type="text" value={query} onChange={e => setQuery(e.target.value)}
                      onKeyDown={e => { if (e.key==='Escape') closeSearch(); if (e.key==='Enter') submit(); }}
                      placeholder={searchMode==='work' ? 'Search roles, skills…' : 'Search services…'}
                      className="flex-1 px-2.5 py-2.5 text-[13px] bg-transparent focus:outline-none text-white"
                      style={{'--tw-placeholder-color':'rgba(255,255,255,0.28)'} as any}
                      autoComplete="off"/>
                    {query && <button onClick={() => setQuery('')} className="px-2 py-1" style={{color:'rgba(255,255,255,0.35)'}}><X size={11}/></button>}
                    <button onClick={() => submit()}
                      className="text-white text-[11px] font-bold px-4 py-2.5 shrink-0 transition-opacity hover:opacity-90"
                      style={{background:'#2563EB'}}>
                      Search
                    </button>
                  </div>

                  {/* Suggestions dropdown */}
                  {filtered.length > 0 && (
                    <div className="absolute top-[calc(100%+8px)] left-0 right-0 rounded-2xl overflow-hidden z-[60] py-1"
                      style={{background:'rgba(10,10,18,0.97)',border:'1px solid rgba(255,255,255,0.09)',boxShadow:'0 20px 60px rgba(0,0,0,0.55)'}}>
                      {filtered.map(s => (
                        <button key={s} onMouseDown={() => submit(s)}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-[13px]"
                          style={{color:'rgba(255,255,255,0.6)'}}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background='rgba(255,255,255,0.05)'; (e.currentTarget as HTMLElement).style.color='#fff'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background='transparent'; (e.currentTarget as HTMLElement).style.color='rgba(255,255,255,0.6)'; }}>
                          <Search size={11} className="shrink-0" style={{color:'rgba(255,255,255,0.25)'}}/>{s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <button onClick={closeSearch}
                  className="shrink-0 w-8 h-8 flex items-center justify-center rounded-xl"
                  style={{color:'rgba(255,255,255,0.4)'}}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background='rgba(255,255,255,0.07)'; (e.currentTarget as HTMLElement).style.color='#fff'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background='transparent'; (e.currentTarget as HTMLElement).style.color='rgba(255,255,255,0.4)'; }}>
                  <X size={14}/>
                </button>
              </div>
            )}

            {/* ── Right actions ── */}
            <div className="flex items-center gap-1 shrink-0 pl-1">
              {!searchOpen && (
                <button onClick={() => setSearchOpen(true)} aria-label="Search"
                  className="w-9 h-9 flex items-center justify-center rounded-xl"
                  style={{color:'rgba(255,255,255,0.45)'}}
                  onMouseEnter={hoverIn} onMouseLeave={e => hoverOut(e)}>
                  <Search size={16}/>
                </button>
              )}

              <div className="w-px h-5 mx-0.5 shrink-0" style={{background:'rgba(255,255,255,0.09)'}}/>

              <div className="relative">
                <button onClick={() => setLoginMenuOpen(v => !v)}
                  className="flex items-center gap-1 text-[13px] font-semibold px-3.5 py-2 rounded-xl"
                  style={{color:'rgba(255,255,255,0.55)', background: loginMenuOpen ? 'rgba(255,255,255,0.1)' : 'transparent'}}
                  onMouseEnter={hoverIn} onMouseLeave={e => hoverOut(e, loginMenuOpen)}>
                  Log in <ChevronDown size={13} style={{transform: loginMenuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease'}} />
                </button>

                {loginMenuOpen && (
                  <div className="absolute top-[calc(100%+8px)] right-0 w-48 rounded-2xl overflow-hidden py-1 z-[60]"
                    style={{background:'rgba(10,10,18,0.97)',border:'1px solid rgba(255,255,255,0.09)',boxShadow:'0 20px 60px rgba(0,0,0,0.55)'}}>
                    {LOGIN_OPTIONS.map(({ label, href, icon: Icon }) => (
                      <Link key={href} href={href}
                        className="flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-medium"
                        style={{color:'rgba(255,255,255,0.65)'}}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background='rgba(255,255,255,0.06)'; (e.currentTarget as HTMLElement).style.color='#fff'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background='transparent'; (e.currentTarget as HTMLElement).style.color='rgba(255,255,255,0.65)'; }}>
                        <Icon size={13} className="shrink-0" style={{color:'rgba(255,255,255,0.35)'}} />
                        {label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              <Link href={ctaHref}
                className="text-[13px] font-bold px-4 py-2 rounded-xl text-white ml-1"
                style={{
                  background:'#2563EB',
                  boxShadow:'0 2px 14px rgba(37,99,235,0.45)',
                }}>
                {ctaLabel}
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* ─────────────── MOBILE ─────────────── */}
      <nav className="lg:hidden fixed top-0 inset-x-0 z-50 pointer-events-none"
        style={{ paddingTop: 12, paddingLeft: 12, paddingRight: 12 }}>
        <div className="pointer-events-auto">

          {/* Top bar */}
          <div className="flex items-center gap-3 rounded-[18px] px-3 py-2.5" style={pill}>
            <Link href="/" className="flex items-center gap-2 flex-1 min-w-0">
              <div className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0"
                style={{background:'#2563EB',boxShadow:'0 2px 10px rgba(37,99,235,0.45)'}}>
                <span className="text-white font-black text-[11px]">AK</span>
              </div>
              <span className="text-white font-bold text-[15px] tracking-tight">{logoText}</span>
            </Link>

            <Link href={ctaHref}
              className="text-[12px] font-bold px-3.5 py-2 rounded-xl text-white shrink-0"
              style={{background:'#2563EB',boxShadow:'0 2px 10px rgba(37,99,235,0.4)'}}>
              {ctaLabel}
            </Link>
            <button onClick={() => setMobileMenu(v => !v)}
              className="w-9 h-9 flex items-center justify-center rounded-xl shrink-0"
              style={{background:'rgba(255,255,255,0.07)',color:'rgba(255,255,255,0.7)'}}>
              {mobileMenu ? <X size={16}/> : <Menu size={16}/>}
            </button>
          </div>

          {/* Dropdown */}
          {mobileMenu && (
            <div className="mt-2 rounded-[18px] overflow-hidden"
              style={{
                background:'rgba(8,8,14,0.96)',
                border:'1px solid rgba(255,255,255,0.08)',
                boxShadow:'0 24px 64px rgba(0,0,0,0.6)',
              }}>
              <div className="p-2 space-y-0.5">
                {links.map((link: any) => {
                  const active = pathname === link.href || (link.href !== '/' && pathname.startsWith(link.href + '/'));
                  return (
                    <Link key={link.href} href={link.href}
                      className="flex items-center px-4 py-3 rounded-[14px] text-[14px] font-semibold transition-none"
                      style={{
                        color:      active ? '#fff' : 'rgba(255,255,255,0.5)',
                        background: active ? '#2563EB' : 'transparent',
                      }}>
                      {link.label}
                    </Link>
                  );
                })}
              </div>
              <div className="mx-3" style={{height:1,background:'rgba(255,255,255,0.06)'}}/>
              <div className="p-2">
                <p className="px-4 pt-1 pb-1.5 text-[10px] font-bold uppercase tracking-widest" style={{color:'rgba(255,255,255,0.3)'}}>
                  Log in as
                </p>
                {LOGIN_OPTIONS.map(({ label, href, icon: Icon }) => (
                  <Link key={href} href={href}
                    className="flex items-center gap-2.5 px-4 py-3 rounded-[14px] text-[14px] font-semibold"
                    style={{color:'rgba(255,255,255,0.5)'}}>
                    <Icon size={14} className="shrink-0" style={{color:'rgba(255,255,255,0.3)'}} />
                    {label}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </nav>

      {(searchOpen || loginMenuOpen) && (
        <div className="fixed inset-0 z-40" onClick={() => { closeSearch(); setLoginMenuOpen(false); }}/>
      )}
    </>
  );
}
