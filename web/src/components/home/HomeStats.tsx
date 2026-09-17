'use client';
import { useSiteConfig } from '@/lib/siteConfig';
import { useEffect, useRef, useState } from 'react';

const DEFAULT_STATS = [
  { value: 1800, suffix: '+', label: 'Verified Candidates',   sub: 'Across all industries',      color: '#3b82f6' },
  { value: 531,  suffix: '+', label: 'Successful Placements', sub: 'Verified & delivered',        color: '#0ea5e9' },
  { value: 36,   suffix: '+', label: 'Enterprise Clients',    sub: 'Across the UAE',              color: '#14b8a6' },
  { value: 97,   suffix: '%', label: 'Retention at 90 Days', sub: 'Industry-leading retention',   color: '#22c55e' },
];

function Counter({ target, suffix }: { target: number; suffix: string }) {
  const [val, setVal] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started.current) {
        started.current = true;
        const dur = 1400;
        const start = performance.now();
        const tick = (now: number) => {
          const p = Math.min((now - start) / dur, 1);
          const ease = 1 - Math.pow(1 - p, 3);
          setVal(Math.round(ease * target));
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }
    }, { threshold: 0.3 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [target]);

  return <span ref={ref}>{val.toLocaleString()}{suffix}</span>;
}

export default function HomeStats() {
  const sections = useSiteConfig(s => s.sections);
  const sec = sections?.stats;
  if (sec && !sec.enabled) return null;

  return (
    <section className="py-16 md:py-20 relative overflow-hidden"
      style={{background:'linear-gradient(135deg,#0b1120 0%,#0f172a 100%)'}}>
      <div className="absolute inset-0 pointer-events-none opacity-[0.05]"
        style={{backgroundImage:'linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)',backgroundSize:'48px 48px'}}/>
      <div className="relative max-w-7xl mx-auto px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-0 md:divide-x divide-white/10">
          {DEFAULT_STATS.map(({ value, suffix, label, sub, color }) => (
            <div key={label} className="text-center md:px-8 py-4">
              <p className="font-black text-4xl md:text-5xl tracking-tight mb-2" style={{color}}>
                <Counter target={value} suffix={suffix}/>
              </p>
              <p className="font-bold text-white text-sm mb-1">{label}</p>
              <p className="text-white/35 text-xs">{sub}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
