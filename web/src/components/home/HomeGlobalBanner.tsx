'use client';
import Link from 'next/link';
import { useSiteConfig } from '@/lib/siteConfig';
import { Globe2, ArrowRight } from 'lucide-react';

const LOCATIONS = [
  { city: 'Dubai',       x: '76%', y: '52%', primary: true },
  { city: 'Abu Dhabi',   x: '74%', y: '56%', primary: false },
  { city: 'Sharjah',     x: '77%', y: '50%', primary: false },
  { city: 'Riyadh',      x: '72%', y: '54%', primary: false },
  { city: 'London',      x: '47%', y: '30%', primary: false },
  { city: 'Mumbai',      x: '81%', y: '58%', primary: false },
  { city: 'Singapore',   x: '88%', y: '68%', primary: false },
];

const METRICS = [
  { value: '36+', label: 'Enterprise Clients' },
  { value: '1,800+', label: 'Active Candidates' },
  { value: '531+', label: 'Successful Placements' },
  { value: '4.9★', label: 'Client Rating' },
];

export default function HomeGlobalBanner() {
  const sections = useSiteConfig(s => s.sections);
  const sec = sections?.globalBanner;
  if (sec && !sec.enabled) return null;

  const title    = sec?.title    || 'UAE-Based. Globally Connected.';
  const subtitle = sec?.subtitle || 'Headquartered in Dubai, we tap into a global talent network to bring the world\'s best professionals to the UAE job market.';
  const ctaLabel = sec?.ctaLabel || 'Start a Conversation';
  const ctaHref  = sec?.ctaHref  || '/enquiry';

  return (
    <section className="relative py-20 md:py-28 overflow-hidden"
      style={{background:'linear-gradient(135deg,#0b1120 0%,#0f172a 60%,#0c1526 100%)'}}>

      {/* Grid pattern */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.04]"
        style={{backgroundImage:'linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)',backgroundSize:'40px 40px'}}/>

      {/* Glow blobs */}
      <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full pointer-events-none"
        style={{background:'radial-gradient(circle, rgba(37,99,235,0.16) 0%, transparent 70%)',filter:'blur(40px)'}}/>
      <div className="absolute bottom-0 right-1/4 w-80 h-80 rounded-full pointer-events-none"
        style={{background:'radial-gradient(circle, rgba(14,116,144,0.14) 0%, transparent 70%)',filter:'blur(40px)'}}/>

      <div className="max-w-7xl mx-auto px-6 lg:px-8 relative">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">

          {/* Left content */}
          <div>
            <div className="inline-flex items-center gap-2 mb-6 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest"
              style={{background:'rgba(37,99,235,0.15)',color:'#93c5fd',border:'1px solid rgba(37,99,235,0.3)'}}>
              <Globe2 size={12}/> Global Reach
            </div>

            <h2 className="font-bold text-white mb-5"
              style={{fontSize:'clamp(1.75rem,3vw,2.75rem)',lineHeight:1.12,letterSpacing:'-0.02em'}}>
              {title}
            </h2>
            <p className="text-white/55 text-base leading-relaxed mb-8">{subtitle}</p>

            {/* Metrics */}
            <div className="grid grid-cols-2 gap-4 mb-8">
              {METRICS.map(m => (
                <div key={m.label} className="rounded-2xl p-4"
                  style={{background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.07)'}}>
                  <p className="font-black text-2xl text-white tracking-tight">{m.value}</p>
                  <p className="text-white/40 text-xs font-medium mt-0.5">{m.label}</p>
                </div>
              ))}
            </div>

            <Link href={ctaHref}
              className="inline-flex items-center gap-2 text-sm font-bold px-6 py-3.5 rounded-xl text-white transition-opacity hover:opacity-90"
              style={{background:'#2563EB',boxShadow:'0 4px 24px rgba(37,99,235,0.4)'}}>
              {ctaLabel} <ArrowRight size={15}/>
            </Link>
          </div>

          {/* Right: dot map visual */}
          <div className="relative aspect-[4/3] lg:aspect-auto lg:h-80">
            {/* Simplified world-map-ish SVG dots */}
            <svg viewBox="0 0 400 260" className="w-full h-full opacity-20" aria-hidden>
              {/* Rough continental dot pattern */}
              {[
                // Africa
                [160,130],[165,140],[170,150],[160,160],[155,145],[168,135],
                // Europe
                [145,90],[150,85],[155,88],[148,95],[160,82],[155,78],
                // Asia / Middle East
                [200,100],[210,108],[220,105],[215,115],[225,120],[230,110],[205,118],
                [240,115],[235,108],[245,125],[250,110],
                // South Asia
                [245,130],[250,140],[255,135],[260,145],[255,125],
                // SE Asia
                [280,130],[285,140],[290,135],[282,148],[292,142],
                // Americas rough
                [60,100],[65,108],[70,100],[55,115],[68,120],[58,90],[50,105],[62,125],
                [55,130],[70,140],[65,150],
                // Australia
                [300,170],[310,175],[305,182],[315,180],[308,168],
              ].map(([cx,cy],i) => (
                <circle key={i} cx={cx} cy={cy} r={1.5} fill="#3b82f6"/>
              ))}
            </svg>

            {/* Location pins */}
            {LOCATIONS.map(loc => (
              <div key={loc.city}
                className="absolute flex flex-col items-center"
                style={{left:loc.x,top:loc.y,transform:'translate(-50%,-50%)'}}>
                <div className={`rounded-full border-2 transition-transform ${loc.primary ? 'w-4 h-4 border-blue-400 bg-blue-500 shadow-lg shadow-blue-500/50' : 'w-2.5 h-2.5 border-white/40 bg-white/30'}`}/>
                {loc.primary && (
                  <span className="mt-1 text-[9px] font-bold text-white whitespace-nowrap"
                    style={{textShadow:'0 1px 4px rgba(0,0,0,0.8)'}}>
                    {loc.city}
                  </span>
                )}
                {/* Ping animation on primary */}
                {loc.primary && (
                  <span className="absolute w-4 h-4 rounded-full border border-blue-400 animate-ping opacity-60"/>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
