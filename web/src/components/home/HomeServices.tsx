'use client';
import Link from 'next/link';
import { useSiteConfig } from '@/lib/siteConfig';
import { ArrowRight, Users, Briefcase, Clock, BarChart3, Globe, HeartHandshake, Award, Landmark } from 'lucide-react';

const SERVICES = [
  { icon: Users,          title: 'Placement Services',      desc: 'Direct permanent hires — from C-suite to entry level.', href: '/services#placement',   color: '#2563EB' },
  { icon: Briefcase,      title: 'Recruitment Services',    desc: 'End-to-end talent acquisition for any volume.',          href: '/services#recruitment', color: '#0f766e' },
  { icon: Clock,          title: 'Contractual Outsourcing', desc: 'Flexible project and contract staffing on demand.',       href: '/services#outsourcing', color: '#0369a1' },
  { icon: BarChart3,      title: 'Management Consultancy',  desc: 'HR strategy, org design, and workforce planning.',        href: '/services#consultancy', color: '#047857' },
  { icon: Globe,          title: 'Visa & PRO Services',     desc: 'Work permits, Emirates ID, and UAE visa processing.',     href: '/services#residency',   color: '#b45309' },
  { icon: HeartHandshake, title: 'Executive Search',        desc: 'Confidential C-level and board-member mandates.',         href: '/services',             color: '#334155' },
  { icon: Award,          title: 'Talent Assessment',       desc: 'Psychometric testing, skills gap and benchmarking.',      href: '/services',             color: '#0e7490' },
  { icon: Landmark,       title: 'Payroll & Compliance',    desc: 'WPS-compliant payroll, EOSB, and HR admin.',              href: '/services',             color: '#4d7c0f' },
];

export default function HomeServices() {
  const sections = useSiteConfig(s => s.sections);
  const sec = sections?.services;
  if (sec && !sec.enabled) return null;

  const title    = sec?.title    || 'Comprehensive HR Solutions';
  const subtitle = sec?.subtitle || 'From your first hire to full workforce management — every service in one trusted partnership.';

  return (
    <section className="py-20 md:py-28 bg-white">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-14">
          <div>
            <p className="text-xs font-bold tracking-widest uppercase mb-3" style={{color:'#2563EB'}}>SERVICES</p>
            <h2 className="font-bold text-gray-900 mb-3"
              style={{fontSize:'clamp(1.75rem,3vw,2.5rem)',lineHeight:1.15,letterSpacing:'-0.02em'}}>
              {title}
            </h2>
            <p className="text-gray-400 text-base max-w-xl">{subtitle}</p>
          </div>
          <Link href="/services"
            className="shrink-0 inline-flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-xl border border-gray-200 text-gray-600 hover:border-blue-200 hover:text-blue-600 hover:bg-blue-50 transition-all">
            All services <ArrowRight size={14}/>
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {SERVICES.map(({ icon: Icon, title: t, desc, href, color }) => (
            <Link key={t} href={href}
              className="group relative flex flex-col gap-4 rounded-2xl border border-gray-100 bg-white p-6 overflow-hidden transition-all duration-300"
              onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.boxShadow=`0 12px 36px ${color}18`; el.style.borderColor='transparent'; el.style.transform='translateY(-2px)'; }}
              onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.boxShadow='none'; el.style.borderColor='#f3f4f6'; el.style.transform=''; }}>
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                style={{background:`radial-gradient(ellipse at top left, ${color}08, transparent 60%)`}}/>
              <div className="absolute top-0 left-0 right-0 h-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                style={{background:`linear-gradient(90deg,${color},${color}60,transparent)`}}/>
              <div className="w-11 h-11 rounded-xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110" style={{background:`${color}12`}}>
                <Icon size={20} style={{color}} strokeWidth={1.5}/>
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-gray-900 text-sm mb-2 leading-snug">{t}</h3>
                <p className="text-gray-400 text-xs leading-relaxed">{desc}</p>
              </div>
              <div className="flex items-center gap-1 text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity" style={{color}}>
                Learn more <ArrowRight size={11}/>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
