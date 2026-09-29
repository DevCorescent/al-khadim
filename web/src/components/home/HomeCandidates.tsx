'use client';
import { useState } from 'react';
import { MapPin, Briefcase, ArrowRight, ChevronLeft, ChevronRight, ExternalLink, Lock } from 'lucide-react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useSiteConfig } from '@/lib/siteConfig';
import { mediaUrl } from '@/lib/mediaUrl';

/**
 * A teaser strip of real public candidate profiles, mirroring what HomeJobs does for
 * jobs. Names stay blurred here and the full profile is behind a sign-in, so this shows
 * the shape of the talent pool without exposing anyone's details.
 *
 * The section hides itself when no candidate has been published yet, rather than
 * standing in placeholder people.
 */

const ACCENTS = ['#2563EB', '#047857', '#b45309', '#0369a1', '#7c3aed', '#be123c'];
const PER_PAGE = 4;

interface PublicCandidate {
  id: string;
  firstName: string;
  lastName: string;
  headline?: string | null;
  photo?: string | null;
  currentLocation?: string | null;
  experience?: number | null;
  skills?: string[] | null;
  status?: string | null;
}

/** Statuses that mean the candidate is still open to an offer. */
const AVAILABLE_STATUSES = ['NEW', 'SCREENING', 'SHORTLISTED', 'INTERVIEW_SCHEDULED', 'INTERVIEWED', 'ON_HOLD'];

