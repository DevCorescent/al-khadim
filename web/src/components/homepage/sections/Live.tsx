'use client';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, Briefcase, Clock, Lock, MapPin, Wallet } from 'lucide-react';
import api from '@/lib/api';
import type { HomeSection } from '@/lib/homepage/config';
import { mediaUrl } from '@/lib/mediaUrl';
import { Container, HpButton, Section, SectionHeading, sectionTone } from '../primitives';

/* ─── Latest jobs ───────────────────────────────────────────────────────── */

const pretty = (v?: string | null) => String(v || '').replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());

function salary(j: any) {
  const fmt = (n: number) => n >= 1000 ? `${Math.round(n / 1000)}k` : String(n);
  if (j.salaryMin && j.salaryMax) return `${j.currency || 'AED'} ${fmt(j.salaryMin)}–${fmt(j.salaryMax)}`;
  if (j.salaryMin) return `From ${j.currency || 'AED'} ${fmt(j.salaryMin)}`;
  return '';
}

function ago(date?: string) {
  if (!date) return '';
  const days = Math.floor((Date.now() - new Date(date).getTime()) / 86_400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days} days ago`;
  return new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export function Jobs({ s }: { s: HomeSection }) {
  const tone = sectionTone(s);
  const dark = tone === 'dark';
  const limit = Number(s.limit) || 6;
  const { data, isLoading } = useQuery({
    queryKey: ['hp-public-jobs', limit],
    queryFn: () => api.get(`/jobs/public?limit=${limit}`).then(r => r.data),
    staleTime: 5 * 60 * 1000,
  });
  const jobs: any[] = (Array.isArray(data) ? data : data?.jobs || []).slice(0, limit);
  if (!isLoading && !jobs.length && s.hideWhenEmpty) return null;

  const action = s.ctaLabel ? <HpButton href={s.ctaHref} label={s.ctaLabel} variant={dark ? 'gold' : 'primary'} /> : null;
  const card = dark ? 'bg-white/5 ring-1 ring-white/10 hover:ring-hp-gold/60' : 'bg-white ring-1 ring-hp-text/[0.07] hover:ring-hp-primary/30 hover:shadow-xl';
  return (
    <Section s={s}>
      <Container>
        <SectionHeading s={s} action={action} />
        {isLoading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: Math.min(limit, 6) }).map((_, i) => (
              <div key={i} className={`rounded-hp-card p-6 animate-pulse ${dark ? 'bg-white/5' : 'bg-white ring-1 ring-hp-text/[0.06]'}`}>
                <div className="h-3 w-24 rounded bg-current opacity-10 mb-4" />
                <div className="h-5 w-3/4 rounded bg-current opacity-10 mb-6" />
                <div className="h-3 w-1/2 rounded bg-current opacity-10" />
              </div>
            ))}
          </div>
        ) : jobs.length === 0 ? (
          <div className={`hp-reveal rounded-hp-card p-10 text-center ${dark ? 'bg-white/5 ring-1 ring-white/10' : 'bg-hp-sand/60 ring-1 ring-hp-text/[0.06]'}`}>
            <Briefcase size={28} className="mx-auto mb-3 text-hp-gold" />
            <p className={dark ? 'text-white/70' : 'text-hp-muted'}>{s.emptyText}</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {jobs.map((j: any) => {
              const pay = salary(j);
              return (
                <Link key={j.id} href={`/careers?job=${encodeURIComponent(j.id)}`}
                  className={`hp-reveal group flex flex-col rounded-hp-card p-6 transition-all duration-300 hover:-translate-y-1 ${card}`}>
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <span className={`text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${dark ? 'bg-hp-gold/15 text-hp-gold' : 'bg-hp-primary/10 text-hp-primary'}`}>
                      {pretty(j.jobType) || 'Full Time'}
                    </span>
                    <ArrowUpRight size={18} className={`transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 ${dark ? 'text-white/40 group-hover:text-hp-gold' : 'text-hp-muted group-hover:text-hp-primary'}`} />
                  </div>
                  <h3 className={`text-lg font-bold leading-snug mb-4 ${dark ? 'text-white' : 'text-hp-text'}`}>{j.title}</h3>
                  <div className={`mt-auto flex flex-wrap gap-x-4 gap-y-1.5 text-xs ${dark ? 'text-white/55' : 'text-hp-muted'}`}>
                    {(j.location || j.country) && <span className="flex items-center gap-1.5"><MapPin size={13} /> {[j.location, j.country].filter(Boolean).join(', ')}</span>}
                    {j.experience && <span className="flex items-center gap-1.5"><Briefcase size={13} /> {j.experience}</span>}
                    {pay && <span className="flex items-center gap-1.5"><Wallet size={13} /> {pay}</span>}
                    {j.createdAt && <span className="flex items-center gap-1.5"><Clock size={13} /> {ago(j.createdAt)}</span>}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </Container>
    </Section>
  );
}

/* ─── Featured talent ───────────────────────────────────────────────────── */

const AVAILABLE = ['NEW', 'SCREENING', 'SHORTLISTED', 'INTERVIEW_SCHEDULED', 'INTERVIEWED', 'ON_HOLD'];

/**
 * Anonymised: names and photos stay blurred and the full profile sits behind an
 * employer sign-in, so this shows the shape of the talent pool without exposing
 * anyone. Hidden entirely until at least one profile is published.
 */
export function Candidates({ s }: { s: HomeSection }) {
  const tone = sectionTone(s);
  const dark = tone === 'dark';
  const limit = Number(s.limit) || 4;
  const { data } = useQuery({
    queryKey: ['hp-public-candidates', limit],
    queryFn: () => api.get(`/candidates/public-profiles?limit=${limit}`).then(r => r.data),
    staleTime: 5 * 60 * 1000,
  });
  const people: any[] = (data?.data || []).slice(0, limit);
  if (!people.length) return null;

  const action = s.ctaLabel ? <HpButton href={s.ctaHref} label={s.ctaLabel} variant="outline" /> : null;
  return (
    <Section s={s}>
      <Container>
        <SectionHeading s={s} action={action} />
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {people.map((c: any) => {
            const available = AVAILABLE.includes(String(c.status));
            const skills: string[] = (c.skills || []).slice(0, 3);
            const exp = typeof c.experience === 'number' ? `${c.experience} yr${c.experience === 1 ? '' : 's'} experience` : '';
            return (
              <Link key={c.id} href="/candidates"
                className={`hp-reveal group flex flex-col rounded-hp-card p-6 transition-all duration-300 hover:-translate-y-1 ${dark ? 'bg-white/5 ring-1 ring-white/10' : 'bg-white ring-1 ring-hp-text/[0.07] hover:shadow-xl'}`}>
                <div className="flex items-center gap-4 mb-5">
                  <div className="relative w-14 h-14 rounded-full overflow-hidden ring-2 ring-hp-gold/40 shrink-0">
                    {c.photo
                      ? <img src={mediaUrl(c.photo)} alt="" className="w-full h-full object-cover blur-md scale-110" draggable={false} />
                      : <div className="w-full h-full bg-gradient-to-br from-hp-primary/30 to-hp-gold/30" />}
                    <span className="absolute inset-0 grid place-items-center bg-black/10"><Lock size={14} className="text-white drop-shadow" /></span>
                  </div>
                  <div className="min-w-0">
                    <p className={`font-bold blur-[5px] select-none ${dark ? 'text-white' : 'text-hp-text'}`}>{c.firstName} {c.lastName}</p>
                    <p className={`text-[11px] font-semibold flex items-center gap-1.5 mt-1 ${available ? 'text-emerald-500' : dark ? 'text-white/40' : 'text-hp-muted'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${available ? 'bg-emerald-500' : 'bg-current'}`} />
                      {available ? 'Available' : 'In process'}
                    </p>
                  </div>
                </div>
                {c.headline && <p className={`text-sm font-semibold mb-1 ${dark ? 'text-white' : 'text-hp-text'}`}>{c.headline}</p>}
                <p className={`text-xs flex flex-wrap gap-x-3 gap-y-1 mb-4 ${dark ? 'text-white/50' : 'text-hp-muted'}`}>
                  {c.currentLocation && <span className="flex items-center gap-1"><MapPin size={12} /> {c.currentLocation}</span>}
                  {exp && <span>{exp}</span>}
                </p>
                {skills.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-auto">
                    {skills.map(k => (
                      <span key={k} className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${dark ? 'bg-white/10 text-white/70' : 'bg-hp-sand text-hp-text/70'}`}>{k}</span>
                    ))}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      </Container>
    </Section>
  );
}
