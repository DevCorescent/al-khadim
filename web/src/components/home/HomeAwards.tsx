'use client';
import { useSiteConfig } from '@/lib/siteConfig';
import { Award, Shield, Star, CheckCircle } from 'lucide-react';

/**
 * Awards, certifications and partner names are entered in Site Editor and nothing is
 * shown until they are. Accreditations such as an ISO certificate or a regulator
 * registration must only ever appear once they genuinely hold, so there are no defaults.
 */
const ICONS = [Award, Shield, Star, CheckCircle];

interface AwardItem { label: string; issuer?: string; year?: string }

export default function HomeAwards() {
  const sections = useSiteConfig(s => s.sections);
  const sec = sections?.awards;

  const awards: AwardItem[] = Array.isArray(sec?.items) ? sec.items.filter((a: any) => a?.label) : [];
  const partners: string[] = Array.isArray(sec?.partners)
    ? sec.partners.map((p: any) => (typeof p === 'string' ? p : p?.name)).filter(Boolean)
    : [];

  if (sec && !sec.enabled) return null;
  if (!awards.length && !partners.length) return null;

  return (
    <section className="py-16 bg-white border-t border-gray-100">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">

        {/* Awards row */}
        {awards.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-14">
          {awards.map((a, i) => {
            const Icon = ICONS[i % ICONS.length];
            return (
            <div key={a.label}
              className="flex flex-col items-center text-center p-6 rounded-2xl border border-gray-100 bg-gray-50/50">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-3"
                style={{background:'#2563EB14'}}>
                <Icon size={20} style={{color:'#2563EB'}} strokeWidth={1.5}/>
              </div>
              <p className="font-bold text-gray-900 text-sm leading-snug mb-1">{a.label}</p>
              {a.issuer && <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{a.issuer}</p>}
              {a.year && <p className="text-[10px] font-bold mt-1" style={{color:'#2563EB'}}>{a.year}</p>}
            </div>
            );
          })}
        </div>
        )}

        {/* Client logos marquee */}
        {partners.length > 0 && (
        <div>
          <p className="text-center text-xs font-bold uppercase tracking-widest text-gray-300 mb-8">
            Trusted partners & enterprise clients
          </p>
          <div className="relative overflow-hidden">
            <div className="flex gap-8 animate-[marquee_20s_linear_infinite] whitespace-nowrap">
              {[...partners, ...partners].map((p, i) => (
                <span key={i}
                  className="inline-flex items-center px-6 py-2.5 rounded-xl text-sm font-bold text-gray-400 border border-gray-100 bg-gray-50 shrink-0 hover:text-gray-700 hover:border-gray-200 transition-colors cursor-default">
                  {p}
                </span>
              ))}
            </div>
          </div>
        </div>
        )}
      </div>
      <style>{`
        @keyframes marquee { from { transform: translateX(0) } to { transform: translateX(-50%) } }
      `}</style>
    </section>
  );
}
