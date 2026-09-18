'use client';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useSiteConfig } from '@/lib/siteConfig';
import { MapPin, Clock, Briefcase, ArrowRight, Bookmark } from 'lucide-react';

const TYPE_COLORS: Record<string,{bg:string,text:string}> = {
  FULL_TIME:   {bg:'#dcfce7',text:'#166534'},
  PART_TIME:   {bg:'#fef9c3',text:'#854d0e'},
  CONTRACT:    {bg:'#ede9fe',text:'#5b21b6'},
  INTERNSHIP:  {bg:'#dbeafe',text:'#1e40af'},
  REMOTE:      {bg:'#f0fdf4',text:'#166534'},
};

export default function HomeJobs() {
  const sections = useSiteConfig(s => s.sections);
  const sec = sections?.jobs;
  if (sec && !sec.enabled) return null;

  const title    = sec?.title    || 'Latest Opportunities';
  const subtitle = sec?.subtitle || 'Explore hand-curated roles from the UAE\'s top employers';

  const { data } = useQuery({
    queryKey: ['public-jobs-preview'],
    queryFn: () => api.get('/jobs/public?limit=6').then(r => r.data),
    staleTime: 5 * 60 * 1000,
  });

  const jobs: any[] = data?.jobs || data || [];

  return (
    <section className="py-20 md:py-28"
      style={{background:'linear-gradient(180deg,#fafafa 0%,#fff 100%)'}}>
      <div className="max-w-7xl mx-auto px-6 lg:px-8">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-12">
          <div>
            <p className="text-xs font-bold tracking-widest uppercase mb-3" style={{color:'#2563EB'}}>OPEN ROLES</p>
            <h2 className="font-bold text-gray-900 mb-2"
              style={{fontSize:'clamp(1.75rem,3vw,2.5rem)',lineHeight:1.15,letterSpacing:'-0.02em'}}>
              {title}
            </h2>
            <p className="text-gray-400 text-base">{subtitle}</p>
          </div>
          <Link href="/careers"
            className="shrink-0 inline-flex items-center gap-2 text-sm font-bold px-5 py-2.5 rounded-xl transition-all text-white"
            style={{background:'#2563EB',boxShadow:'0 4px 16px rgba(37,99,235,0.35)'}}>
            View all jobs <ArrowRight size={15}/>
          </Link>
        </div>

        {jobs.length === 0 ? (
          /* Placeholder skeleton when no jobs yet */
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_,i) => (
              <div key={i} className="rounded-2xl border border-gray-100 p-6 animate-pulse">
                <div className="h-4 bg-gray-100 rounded w-3/4 mb-3"/>
                <div className="h-3 bg-gray-100 rounded w-1/2 mb-5"/>
                <div className="flex gap-2">
                  <div className="h-5 w-16 bg-gray-100 rounded-full"/>
                  <div className="h-5 w-20 bg-gray-100 rounded-full"/>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {jobs.slice(0,6).map((job: any) => {
              const tc = TYPE_COLORS[job.type] || {bg:'#f3f4f6',text:'#374151'};
              return (
                <Link key={job.id} href={`/careers?job=${encodeURIComponent(job.id)}`}
                  className="group flex flex-col gap-4 bg-white rounded-2xl border border-gray-100 p-6 hover:border-transparent transition-all duration-300"
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow='0 8px 32px rgba(37,99,235,0.12)'; (e.currentTarget as HTMLElement).style.borderColor='transparent'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow='none'; (e.currentTarget as HTMLElement).style.borderColor='#f3f4f6'; }}>

                  {/* Top */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-[10px] font-bold uppercase tracking-wider"
                        style={{color:'#2563EB'}}>{job.department || 'General'}</span>
                      <h3 className="font-bold text-gray-900 text-sm mt-0.5 leading-snug group-hover:text-blue-600 transition-colors">
                        {job.title}
                      </h3>
                    </div>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border border-gray-100 group-hover:border-blue-100 transition-colors"
                      style={{background:'#2563EB08'}}>
                      <Briefcase size={13} style={{color:'#2563EB'}}/>
                    </div>
                  </div>

                  {/* Meta */}
                  <div className="flex flex-wrap gap-1.5">
                    {job.location && (
                      <span className="flex items-center gap-1 text-[11px] text-gray-400 font-medium">
                        <MapPin size={10}/> {job.location}
                      </span>
                    )}
                    {job.type && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{background:tc.bg,color:tc.text}}>
                        {job.type.replace('_',' ')}
                      </span>
                    )}
                    {job.experience && (
                      <span className="flex items-center gap-1 text-[11px] text-gray-400 font-medium">
                        <Clock size={10}/> {job.experience}
                      </span>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between mt-auto pt-3 border-t border-gray-50">
                    <span className="text-xs text-gray-400">
                      {job.salaryMin && job.salaryMax
                        ? `AED ${(job.salaryMin/1000).toFixed(0)}k–${(job.salaryMax/1000).toFixed(0)}k/mo`
                        : 'Competitive'}
                    </span>
                    <span className="text-xs font-bold text-blue-600 group-hover:underline flex items-center gap-1">
                      Apply now <ArrowRight size={11}/>
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
