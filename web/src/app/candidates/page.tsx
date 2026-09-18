'use client';
import { useState, Suspense } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Link from 'next/link';
import { Search, MapPin, Briefcase, Star, ArrowRight, Users, Clock, X, Lock } from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:5001';

const CATEGORIES = ['All', 'Technology', 'Engineering', 'Finance', 'HR', 'Marketing', 'Sales', 'Operations', 'Legal', 'Design'];

function CandidatesContent() {
  const [search, setSearch]     = useState('');
  const [category, setCategory] = useState('All');

  const { data, isLoading } = useQuery({
    queryKey: ['public-candidates'],
    queryFn: () => axios.get(`${API}/api/candidates/public-profiles`).then(r => r.data),
  });

  const candidates: any[] = data?.data || [];

  const filtered = candidates.filter(c => {
    const s = search.toLowerCase();
    const matchSearch = !search ||
      `${c.firstName} ${c.lastName}`.toLowerCase().includes(s) ||
      c.headline?.toLowerCase().includes(s) ||
      c.skills?.some((sk: string) => sk.toLowerCase().includes(s)) ||
      c.currentLocation?.toLowerCase().includes(s);
    const matchCat = category === 'All' || c.skills?.some((sk: string) => sk.toLowerCase().includes(category.toLowerCase())) || c.headline?.toLowerCase().includes(category.toLowerCase());
    return matchSearch && matchCat;
  });

  return (
    <>
      <Navbar />
      <main className="pt-[84px]">
        {/* Hero */}
        <section className="bg-slate-950 text-white py-16 sm:py-20 relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-blue-600/15 rounded-full blur-[100px]" />
          </div>
          <div className="max-w-4xl mx-auto px-5 sm:px-8 text-center relative z-10">
            <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-full px-4 py-1.5 mb-5">
              <Users size={13} className="text-blue-400" />
              <span className="text-xs font-bold text-blue-400 tracking-widest uppercase">Talent Pool</span>
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">
              Discover Top Talent<br />
              <span className="text-slate-500 font-normal">across the UAE</span>
            </h1>
            <p className="text-slate-400 text-base sm:text-lg max-w-xl mx-auto mb-8">
              Browse our curated pool of verified professionals — ready for immediate placement.
            </p>

            {/* Search */}
            <div className="max-w-xl mx-auto">
              <div className="flex items-center bg-white rounded-2xl overflow-hidden shadow-xl">
                <Search size={16} className="ml-4 text-gray-400 shrink-0" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search by name, skills, role, location…"
                  className="flex-1 px-3 py-4 text-sm text-gray-800 placeholder-gray-400 focus:outline-none bg-transparent"
                />
                {search && (
                  <button onClick={() => setSearch('')} className="px-3 text-gray-400 hover:text-gray-600">
                    <X size={14} />
                  </button>
                )}
                <button className="bg-primary-400 hover:bg-primary-500 text-white text-sm font-bold px-5 py-4 transition-colors shrink-0">
                  Search
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Category filters */}
        <div className="bg-white border-b border-gray-100 sticky top-16 z-30">
          <div className="max-w-7xl mx-auto px-5 sm:px-8 py-3 flex gap-2 overflow-x-auto scrollbar-hide">
            {CATEGORIES.map(cat => (
              <button key={cat} onClick={() => setCategory(cat)}
                className={`shrink-0 text-xs font-semibold px-4 py-1.5 rounded-full border transition-all ${
                  category === cat ? 'bg-primary-400 text-white border-primary-400' : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300'
                }`}>
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Results */}
        <section className="py-10 sm:py-14 bg-gray-50">
          <div className="max-w-7xl mx-auto px-5 sm:px-8">
            <div className="flex items-center justify-between mb-6">
              <p className="text-sm text-gray-500">
                {isLoading ? 'Loading…' : `${filtered.length} candidate${filtered.length !== 1 ? 's' : ''} found`}
                {search && <span className="text-gray-400"> · "{search}"</span>}
              </p>
              <Link href="/candidate/register" className="btn-primary text-xs py-2 px-4 rounded-full">
                Submit Your CV <ArrowRight size={12} />
              </Link>
            </div>

            {isLoading ? (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="bg-white rounded-2xl border border-gray-200 p-5 animate-pulse">
                    <div className="w-12 h-12 bg-gray-100 rounded-full mb-4" />
                    <div className="h-4 bg-gray-100 rounded w-3/4 mb-2" />
                    <div className="h-3 bg-gray-100 rounded w-1/2 mb-4" />
                    <div className="flex gap-2"><div className="h-5 w-12 bg-gray-100 rounded-full" /><div className="h-5 w-16 bg-gray-100 rounded-full" /></div>
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-20">
                <Users size={40} className="text-gray-300 mx-auto mb-4" />
                <p className="text-gray-700 font-semibold mb-2">{search ? `No candidates found for "${search}"` : 'No public profiles yet'}</p>
                <p className="text-gray-400 text-sm mb-6">Be the first to submit your profile.</p>
                <Link href="/candidate/register" className="btn-primary">Submit Your CV →</Link>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filtered.map((c, i) => <CandidateCard key={c.id} c={c} index={i} />)}
              </div>
            )}
          </div>
        </section>

        {/* CTA */}
        <section className="bg-primary-400 py-12 sm:py-16">
          <div className="max-w-4xl mx-auto px-5 sm:px-8 text-center">
            <h2 className="text-3xl font-bold text-white mb-3 tracking-tight">Looking to hire top talent?</h2>
            <p className="text-white/80 text-sm sm:text-base mb-7 max-w-lg mx-auto">
              Access our full candidate database and let our expert team match you with the right professionals within 48 hours.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/enquiry" className="bg-white text-primary-600 font-bold text-sm px-6 py-3 rounded-full hover:bg-gray-50 transition-all">
                Start Hiring →
              </Link>
              <Link href="/contact" className="border border-white/40 text-white font-semibold text-sm px-6 py-3 rounded-full hover:bg-white/10 transition-all">
                Talk to Us
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

const CARD_ACCENT = [
  'from-violet-500 to-purple-600',
  'from-blue-500 to-cyan-600',
  'from-emerald-500 to-teal-600',
  'from-amber-500 to-orange-600',
  'from-rose-500 to-pink-600',
  'from-primary-400 to-primary-600',
];

function CandidateCard({ c, index }: { c: any; index: number }) {
  const initials = `${c.firstName?.[0] || ''}${c.lastName?.[0] || ''}`;
  const accent = CARD_ACCENT[index % CARD_ACCENT.length];

  return (
    <Link
      href={`/candidates/${c.id}`}
      className="block bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-xl hover:-translate-y-1 hover:border-primary-100 transition-all duration-200 cursor-pointer group"
    >
      {/* Gradient top bar */}
      <div className={`h-1.5 bg-gradient-to-r ${accent}`} />

      <div className="p-5">
        {/* Avatar row */}
        <div className="flex items-start justify-between mb-4">
          <div className={`relative w-14 h-14 rounded-2xl overflow-hidden bg-gradient-to-br ${accent} flex items-center justify-center text-lg font-bold text-white shrink-0 shadow-sm`}>
            {c.photo
              ? <img src={`${API}/${c.photo}`} className="w-full h-full object-cover blur-md scale-110" alt="" />
              : <span className="blur-[3px]">{initials}</span>}
            <div className="absolute inset-0 flex items-center justify-center bg-black/10">
              <Lock size={14} className="text-white drop-shadow" />
            </div>
          </div>
          {c.experience != null && (
            <span className="flex items-center gap-1 text-[11px] font-bold text-gray-500 bg-gray-50 border border-gray-100 px-2.5 py-1 rounded-full">
              <Clock size={9} /> {c.experience} yrs
            </span>
          )}
        </div>

        <h3 className="font-bold text-gray-900 text-sm leading-tight group-hover:text-primary-600 transition-colors">
          <span className="blur-sm select-none">{c.firstName} {c.lastName}</span>
        </h3>
        {c.headline && (
          <p className="text-[11px] text-gray-500 mt-1 line-clamp-2 leading-relaxed">{c.headline}</p>
        )}

        {c.currentLocation && (
          <p className="flex items-center gap-1 text-[11px] text-gray-400 mt-2">
            <MapPin size={9} /> {c.currentLocation}
          </p>
        )}

        {/* Skills */}
        {c.skills?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {c.skills.slice(0, 3).map((s: string) => (
              <span key={s} className="text-[10px] font-semibold text-primary-700 bg-primary-50 border border-primary-100 px-2 py-0.5 rounded-full">
                {s}
              </span>
            ))}
            {c.skills.length > 3 && (
              <span className="text-[10px] text-gray-400 border border-gray-200 px-2 py-0.5 rounded-full">
                +{c.skills.length - 3}
              </span>
            )}
          </div>
        )}

        <div className="mt-4 pt-3 border-t border-gray-50 flex items-center justify-between">
          <span className="text-[11px] font-bold text-primary-500 flex items-center gap-1 group-hover:gap-2 transition-all">
            <Lock size={10} /> View Full Profile <ArrowRight size={11} />
          </span>
          {c.nationality && (
            <span className="text-[10px] text-gray-400 font-medium">{c.nationality}</span>
          )}
        </div>
      </div>
    </Link>
  );
}

export default function CandidatesPage() {
  return (
    <Suspense>
      <CandidatesContent />
    </Suspense>
  );
}
