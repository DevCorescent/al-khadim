'use client';
import { useSiteConfig } from '@/lib/siteConfig';
import { Shield, Zap, Globe2, Users, Award, HeartHandshake } from 'lucide-react';

const PILLARS = [
  {
    icon: Zap,
    title: '72-Hour Talent Delivery',
    desc: 'We guarantee shortlisted candidates within 3 business days — or we fast-track at no extra cost.',
    stat: '72h',
    statLabel: 'avg. delivery',
    color: '#b45309',
  },
  {
    icon: Shield,
    title: 'Verified & Compliant',
    desc: 'Every candidate is background-checked, reference-verified, and UAE labour law compliant.',
    stat: '100%',
    statLabel: 'compliance rate',
    color: '#047857',
  },
  {
    icon: Globe2,
    title: 'UAE Market Authority',
    desc: '7+ years of deep relationships with hiring managers across every major sector in the Emirates.',
    stat: '7+',
    statLabel: 'years in UAE',
    color: '#2563EB',
  },
  {
    icon: Users,
    title: 'Dedicated Recruitment Pod',
    desc: 'Your account gets a named specialist team — not a chatbot. Real humans who know your business.',
    stat: '1:1',
    statLabel: 'dedicated team',
    color: '#334155',
  },
  {
    icon: Award,
    title: '97% Retention at 90 Days',
    desc: 'Industry-leading placement retention. We only succeed when your hire succeeds long-term.',
    stat: '97%',
    statLabel: 'retention rate',
    color: '#0369a1',
  },
  {
    icon: HeartHandshake,
    title: 'Post-Hire Support',
    desc: 'We stay engaged for 90 days post-placement — onboarding support, check-ins, and adjustments included.',
    stat: '90',
    statLabel: 'days follow-up',
    color: '#0f766e',
  },
];

export default function HomeWhyUs() {
  const sections = useSiteConfig(s => s.sections);
  const sec = sections?.whyUs;
  if (sec && !sec.enabled) return null;

  const title    = sec?.title    || 'Why Leading Organisations Choose Al Khadim';
  const subtitle = sec?.subtitle || 'We don\'t just fill positions — we build the teams that drive your business forward.';

  return (
    <section className="py-20 md:py-28 bg-white relative overflow-hidden">
      {/* Decorative blob */}
      <div className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{background:'radial-gradient(circle, rgba(37,99,235,0.06) 0%, transparent 70%)'}}/>

      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <p className="text-xs font-bold tracking-widest uppercase mb-3" style={{color:'#2563EB'}}>WHY AL KHADIM</p>
          <h2 className="font-bold text-gray-900 mb-4"
            style={{fontSize:'clamp(1.75rem,3vw,2.5rem)',lineHeight:1.15,letterSpacing:'-0.02em'}}>
            {title}
          </h2>
          <p className="text-gray-400 text-base leading-relaxed">{subtitle}</p>
        </div>

        {/* Cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {PILLARS.map((p, i) => (
            <div key={p.title}
              className="group relative rounded-2xl border border-gray-100 bg-white p-7 overflow-hidden hover:border-transparent transition-all duration-300"
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow=`0 12px 40px ${p.color}18`; (e.currentTarget as HTMLElement).style.borderColor='transparent'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow='none'; (e.currentTarget as HTMLElement).style.borderColor='#f3f4f6'; }}>

              {/* Background accent */}
              <div className="absolute top-0 right-0 w-32 h-32 rounded-full -translate-y-16 translate-x-16 pointer-events-none transition-opacity duration-300 opacity-0 group-hover:opacity-100"
                style={{background:`radial-gradient(circle, ${p.color}12, transparent 70%)`}}/>

              {/* Icon + stat row */}
              <div className="flex items-start justify-between mb-5">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{background:`${p.color}12`}}>
                  <p.icon size={22} style={{color:p.color}} strokeWidth={1.5}/>
                </div>
                <div className="text-right">
                  <p className="font-black text-2xl tracking-tight" style={{color:p.color}}>{p.stat}</p>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{p.statLabel}</p>
                </div>
              </div>

              <h3 className="font-bold text-gray-900 text-base mb-2">{p.title}</h3>
              <p className="text-gray-400 text-sm leading-relaxed">{p.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
