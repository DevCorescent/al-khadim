'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, X, Upload } from 'lucide-react';
import { useSiteConfig } from '@/lib/siteConfig';

const quickLinks = [
  { label: 'Placement Services', href: '/services#placement' },
  { label: 'Recruitment',        href: '/services#recruitment' },
  { label: 'Outsourcing',        href: '/services#outsourcing' },
  { label: 'Consultancy',        href: '/services#consultancy' },
];

const workSuggestions = ['Software Engineer', 'HR Manager', 'Civil Engineer', 'Financial Analyst'];
const hireSuggestions = ['Executive Search', 'Bulk Hiring', 'Contract Staffing', 'Visa Assistance'];

export default function HomeHero() {
  const [tab, setTab]         = useState<'hire' | 'work'>('hire');
  const [query, setQuery]     = useState('');
  const [focused, setFocused] = useState(false);
  const router                = useRouter();
  const hero                  = useSiteConfig(s => s.hero);

  if (hero && !hero.enabled) return null;

  const headline    = hero?.headline    || "Connecting UAE's Best Talent\nwith Top Employers";
  const subheadline = hero?.subheadline || 'Hire expert professionals or find your next career move — trusted by 36+ leading UAE organisations since 2017.';
  const cta1Label   = hero?.cta1Label   || 'Hire Talent';
  const cta1Href    = hero?.cta1Href    || '/enquiry';
  const cta2Label   = hero?.cta2Label   || 'Find Jobs';
  const cta2Href    = hero?.cta2Href    || '/careers';
  const showSearch  = hero?.showSearch  !== false;
  const bgType      = hero?.bgType      || 'image';
  const bgImage     = hero?.bgImage     || 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1600&q=85';
  const overlayOpacity = hero?.overlayOpacity ?? 0.65;

  const showAnnouncement    = hero?.showAnnouncement;
  const announcementText    = hero?.announcementText    || '';
  const announcementLink    = hero?.announcementLink    || '/enquiry';
  const announcementLinkText = hero?.announcementLinkText || 'Learn more';

  const suggestions = tab === 'work' ? workSuggestions : hireSuggestions;
  const filteredSuggestions = query
    ? suggestions.filter(s => s.toLowerCase().includes(query.toLowerCase()))
    : suggestions;

  function handleSubmit(e?: React.FormEvent, overrideQuery?: string) {
    e?.preventDefault();
    const q = (overrideQuery ?? query).trim();
    if (tab === 'work') {
      router.push(q ? `/careers?q=${encodeURIComponent(q)}` : '/careers');
    } else {
      router.push(q ? `/enquiry?service=${encodeURIComponent(q)}` : '/enquiry');
    }
    setFocused(false);
  }

  // Build background style
  let bgStyle: React.CSSProperties = {};
  let overlayClass = '';
  if (bgType === 'image') {
    overlayClass = 'after-overlay';
  } else if (bgType === 'gradient') {
    bgStyle = { background: `linear-gradient(135deg, ${hero?.bgGradient || '#0f172a, #1e3a5f'})` };
  } else {
    bgStyle = { background: hero?.bgColor || '#0f172a' };
  }

  return (
    <section
      className="relative w-full overflow-hidden"
      style={{ height: '100vh', minHeight: 620, ...bgStyle }}
    >
      {/* Background */}
      {bgType === 'image' && bgImage && (
        <img src={bgImage} alt="" className="absolute inset-0 w-full h-full object-cover object-center" />
      )}
      {bgType === 'image' && (
        <div className="absolute inset-0" style={{ background: `rgba(0,0,0,${overlayOpacity})` }} />
      )}
      {bgType === 'gradient' && (
        <div className="absolute inset-0 bg-gradient-to-r from-black/30 to-black/10" />
      )}


      {/* Content */}
      <div className="relative z-10 h-full flex flex-col justify-center px-5 sm:px-10 lg:px-16 xl:px-24 max-w-4xl">
        <h1 className="mb-5" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}>
          {headline.split('\n').map((line: string, i: number) => (
            <span
              key={i}
              className="block overflow-hidden"
              style={{ animation: `heroLineUp 0.8s cubic-bezier(0.22,1,0.36,1) both`, animationDelay: `${i * 0.15}s` }}
            >
              <span
                className="block font-semibold text-white"
                style={{
                  fontSize: 'clamp(2.4rem, 5vw, 3.6rem)',
                  lineHeight: 1.12,
                  letterSpacing: '-0.01em',
                  fontStyle: i === 1 ? 'italic' : 'normal',
                  animation: `heroLineFade 0.8s ease both`,
                  animationDelay: `${i * 0.15}s`,
                }}
              >
                {line}
              </span>
            </span>
          ))}
        </h1>
        <style>{`
          @keyframes heroLineUp {
            from { transform: translateY(110%); }
            to   { transform: translateY(0); }
          }
          @keyframes heroLineFade {
            from { opacity: 0; }
            to   { opacity: 1; }
          }
        `}</style>
        <p className="text-white/75 text-base sm:text-lg leading-relaxed mb-7 max-w-lg">
          {subheadline}
        </p>

        {/* CTA buttons */}
        <div className="flex flex-wrap gap-3 mb-6">
          <Link href={cta1Href}
            className="bg-primary-400 hover:bg-primary-500 text-white font-bold px-6 py-3 transition-all duration-200 shadow-lg"
            style={{ borderRadius: 'var(--radius-btn, 9999px)' }}>
            {cta1Label}
          </Link>
          <Link href={cta2Href}
            className="bg-white/15 hover:bg-white/25 backdrop-blur-sm border border-white/30 text-white font-bold px-6 py-3 transition-all duration-200"
            style={{ borderRadius: 'var(--radius-btn, 9999px)' }}>
            {cta2Label}
          </Link>
        </div>

        {/* Search */}
        {showSearch && (
          <>
            {/* Tab toggle */}
            <div className="inline-flex bg-white/12 backdrop-blur-sm border border-white/25 rounded-full p-1 mb-5 w-fit">
              {(['hire', 'work'] as const).map((t) => (
                <button key={t} onClick={() => { setTab(t); setQuery(''); setFocused(false); }}
                  className={`px-5 py-2 rounded-full text-sm font-semibold transition-all duration-200 ${tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-white/80 hover:text-white'}`}>
                  {t === 'hire' ? 'I want to hire' : 'I want to work'}
                </button>
              ))}
            </div>

            <div className="relative max-w-xl mb-6">
              <form onSubmit={handleSubmit}>
                <div className={`flex items-center bg-white rounded-2xl shadow-2xl overflow-hidden transition-all duration-200 ${focused ? 'ring-2 ring-primary-400/50 shadow-primary-400/20' : ''}`}>
                  <div className="pl-4 text-gray-400 shrink-0"><Search size={17} /></div>
                  <input type="text" value={query} onChange={e => setQuery(e.target.value)}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setTimeout(() => setFocused(false), 160)}
                    onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); if (e.key === 'Escape') { setFocused(false); setQuery(''); } }}
                    placeholder={tab === 'hire' ? 'Search for talent, services…' : 'Search for jobs, opportunities…'}
                    className="flex-1 px-3 py-3.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none bg-transparent"
                    autoComplete="off"
                  />
                  {query && (
                    <button type="button" onClick={() => setQuery('')} className="px-2 text-gray-400 hover:text-gray-600 transition-colors shrink-0"><X size={14} /></button>
                  )}
                  <button type="submit" className="bg-primary-400 hover:bg-primary-500 active:bg-primary-600 text-white text-sm font-bold px-5 sm:px-6 py-3.5 transition-colors shrink-0">Search</button>
                </div>
              </form>

              {focused && filteredSuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-20">
                  <p className="px-4 pt-3 pb-1 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{tab === 'work' ? 'Popular roles' : 'Popular services'}</p>
                  {filteredSuggestions.map((s) => (
                    <button key={s} type="button" onMouseDown={() => handleSubmit(undefined, s)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                      <Search size={13} className="text-gray-400 shrink-0" />{s}
                    </button>
                  ))}
                </div>
              )}

              {/* Optional alternative to searching: jump straight to CV upload */}
              {tab === 'work' && (
                <div className="flex items-center gap-3 mt-3">
                  <span className="text-white/40 text-xs">or</span>
                  <Link href="/candidate/register"
                    className="inline-flex items-center gap-2 text-white/85 text-sm font-semibold border border-white/25 rounded-full px-4 py-2 hover:bg-white/10 hover:border-white/40 hover:text-white transition-all">
                    <Upload size={14} /> Upload your Resume
                  </Link>
                </div>
              )}
            </div>
          </>
        )}

        {/* Quick links */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="text-white/50 text-xs font-medium">Popular:</span>
          {quickLinks.map(({ label, href }) => (
            <Link key={label} href={href}
              className="text-white/80 text-xs border border-white/25 rounded-full px-3 py-1 hover:bg-white/10 hover:text-white hover:border-white/40 transition-all">
              {label}
            </Link>
          ))}
        </div>
      </div>

      {/* Bottom stats strip */}
      <div className="absolute bottom-0 left-0 right-0 bg-black/35 backdrop-blur-sm border-t border-white/10">
        <div className="max-w-7xl mx-auto px-5 lg:px-16 py-4 flex items-center gap-8 sm:gap-12 overflow-x-auto scrollbar-hide">
          {[
            { value: '1,800+', label: 'Candidates in database' },
            { value: '531+',   label: 'Jobs fulfilled' },
            { value: '36+',    label: 'Enterprise clients' },
            { value: '7+',     label: 'Years of excellence' },
          ].map(({ value, label }) => (
            <div key={label} className="flex items-center gap-2.5 shrink-0">
              <p className="text-white font-bold text-lg sm:text-xl tracking-tight">{value}</p>
              <p className="text-white/45 text-[11px] leading-tight max-w-[80px]">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
