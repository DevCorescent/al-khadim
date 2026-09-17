'use client';
import { useSiteConfig } from '@/lib/siteConfig';
import { Star, Quote } from 'lucide-react';

const TESTIMONIALS = [
  { quote: "Al Khadim filled 12 critical positions in under 30 days. Their UAE market knowledge is unmatched and the quality of candidates was exceptional.", author: 'Ahmed Al Mansouri', role: 'HR Director', company: 'Emirates Group', initials: 'AA', color: '#2563EB', rating: 5 },
  { quote: "Working with Al Khadim felt like having a dedicated in-house recruitment team. Every candidate was thoroughly vetted and perfectly matched to our culture.", author: 'Sarah Al Hassan', role: 'VP Operations', company: 'ADNOC Group', initials: 'SA', color: '#047857', rating: 5 },
  { quote: "Their contractual staffing solution was exactly what our project needed — flexible, fast, and the team they placed performed brilliantly from day one.", author: 'Marcus Chen', role: 'Project Director', company: 'Aldar Properties', initials: 'MC', color: '#334155', rating: 5 },
  { quote: "The executive search was thorough and discreet. Our new CFO was the third candidate they presented — perfect match on the very first shortlist.", author: 'Fatima Al Nouri', role: 'CEO', company: 'Abu Dhabi Islamic Bank', initials: 'FN', color: '#b45309', rating: 5 },
  { quote: "Handling our payroll and PRO services through Al Khadim freed up our HR team to focus on what matters — growing our people, not managing paperwork.", author: 'James Okafor', role: 'CHRO', company: 'Majid Al Futtaim', initials: 'JO', color: '#0f766e', rating: 5 },
  { quote: "We scaled from 40 to 120 employees in eight months. Al Khadim's recruitment speed and quality made that growth possible without a single bad hire.", author: 'Ravi Krishnaswamy', role: 'COO', company: 'DP World', initials: 'RK', color: '#0369a1', rating: 5 },
];

export default function HomeTestimonials() {
  const sections = useSiteConfig(s => s.sections);
  const sec = sections?.testimonials;
  if (sec && !sec.enabled) return null;

  const title = sec?.title || 'Trusted by the UAE\'s Best Teams';

  return (
    <section className="py-20 md:py-28" style={{background:'linear-gradient(180deg,#fafafa 0%,#f3f4f6 100%)'}}>
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-14">
          <div>
            <p className="text-xs font-bold tracking-widest uppercase mb-3" style={{color:'#2563EB'}}>TESTIMONIALS</p>
            <h2 className="font-bold text-gray-900" style={{fontSize:'clamp(1.75rem,3vw,2.5rem)',lineHeight:1.15,letterSpacing:'-0.02em'}}>{title}</h2>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="flex gap-0.5">{[...Array(5)].map((_,i) => <Star key={i} size={16} className="fill-amber-400 text-amber-400"/>)}</div>
            <span className="font-black text-2xl text-gray-900">4.9</span>
            <span className="text-gray-400 text-sm">/ 150+ reviews</span>
          </div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {TESTIMONIALS.map(t => (
            <div key={t.author}
              className="group relative bg-white rounded-2xl border border-gray-100 p-7 flex flex-col gap-5 hover:border-transparent transition-all duration-300"
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow='0 12px 36px rgba(0,0,0,0.08)'; (e.currentTarget as HTMLElement).style.borderColor='transparent'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow='none'; (e.currentTarget as HTMLElement).style.borderColor='#f3f4f6'; }}>
              <div className="absolute top-6 right-6 opacity-5 group-hover:opacity-10 transition-opacity"><Quote size={48} style={{color:t.color}}/></div>
              <div className="flex gap-0.5">{[...Array(t.rating)].map((_,i) => <Star key={i} size={12} className="fill-amber-400 text-amber-400"/>)}</div>
              <p className="text-gray-600 text-sm leading-relaxed flex-1">"{t.quote}"</p>
              <div className="flex items-center gap-3 pt-4 border-t border-gray-50">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-sm shrink-0"
                  style={{background:`linear-gradient(135deg,${t.color},${t.color}bb)`}}>
                  {t.initials}
                </div>
                <div>
                  <p className="font-bold text-gray-900 text-sm">{t.author}</p>
                  <p className="text-xs text-gray-400">{t.role} · {t.company}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