function Card({ c, accent, active, onClick }: { c: PublicCandidate; accent: string; active: boolean; onClick: () => void }) {
  const name = [c.firstName, c.lastName].filter(Boolean).join(' ');
  const skills = (c.skills || []).slice(0, 4);
  const available = AVAILABLE_STATUSES.includes(String(c.status));
  const exp = typeof c.experience === 'number' ? `${c.experience} yr${c.experience === 1 ? '' : 's'}` : null;

  return (
    <article
      onClick={onClick}
      className={`group relative bg-white rounded-2xl border cursor-pointer transition-all duration-300 overflow-hidden select-none
        ${active
          ? 'border-gray-200 shadow-2xl shadow-gray-200/80 scale-[1.02]'
          : 'border-gray-100 shadow-sm hover:shadow-xl hover:shadow-gray-200/60 hover:-translate-y-1 hover:border-gray-200'
        }`}
    >
      {/* Accent top bar */}
      <div className="h-0.5 w-full" style={{ background: `linear-gradient(90deg, ${accent}, ${accent}55)` }} />

      <div className="p-5">
        {/* Header row */}
        <div className="flex items-start justify-between mb-4">
          <div className="relative">
            <div className="relative w-14 h-14 rounded-2xl overflow-hidden ring-2 ring-gray-100">
              {c.photo ? (
                <img src={mediaUrl(c.photo)} alt="" className="w-full h-full object-cover blur-md scale-110" draggable={false} />
              ) : (
                <div className="w-full h-full" style={{ background: `linear-gradient(135deg, ${accent}33, ${accent}11)` }} />
              )}
              <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                <Lock size={14} className="text-white drop-shadow" />
              </div>
            </div>
            <span className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-white ${available ? 'bg-emerald-400' : 'bg-gray-300'}`} />
          </div>
        </div>

        {/* Name + role */}
        <p className="font-bold text-gray-900 text-sm leading-snug">
          <span className="blur-sm select-none">{name}</span>
        </p>
        {c.headline && <p className="text-xs text-gray-400 mt-0.5 mb-3 font-medium">{c.headline}</p>}

        {/* Meta */}
        {(c.currentLocation || exp) && (
          <div className="flex items-center gap-3 mb-3">
            {c.currentLocation && (
              <span className="flex items-center gap-1 text-[11px] text-gray-400 font-medium">
                <MapPin size={10} style={{ color: accent }} /> {c.currentLocation}
              </span>
            )}
            {exp && (
              <span className="flex items-center gap-1 text-[11px] text-gray-400 font-medium">
                <Briefcase size={10} style={{ color: accent }} /> {exp}
              </span>
            )}
          </div>
        )}

        {/* Skills */}
        {skills.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {skills.map(s => (
              <span key={s} className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ color: accent, background: accent + '12', border: `1px solid ${accent}25` }}>
                {s}
              </span>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-50">
          <span className={`text-[10px] font-bold tracking-wide uppercase flex items-center gap-1 ${available ? 'text-emerald-500' : 'text-gray-400'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${available ? 'bg-emerald-400' : 'bg-gray-300'}`} />
            {available ? 'Available' : 'In Process'}
          </span>
          <span className="flex items-center gap-1 text-[11px] font-bold transition-all group-hover:gap-2" style={{ color: accent }}>
            <Lock size={9} /> View Full Profile <ArrowRight size={10} />
          </span>
        </div>
      </div>

      {/* Hover glow */}
      <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{ boxShadow: `inset 0 0 0 1px ${accent}20` }} />
    </article>
  );
}

export default function HomeCandidates() {
  const sections = useSiteConfig(s => s.sections);
  const sec = sections?.candidates;

  const [active, setActive] = useState(0);
  const [page, setPage] = useState(0);

  const { data } = useQuery({
    queryKey: ['public-candidates-preview'],
    queryFn: () => api.get('/candidates/public-profiles?limit=12').then(r => r.data),
    staleTime: 5 * 60 * 1000,
  });

  if (sec && !sec.enabled) return null;

  const candidates: PublicCandidate[] = data?.data || [];
  if (!candidates.length) return null;

  const totalPages = Math.max(1, Math.ceil(candidates.length / PER_PAGE));
  const safePage = Math.min(page, totalPages - 1);
  const visible = candidates.slice(safePage * PER_PAGE, safePage * PER_PAGE + PER_PAGE);

  const title = sec?.title || 'Top-tier candidates,';
  const subtitle = sec?.subtitle || 'ready to join your team.';

  return (
    <section className="bg-white py-16 sm:py-24">
      <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6 mb-12">
          <div>
            <div className="inline-flex items-center gap-2 mb-3">
              <span className="w-5 h-0.5 bg-primary-400 rounded-full" />
              <span className="text-xs font-bold text-primary-500 uppercase tracking-widest">Featured Talent</span>
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-[42px] font-bold text-gray-900 tracking-tight leading-[1.1]">
              {title}
              <br />
              <span className="text-gray-400 font-normal">{subtitle}</span>
            </h2>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={safePage === 0}
                  aria-label="Previous candidates"
                  className="w-9 h-9 border border-gray-200 rounded-xl flex items-center justify-center text-gray-400 hover:border-primary-400 hover:text-primary-500 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                  <ChevronLeft size={16} />
                </button>
                <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={safePage === totalPages - 1}
                  aria-label="Next candidates"
                  className="w-9 h-9 border border-gray-200 rounded-xl flex items-center justify-center text-gray-400 hover:border-primary-400 hover:text-primary-500 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
            <Link href="/candidates"
              className="hidden sm:flex items-center gap-2 text-sm font-bold text-gray-700 border border-gray-200 px-4 py-2 rounded-xl hover:border-primary-400 hover:text-primary-500 transition-all">
              View all <ExternalLink size={13} />
            </Link>
          </div>
        </div>

        {/* Cards grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {visible.map((c, i) => (
            <Card key={c.id} c={c} accent={ACCENTS[(safePage * PER_PAGE + i) % ACCENTS.length]}
              active={safePage * PER_PAGE + i === active}
              onClick={() => setActive(safePage * PER_PAGE + i)} />
          ))}
        </div>

        {/* Pagination dots */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mb-12">
            {Array.from({ length: totalPages }).map((_, i) => (
              <button key={i} onClick={() => setPage(i)} aria-label={`Page ${i + 1}`}
                className={`rounded-full transition-all duration-300 ${i === safePage ? 'w-6 h-2 bg-primary-400' : 'w-2 h-2 bg-gray-200 hover:bg-gray-300'}`} />
            ))}
          </div>
        )}

        {/* Mobile view all */}
        <div className="mt-6 text-center sm:hidden">
          <Link href="/candidates"
            className="inline-flex items-center gap-2 text-sm font-bold text-primary-500 border border-primary-200 bg-primary-50 px-5 py-2.5 rounded-xl hover:bg-primary-100 transition-all">
            View all candidates <ArrowRight size={13} />
          </Link>
        </div>
      </div>
    </section>
  );
}
