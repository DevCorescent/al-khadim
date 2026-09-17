'use client';
import { useSiteConfig } from '@/lib/siteConfig';
import { Search, UserCheck, Handshake, TrendingUp } from 'lucide-react';

const STEPS = [
  {
    icon: Search,
    number: '01',
    title: 'Define Requirements',
    desc: 'We conduct a deep-dive consultation to understand your hiring needs, culture, and business goals.',
    color: '#2563EB',
  },
  {
    icon: UserCheck,
    number: '02',
    title: 'Source & Screen',
    desc: 'Our team handpicks from 1,800+ pre-verified professionals matched precisely to your criteria.',
    color: '#0369a1',
  },
  {
    icon: Handshake,
    number: '03',
    title: 'Present & Interview',
    desc: 'We deliver shortlisted candidates with detailed profiles and coordinate the entire interview process.',
    color: '#0f766e',
  },
  {
    icon: TrendingUp,
    number: '04',
    title: 'Onboard & Retain',
    desc: 'From offer letter to first-day onboarding, we ensure a seamless transition and long-term success.',
    color: '#047857',
  },
];

export default function HomeProcess() {
  const sections = useSiteConfig(s => s.sections);
  const sec = sections?.process;
  if (sec && !sec.enabled) return null;

  const title    = sec?.title    || 'How We Deliver Excellence';
  const subtitle = sec?.subtitle || 'A proven 4-step framework trusted by 36+ leading UAE organisations';

  return (
    <section className="py-20 md:py-28 bg-white relative overflow-hidden">
      {/* Decorative background */}
      <div className="absolute inset-0 pointer-events-none"
        style={{background:'radial-gradient(ellipse 60% 50% at 50% 0%, rgba(37,99,235,0.04) 0%, transparent 70%)'}}>
      </div>

      <div className="max-w-7xl mx-auto px-6 lg:px-8 relative">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <p className="text-xs font-bold tracking-widest uppercase mb-3" style={{color:'#2563EB'}}>OUR PROCESS</p>
          <h2 className="font-bold text-gray-900 mb-4" style={{fontSize:'clamp(1.75rem,3vw,2.5rem)',lineHeight:1.15,letterSpacing:'-0.02em'}}>
            {title}
          </h2>
          <p className="text-gray-400 text-base leading-relaxed">{subtitle}</p>
        </div>

        {/* Steps */}
        <div className="relative">
          {/* Connector line (desktop) */}
          <div className="hidden lg:block absolute top-10 left-[12.5%] right-[12.5%] h-px"
            style={{background:'linear-gradient(90deg, transparent, #e5e7eb 15%, #e5e7eb 85%, transparent)'}}/>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {STEPS.map((step, i) => (
              <div key={step.number} className="relative flex flex-col items-center text-center group">
                {/* Icon circle */}
                <div className="relative mb-6">
                  <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-0 transition-transform duration-300 group-hover:-translate-y-1"
                    style={{background:`linear-gradient(135deg,${step.color}18,${step.color}08)`,border:`1.5px solid ${step.color}25`}}>
                    <step.icon size={28} style={{color:step.color}} strokeWidth={1.5}/>
                  </div>
                  {/* Number badge */}
                  <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center text-white font-black text-[9px]"
                    style={{background:step.color}}>
                    {step.number.replace('0','')}
                  </div>
                </div>

                <h3 className="font-bold text-gray-900 text-base mb-2">{step.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
