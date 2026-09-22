'use client';
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import toast from 'react-hot-toast';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import {
  ArrowLeft, MapPin, Briefcase, Globe, Linkedin, GraduationCap,
  Languages, Star, CheckCircle, Send, X, Loader2, Building2,
  Phone, Mail, User, ChevronRight, Award, Clock, Lock,
} from 'lucide-react';
import { useClientAuth } from '@/lib/clientAuth';

const API = process.env.NEXT_PUBLIC_API_URL || '';

const SKILL_COLORS = [
  'bg-violet-50 text-violet-700 border-violet-200',
  'bg-blue-50 text-blue-700 border-blue-200',
  'bg-emerald-50 text-emerald-700 border-emerald-200',
  'bg-amber-50 text-amber-700 border-amber-200',
  'bg-rose-50 text-rose-700 border-rose-200',
  'bg-cyan-50 text-cyan-700 border-cyan-200',
];

function getSkillColor(index: number) {
  return SKILL_COLORS[index % SKILL_COLORS.length];
}

function Avatar({ c, size = 'lg' }: { c: any; size?: 'sm' | 'lg' }) {
  const initials = `${c.firstName?.[0] || ''}${c.lastName?.[0] || ''}`;
  const dim = size === 'lg' ? 'w-24 h-24 text-3xl' : 'w-10 h-10 text-sm';
  return (
    <div className={`${dim} rounded-2xl overflow-hidden bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center font-bold text-white shrink-0`}>
      {c.photo
        ? <img src={`${API}/${c.photo}`} className="w-full h-full object-cover" alt="" />
        : initials}
    </div>
  );
}

