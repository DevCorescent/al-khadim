'use client';
import { useState } from 'react';
import { MapPin, Briefcase, ArrowRight, Star, ChevronLeft, ChevronRight, ExternalLink, Lock } from 'lucide-react';
import Link from 'next/link';

const candidates = [
  {
    name: 'Arjun Mehta',
    role: 'Sr. Software Engineer',
    location: 'Dubai',
    exp: '8 yrs',
    skills: ['React', 'Node.js', 'AWS'],
    rating: 4.9, reviews: 47, available: true,
    img: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&q=80',
    accent: '#2563EB', initial: 'AM',
  },
  {
    name: 'Priya Sharma',
    role: 'HR Business Partner',
    location: 'Abu Dhabi',
    exp: '6 yrs',
    skills: ['Talent Acq.', 'HRIS', 'L&D'],
    rating: 4.8, reviews: 34, available: true,
    img: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&q=80',
    accent: '#0f766e', initial: 'PS',
  },
  {
    name: 'Mohammed Al Rashid',
    role: 'Project Manager – Civil',
    location: 'Sharjah',
    exp: '11 yrs',
    skills: ['PMP', 'AutoCAD', 'Primavera'],
    rating: 5.0, reviews: 62, available: false,
    img: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&q=80',
    accent: '#047857', initial: 'MR',
  },
  {
    name: 'Sarah Okonkwo',
    role: 'Financial Analyst',
    location: 'Dubai',
    exp: '5 yrs',
    skills: ['CFA', 'Excel', 'Bloomberg'],
    rating: 4.7, reviews: 28, available: true,
    img: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&q=80',
    accent: '#b45309', initial: 'SO',
  },
  {
    name: 'Ravi Krishnamurthy',
    role: 'Data Scientist',
    location: 'Dubai',
    exp: '7 yrs',
    skills: ['Python', 'ML', 'TensorFlow'],
    rating: 4.9, reviews: 51, available: true,
    img: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&q=80',
    accent: '#0369a1', initial: 'RK',
  },
  {
    name: 'Fatima Al Zaabi',
    role: 'Marketing Director',
    location: 'Abu Dhabi',
    exp: '10 yrs',
    skills: ['Brand', 'SEO', 'CRM'],
    rating: 4.8, reviews: 39, available: true,
    img: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=200&q=80',
    accent: '#334155', initial: 'FA',
  },
  {
    name: 'Nadia El-Sayed',
    role: 'Legal Counsel',
    location: 'Sharjah',
    exp: '8 yrs',
    skills: ['UAE Law', 'Contracts', 'Compliance'],
    rating: 5.0, reviews: 44, available: true,
    img: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&q=80',
    accent: '#0e7490', initial: 'NE',
  },
  {
    name: 'Omar Al Farsi',
    role: 'Structural Engineer',
    location: 'Abu Dhabi',
    exp: '9 yrs',
    skills: ['STAAD Pro', 'Revit', 'BIM'],
    rating: 4.8, reviews: 30, available: true,
    img: 'https://images.unsplash.com/photo-1463453091185-61582044d556?w=200&q=80',
    accent: '#22c55e', initial: 'OA',
  },
];

type C = typeof candidates[0];

