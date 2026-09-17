'use client';
import { useSiteConfig } from '@/lib/siteConfig';

const CLIENTS = [
  'Emirates Group', 'ADNOC', 'Aldar Properties', 'Majid Al Futtaim',
  'Abu Dhabi Islamic Bank', 'Emaar', 'DP World', 'Etihad Airways',
  'Dubai Airports', 'DEWA', 'Mashreq Bank', 'Jumeirah Group',
];

export default function HomeClients() {
  const sections = useSiteConfig(s => s.sections);
  const sec = sections?.clients;
  if (sec && !sec.enabled) return null;

  const title = sec?.title || 'Trusted by the UAE\'s leading organisations';

  return (
    <section className="py-12 md:py-16 bg-white border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <p className="text-center text-xs font-bold uppercase tracking-widest text-gray-300 mb-8">{title}</p>
        <div className="relative overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-16 z-10 pointer-events-none" style={{background:'linear-gradient(90deg,#fff,transparent)'}}/>
          <div className="absolute right-0 top-0 bottom-0 w-16 z-10 pointer-events-none" style={{background:'linear-gradient(270deg,#fff,transparent)'}}/>
          <div className="flex gap-5 animate-[marquee_28s_linear_infinite] whitespace-nowrap">
            {[...CLIENTS,...CLIENTS].map((name,i) => (
              <div key={i} className="shrink-0 flex items-center justify-center px-7 py-3 rounded-xl border border-gray-100 bg-gray-50/50 hover:bg-white hover:border-blue-100 hover:shadow-sm transition-all cursor-default" style={{minWidth:160}}>
                <span className="text-sm font-bold text-gray-400">{name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <style>{`@keyframes marquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}`}</style>
    </section>
  );
}