function RequestModal({ candidate, onClose }: { candidate: any; onClose: () => void }) {
  const [form, setForm] = useState({ requesterName: '', companyName: '', email: '', phone: '', position: '', message: '' });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  function setField(k: string, v: string) { setForm(f => ({ ...f, [k]: v })); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.requesterName || !form.companyName || !form.email || !form.phone) {
      toast.error('Please fill all required fields'); return;
    }
    setSubmitting(true);
    try {
      await axios.post(`${API}/api/candidates/profile/${candidate.id}/request`, form);
      setDone(true);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full sm:max-w-lg sm:rounded-3xl rounded-t-3xl shadow-2xl overflow-hidden max-h-[95vh] flex flex-col">

        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-6 py-5 shrink-0">
          <button onClick={onClose} className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors">
            <X size={14} />
          </button>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Request Profile</p>
          <div className="flex items-center gap-3">
            <Avatar c={candidate} size="sm" />
            <div>
              <p className="font-bold text-white">{candidate.firstName} {candidate.lastName}</p>
              {candidate.headline && <p className="text-xs text-slate-400 line-clamp-1">{candidate.headline}</p>}
            </div>
          </div>
        </div>

        {done ? (
          <div className="flex-1 flex flex-col items-center justify-center p-10 text-center">
            <div className="w-16 h-16 bg-emerald-50 border-2 border-emerald-200 rounded-full flex items-center justify-center mb-4">
              <CheckCircle size={32} className="text-emerald-500" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Request Sent!</h3>
            <p className="text-sm text-gray-500 max-w-xs leading-relaxed mb-6">
              Our team has received your request for <strong>{candidate.firstName}&apos;s</strong> profile. We&apos;ll reach out within 24 hours to discuss next steps.
            </p>
            <button onClick={onClose} className="btn-primary px-8 py-2.5">Done</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Your Name <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <User size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input className="input pl-9 text-sm" value={form.requesterName} onChange={e => setField('requesterName', e.target.value)} placeholder="Full name" />
                  </div>
                </div>
                <div>
                  <label className="label">Company <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <Building2 size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input className="input pl-9 text-sm" value={form.companyName} onChange={e => setField('companyName', e.target.value)} placeholder="Company name" />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Email <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <Mail size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input type="email" className="input pl-9 text-sm" value={form.email} onChange={e => setField('email', e.target.value)} placeholder="you@company.com" />
                  </div>
                </div>
                <div>
                  <label className="label">Phone <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <Phone size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input className="input pl-9 text-sm" value={form.phone} onChange={e => setField('phone', e.target.value)} placeholder="+971 50 …" />
                  </div>
                </div>
              </div>
              <div>
                <label className="label">Position / Role Needed</label>
                <div className="relative">
                  <Briefcase size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input className="input pl-9 text-sm" value={form.position} onChange={e => setField('position', e.target.value)} placeholder="e.g. Senior Designer, Dubai" />
                </div>
              </div>
              <div>
                <label className="label">Message</label>
                <textarea className="input text-sm h-24 resize-none" value={form.message} onChange={e => setField('message', e.target.value)} placeholder="Tell us more about the role, timeline, and requirements…" />
              </div>

              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700 flex items-start gap-2">
                <CheckCircle size={12} className="shrink-0 mt-0.5 text-blue-400" />
                Your request is sent directly to our team. Full candidate details are shared only after initial screening.
              </div>
            </div>

            <div className="px-6 pb-6 pt-2 border-t border-gray-100 shrink-0">
              <button type="submit" disabled={submitting} className="w-full btn-primary justify-center py-3 text-sm disabled:opacity-60">
                {submitting
                  ? <><Loader2 size={14} className="animate-spin" /> Sending…</>
                  : <><Send size={14} /> Send Request to Al Khadim Team</>}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default function CandidateProfilePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { isAuthenticated } = useClientAuth();
  const [showRequest, setShowRequest] = useState(false);
  const [showAllSkills, setShowAllSkills] = useState(false);

  function handleCreateBusinessProfile() {
    router.push(isAuthenticated ? '/company/dashboard' : '/company/register');
  }

  const { data: candidate, isLoading, isError } = useQuery({
    queryKey: ['public-candidate', id],
    queryFn: () => axios.get(`${API}/api/candidates/profile/${id}`).then(r => r.data),
    enabled: !!id,
  });

  const c = candidate as any;

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-gray-50 pt-[84px]">

        {isLoading && (
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center">
              <div className="w-10 h-10 border-3 border-primary-200 border-t-primary-500 rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-gray-400">Loading profile…</p>
            </div>
          </div>
        )}

        {isError && (
          <div className="flex items-center justify-center min-h-[60vh] text-center px-5">
            <div>
              <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <User size={24} className="text-gray-300" />
              </div>
              <h2 className="text-lg font-bold text-gray-800 mb-2">Profile not found</h2>
              <p className="text-sm text-gray-400 mb-6">This profile may be private or no longer available.</p>
              <Link href="/candidates" className="btn-primary">Browse All Talent</Link>
            </div>
          </div>
        )}

        {c && (
          <>
            {/* ── Hero banner ── */}
            <div className="relative bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 overflow-hidden">
              {/* Background orbs */}
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute -top-32 -right-32 w-96 h-96 bg-primary-500/10 rounded-full blur-[120px]" />
                <div className="absolute -bottom-16 -left-16 w-64 h-64 bg-blue-500/10 rounded-full blur-[80px]" />
              </div>

              <div className="relative z-10 max-w-4xl mx-auto px-5 sm:px-8 pt-8 pb-10">
                {/* Back */}
                <button onClick={() => router.back()} className="flex items-center gap-1.5 text-slate-400 hover:text-white text-xs font-semibold mb-8 transition-colors group">
                  <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
                  Back to Talent Pool
                </button>

                <div className="flex flex-col sm:flex-row items-start gap-6">
                  {/* Avatar */}
                  <div className="relative shrink-0">
                    <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-2xl sm:rounded-3xl overflow-hidden bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-3xl sm:text-4xl font-bold text-white ring-4 ring-white/10">
                      {c.photo
                        ? <img src={`${API}/${c.photo}`} className="w-full h-full object-cover blur-md scale-110" alt="" />
                        : <span className="blur-[3px]">{c.firstName?.[0] || ''}{c.lastName?.[0] || ''}</span>}
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                        <Lock size={20} className="text-white drop-shadow" />
                      </div>
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-400 rounded-full border-2 border-slate-900" title="Active" />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      {c.nationality && (
                        <span className="text-[11px] font-bold bg-white/10 text-slate-300 px-2.5 py-0.5 rounded-full border border-white/10">{c.nationality}</span>
                      )}
                      {c.experience != null && (
                        <span className="text-[11px] font-bold bg-primary-500/20 text-primary-300 px-2.5 py-0.5 rounded-full border border-primary-500/20 flex items-center gap-1">
                          <Clock size={9} /> {c.experience}+ yrs exp
                        </span>
                      )}
                    </div>

                    <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight leading-tight">
                      <span className="blur-sm select-none">{c.firstName} {c.lastName}</span>
                    </h1>
                    {c.headline && (
                      <p className="text-slate-300 text-sm sm:text-base mt-1.5 leading-relaxed max-w-xl">{c.headline}</p>
                    )}

                    <div className="flex flex-wrap items-center gap-4 mt-4 text-xs text-slate-400">
                      {c.currentLocation && (
                        <span className="flex items-center gap-1.5">
                          <MapPin size={11} className="text-slate-500" /> {c.currentLocation}
                        </span>
                      )}
                      {c.languages?.length > 0 && (
                        <span className="flex items-center gap-1.5">
                          <Languages size={11} className="text-slate-500" /> {c.languages.slice(0, 3).join(', ')}
                        </span>
                      )}
                      {c.linkedIn && (
                        <a href={c.linkedIn} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:text-primary-400 transition-colors">
                          <Linkedin size={11} /> LinkedIn
                        </a>
                      )}
                      {c.portfolio && (
                        <a href={c.portfolio} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:text-primary-400 transition-colors">
                          <Globe size={11} /> Portfolio
                        </a>
                      )}
                    </div>
                  </div>

                  {/* CTA */}
                  <div className="sm:self-center shrink-0 w-full sm:w-auto">
                    <button
                      onClick={handleCreateBusinessProfile}
                      className="w-full sm:w-auto flex items-center justify-center gap-2 bg-primary-400 hover:bg-primary-500 active:scale-95 text-white font-bold px-6 py-3 rounded-2xl transition-all shadow-lg shadow-primary-900/30 text-sm"
                    >
                      <Lock size={14} /> Create Business Profile to View
                    </button>
                    <button
                      onClick={() => setShowRequest(true)}
                      className="w-full sm:w-auto flex items-center justify-center gap-2 text-slate-400 hover:text-slate-200 font-semibold px-6 py-2 text-xs mt-2 transition-colors"
                    >
                      <Send size={11} /> Or request this profile instead
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Body ── */}
            <div className="max-w-4xl mx-auto px-5 sm:px-8 py-8 space-y-5">

              {/* Summary */}
              {c.summary && (
                <section className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                  <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">About</h2>
                  <p className="text-gray-700 text-sm sm:text-base leading-relaxed">{c.summary}</p>
                </section>
              )}

              <div className="grid sm:grid-cols-3 gap-5">
                {/* Skills — takes 2 cols */}
                {c.skills?.length > 0 && (
                  <section className="sm:col-span-2 bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                    <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Skills & Expertise</h2>
                    <div className="flex flex-wrap gap-2">
                      {(showAllSkills ? c.skills : c.skills.slice(0, 12)).map((s: string, i: number) => (
                        <span key={s} className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${getSkillColor(i)}`}>
                          {s}
                        </span>
                      ))}
                      {!showAllSkills && c.skills.length > 12 && (
                        <button
                          onClick={() => setShowAllSkills(true)}
                          className="text-xs font-semibold text-gray-400 border border-gray-200 hover:border-primary-300 hover:text-primary-500 px-3 py-1.5 rounded-full transition-colors"
                        >
                          +{c.skills.length - 12} more
                        </button>
                      )}
                    </div>
                  </section>
                )}

                {/* Sidebar stats */}
                <section className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-4">
                  <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Quick Facts</h2>

                  {c.experience != null && (
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-primary-50 flex items-center justify-center shrink-0">
                        <Briefcase size={14} className="text-primary-500" />
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">Experience</p>
                        <p className="text-sm font-bold text-gray-800">{c.experience}+ years</p>
                      </div>
                    </div>
                  )}

                  {c.currentLocation && (
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                        <MapPin size={14} className="text-blue-500" />
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">Based in</p>
                        <p className="text-sm font-bold text-gray-800">{c.currentLocation}</p>
                      </div>
                    </div>
                  )}

                  {c.nationality && (
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
                        <Star size={14} className="text-amber-500" />
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">Nationality</p>
                        <p className="text-sm font-bold text-gray-800">{c.nationality}</p>
                      </div>
                    </div>
                  )}

                  {c.languages?.length > 0 && (
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-violet-50 flex items-center justify-center shrink-0">
                        <Languages size={14} className="text-violet-500" />
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">Languages</p>
                        <p className="text-sm font-bold text-gray-800">{c.languages.join(', ')}</p>
                      </div>
                    </div>
                  )}
                </section>
              </div>

              {/* Education */}
              {c.education && (
                <section className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                  <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Education</h2>
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
                      <GraduationCap size={18} className="text-emerald-600" />
                    </div>
                    <div className="flex-1">
                      {c.education.split('|').map((line: string, i: number) => (
                        <p key={i} className={`${i === 0 ? 'font-semibold text-gray-900 text-sm' : 'text-xs text-gray-500 mt-0.5'}`}>
                          {line.trim()}
                        </p>
                      ))}
                    </div>
                  </div>
                </section>
              )}

              {/* CTA card */}
              <section className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-6 sm:p-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-48 h-48 bg-primary-500/10 rounded-full blur-[60px] pointer-events-none" />
                <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center gap-5 justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Award size={14} className="text-primary-400" />
                      <span className="text-xs font-bold text-primary-400 uppercase tracking-widest">Verified Professional</span>
                    </div>
                    <h3 className="text-xl font-bold text-white mb-1">Interested in this candidate?</h3>
                    <p className="text-slate-400 text-sm">Create a business profile to unlock full candidate access, or submit a request and our team will connect you within 24 hours.</p>
                  </div>
                  <button
                    onClick={handleCreateBusinessProfile}
                    className="shrink-0 flex items-center gap-2 bg-primary-400 hover:bg-primary-500 text-white font-bold px-6 py-3 rounded-2xl transition-all active:scale-95 text-sm shadow-lg shadow-primary-900/30 whitespace-nowrap"
                  >
                    <Lock size={14} /> Create Business Profile
                  </button>
                </div>
              </section>

              {/* Back link */}
              <div className="pb-4 text-center">
                <Link href="/candidates" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-primary-500 transition-colors font-medium">
                  <ArrowLeft size={13} /> Browse more talent
                </Link>
              </div>
            </div>
          </>
        )}
      </main>
      <Footer />

      {showRequest && c && (
        <RequestModal candidate={c} onClose={() => setShowRequest(false)} />
      )}
    </>
  );
}