function Card({ c, active, onClick }: { c: C; active: boolean; onClick: () => void }) {
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
      <div className="h-0.5 w-full" style={{ background: `linear-gradient(90deg, ${c.accent}, ${c.accent}55)` }} />

      <div className="p-5">
        {/* Header row */}
        <div className="flex items-start justify-between mb-4">
          <div className="relative">
            <div className="relative w-14 h-14 rounded-2xl overflow-hidden ring-2 ring-gray-100">
              <img src={c.img} alt="" className="w-full h-full object-cover blur-md scale-110" draggable={false} />
              <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                <Lock size={14} className="text-white drop-shadow" />
              </div>
            </div>
            <span className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-white ${c.available ? 'bg-emerald-400' : 'bg-gray-300'}`} />
          </div>

          <div className="flex items-center gap-1 bg-amber-50 border border-amber-100 rounded-full px-2.5 py-1">
            <Star size={10} className="fill-amber-400 text-amber-400" />
            <span className="text-xs font-bold text-amber-700">{c.rating}</span>
            <span className="text-[10px] text-amber-400">({c.reviews})</span>
          </div>
        </div>

        {/* Name + role */}
        <p className="font-bold text-gray-900 text-sm leading-snug">
          <span className="blur-sm select-none">{c.name}</span>
        </p>
        <p className="text-xs text-gray-400 mt-0.5 mb-3 font-medium">{c.role}</p>

        {/* Meta */}
        <div className="flex items-center gap-3 mb-3">
          <span className="flex items-center gap-1 text-[11px] text-gray-400 font-medium">
            <MapPin size={10} style={{ color: c.accent }} /> {c.location}
          </span>
          <span className="flex items-center gap-1 text-[11px] text-gray-400 font-medium">
            <Briefcase size={10} style={{ color: c.accent }} /> {c.exp}
          </span>
        </div>

        {/* Skills */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {c.skills.map(s => (
            <span key={s} className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ color: c.accent, background: c.accent + '12', border: `1px solid ${c.accent}25` }}>
              {s}
            </span>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-50">
          <span className={`text-[10px] font-bold tracking-wide uppercase flex items-center gap-1 ${c.available ? 'text-emerald-500' : 'text-gray-400'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${c.available ? 'bg-emerald-400' : 'bg-gray-300'}`} />
            {c.available ? 'Available' : 'In Process'}
          </span>
          <span className="flex items-center gap-1 text-[11px] font-bold transition-all group-hover:gap-2" style={{ color: c.accent }}>
            <Lock size={9} /> View Full Profile <ArrowRight size={10} />
          </span>
        </div>
      </div>

      {/* Hover glow */}
      <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{ boxShadow: `inset 0 0 0 1px ${c.accent}20` }} />
    </article>
  );
}

export default function HomeCandidates() {
  const [active, setActive] = useState(0);
  const [page, setPage] = useState(0);
  const perPage = 4;
  const totalPages = Math.ceil(candidates.length / perPage);
  const visible = candidates.slice(page * perPage, page * perPage + perPage);

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
              Top-tier candidates,
              <br />
              <span className="text-gray-400 font-normal">ready to join your team.</span>
            </h2>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* Pagination arrows */}
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                className="w-9 h-9 border border-gray-200 rounded-xl flex items-center justify-center text-gray-400 hover:border-primary-400 hover:text-primary-500 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                <ChevronLeft size={16} />
              </button>
              <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1}
                className="w-9 h-9 border border-gray-200 rounded-xl flex items-center justify-center text-gray-400 hover:border-primary-400 hover:text-primary-500 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                <ChevronRight size={16} />
              </button>
            </div>
            <Link href="/candidates"
              className="hidden sm:flex items-center gap-2 text-sm font-bold text-gray-700 border border-gray-200 px-4 py-2 rounded-xl hover:border-primary-400 hover:text-primary-500 transition-all">
              View all <ExternalLink size={13} />
            </Link>
          </div>
        </div>

        {/* Cards grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {visible.map((c, i) => (
            <Card key={c.name} c={c} active={page * perPage + i === active} onClick={() => setActive(page * perPage + i)} />
          ))}
        </div>

        {/* Pagination dots */}
        <div className="flex items-center justify-center gap-2 mb-12">
          {Array.from({ length: totalPages }).map((_, i) => (
            <button key={i} onClick={() => setPage(i)}
              className={`rounded-full transition-all duration-300 ${i === page ? 'w-6 h-2 bg-primary-400' : 'w-2 h-2 bg-gray-200 hover:bg-gray-300'}`} />
          ))}
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { value: '1,800+', label: 'Verified Candidates', color: '#2563EB' },
            { value: '85+',    label: 'Job Categories',      color: '#047857' },
            { value: '48h',    label: 'Avg. Placement Time', color: '#b45309' },
            { value: '97%',    label: 'Client Satisfaction', color: '#0369a1' },
          ].map(({ value, label, color }) => (
            <div key={label} className="bg-gray-50 border border-gray-100 rounded-2xl p-5 text-center hover:shadow-md hover:-translate-y-0.5 transition-all">
              <p className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight" style={{ color }}>{value}</p>
              <p className="text-xs text-gray-400 font-semibold mt-1">{label}</p>
            </div>
          ))}
        </div>

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
