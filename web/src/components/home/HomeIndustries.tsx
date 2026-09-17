'use client';
import Link from 'next/link';
import { useSiteConfig } from '@/lib/siteConfig';
import {
  Plane, Flame, Building, Heart, Cpu, Landmark, ShoppingBag,
  GraduationCap, Hotel, Wrench, Truck,
} from 'lucide-react';

const INDUSTRIES = [
  { icon: Plane,         label: 'Aviation & Aerospace',   count: '120+', color: '#2563EB', href: '/careers?industry=Aviation' },
  { icon: Flame,         label: 'Oil & Gas / Energy',     count: '95+',  color: '#b45309', href: '/careers?industry=Energy' },
  { icon: Building,      label: 'Real Estate & Construction', count: '140+', color: '#334155', href: '/careers?industry=Construction' },
  { icon: Heart,         label: 'Healthcare & Life Sciences', count: '80+', color: '#be123c', href: '/careers?industry=Healthcare' },
  { icon: Cpu,           label: 'Technology & IT',        count: '200+', color: '#0369a1', href: '/careers?industry=Technology' },
  { icon: Landmark,      label: 'Banking & Finance',      count: '110+', color: '#047857', href: '/careers?industry=Finance' },
  { icon: ShoppingBag,   label: 'Retail & FMCG',          count: '75+',  color: '#0f766e', href: '/careers?industry=Retail' },
  { icon: GraduationCap, label: 'Education & Training',   count: '60+',  color: '#4d7c0f', href: '/careers?industry=Education' },
  { icon: Hotel,         label: 'Hospitality & Tourism',  count: '90+',  color: '#a16207', href: '/careers?industry=Hospitality' },
  { icon: Wrench,        label: 'Engineering & Projects',  count: '130+', color: '#0e7490', href: '/careers?industry=Engineering' },
  { icon: Truck,         label: 'Automobile & Logistics',  count: '110+', color: '#3f6212', href: '/careers?industry=Automobile%20%26%20Logistics' },
];

export default function HomeIndustries() {
  const sections = useSiteConfig(s => s.sections);
  const sec = sections?.industries;
  if (sec && !sec.enabled) return null;

  const title    = sec?.title    || 'Industries We Serve';
  const subtitle = sec?.subtitle || 'Deep domain expertise across every major sector in the UAE economy';

  return (
    <section className="py-20 md:py-28 relative overflow-hidden"
      style={{background:'linear-gradient(180deg,#fafafa 0%,#f3f4f6 100%)'}}>

      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-14">
          <div>
            <p className="text-xs font-bold tracking-widest uppercase mb-3" style={{color:'#2563EB'}}>EXPERTISE</p>
            <h2 className="font-bold text-gray-900 mb-3" style={{fontSize:'clamp(1.75rem,3vw,2.5rem)',lineHeight:1.15,letterSpacing:'-0.02em'}}>
              {title}
            </h2>
            <p className="text-gray-400 text-base max-w-lg">{subtitle}</p>
          </div>
          <Link href="/services"
            className="shrink-0 inline-flex items-center gap-2 text-sm font-bold px-5 py-2.5 rounded-xl border transition-all"
            style={{color:'#2563EB',borderColor:'#2563EB20',background:'#2563EB08'}}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background='#2563EB'; (e.currentTarget as HTMLElement).style.color='#fff'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background='#2563EB08'; (e.currentTarget as HTMLElement).style.color='#2563EB'; }}>
            View all services
          </Link>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {INDUSTRIES.map(({ icon: Icon, label, count, color, href }) => (
            <Link key={label} href={href}
              className="group relative flex flex-col gap-3 bg-white rounded-2xl p-5 border border-gray-100 hover:border-transparent transition-all duration-300 overflow-hidden"
              style={{'--hover-color': color} as any}
              onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.boxShadow=`0 8px 32px ${color}22`; el.style.borderColor='transparent'; }}
              onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.boxShadow='none'; el.style.borderColor='#f3f4f6'; }}>

              {/* Hover glow bg */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                style={{background:`radial-gradient(ellipse at top left, ${color}0a, transparent 60%)`}}/>

              <div className="w-10 h-10 rounded-xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110"
                style={{background:`${color}12`}}>
                <Icon size={20} style={{color}} strokeWidth={1.5}/>
              </div>

              <div>
                <p className="font-bold text-gray-800 text-sm leading-snug group-hover:text-gray-900">{label}</p>
                <p className="text-xs font-semibold mt-1" style={{color}}>{count} profiles</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
