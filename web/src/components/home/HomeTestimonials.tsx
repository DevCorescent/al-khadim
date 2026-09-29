'use client';
import { useSiteConfig } from '@/lib/siteConfig';
import { Star, Quote } from 'lucide-react';

const PALETTE = ['#2563EB', '#047857', '#334155', '#b45309', '#0f766e', '#0369a1'];

const initialsOf = (name: string) =>
  String(name).trim().split(/\s+/).slice(0, 2).map((w) => w[0] ?? '').join('').toUpperCase();

interface Testimonial {
  quote: string;
  author: string;
  role?: string;
  company?: string;
  rating?: number;
}

export default function HomeTestimonials() {
  const sections = useSiteConfig(s => s.sections);
  const sec = sections?.testimonials;
  if (sec && !sec.enabled) return null;

  // Testimonials are entered in Site Editor. Nothing is shown until real ones exist —
  // quotes must never be attributed to a person or company who did not give them.
  const testimonials: Testimonial[] = Array.isArray(sec?.items)
    ? sec.items.filter((t: any) => t?.quote && t?.author)
    : [];
  if (!testimonials.length) return null;

  const rated = testimonials.filter(t => Number(t.rating) > 0);
  const averageRating = rated.length
    ? (rated.reduce((sum, t) => sum + Number(t.rating), 0) / rated.length).toFixed(1)
    : null;

  const title = sec?.title || 'What our clients say';

  return (
    <section className="py-20 md:py-28" style={{background:'linear-gradient(180deg,#fafafa 0%,#f3f4f6 100%)'}}>
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-14">
          <div>
            <p className="text-xs font-bold tracking-widest uppercase mb-3" style={{color:'#2563EB'}}>TESTIMONIALS</p>
            <h2 className="font-bold text-gray-900" style={{fontSize:'clamp(1.75rem,3vw,2.5rem)',lineHeight:1.15,letterSpacing:'-0.02em'}}>{title}</h2>
          </div>
          {averageRating && (
            <div className="flex items-center gap-3 shrink-0">
              <div className="flex gap-0.5">{[...Array(5)].map((_,i) => <Star key={i} size={16} className="fill-amber-400 text-amber-400"/>)}</div>
              <span className="font-black text-2xl text-gray-900">{averageRating}</span>
              <span className="text-gray-400 text-sm">
                / {rated.length} {rated.length === 1 ? 'review' : 'reviews'}
              </span>
            </div>
          )}
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {testimonials.map((t, index) => {
            const color = PALETTE[index % PALETTE.length];
            return (
            <div key={`${t.author}-${index}`}
              className="group relative bg-white rounded-2xl border border-gray-100 p-7 flex flex-col gap-5 hover:border-transparent transition-all duration-300"
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow='0 12px 36px rgba(0,0,0,0.08)'; (e.currentTarget as HTMLElement).style.borderColor='transparent'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow='none'; (e.currentTarget as HTMLElement).style.borderColor='#f3f4f6'; }}>
              <div className="absolute top-6 right-6 opacity-5 group-hover:opacity-10 transition-opacity"><Quote size={48} style={{color}}/></div>
              {Number(t.rating) > 0 && (
                <div className="flex gap-0.5">{[...Array(Number(t.rating))].map((_,i) => <Star key={i} size={12} className="fill-amber-400 text-amber-400"/>)}</div>
              )}
              <p className="text-gray-600 text-sm leading-relaxed flex-1">"{t.quote}"</p>
              <div className="flex items-center gap-3 pt-4 border-t border-gray-50">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-sm shrink-0"
                  style={{background:`linear-gradient(135deg,${color},${color}bb)`}}>
                  {initialsOf(t.author)}
                </div>
                <div>
                  <p className="font-bold text-gray-900 text-sm">{t.author}</p>
                  {(t.role || t.company) && (
                    <p className="text-xs text-gray-400">{[t.role, t.company].filter(Boolean).join(' · ')}</p>
                  )}
                </div>
              </div>
            </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
