'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import {
  ArrowLeft, User, Briefcase, GraduationCap, Globe, MapPin, Phone, Mail,
  Linkedin, Edit3, Save, X, Clock, ChevronDown, ChevronUp, FileText,
  History, Eye, EyeOff, CheckCircle, AlertCircle, Plus, Trash2, Share2,
  Download, Ban, PlayCircle,
} from 'lucide-react';
import ShareProfileModal from '@/components/admin/ShareProfileModal';
import YouTubeEmbed from '@/components/YouTubeEmbed';
import { isValidYouTubeUrl } from '@/lib/youtube';
import CandidateTrackingPanel from '@/components/admin/CandidateTrackingPanel';
import { useCategories, useIndustries } from '@/lib/taxonomy';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

const STATUS_COLORS: Record<string, string> = {
  NEW: 'bg-blue-100 text-blue-700',
  SCREENING: 'bg-yellow-100 text-yellow-700',
  SHORTLISTED: 'bg-green-100 text-green-700',
  INTERVIEW_SCHEDULED: 'bg-purple-100 text-purple-700',
  INTERVIEWED: 'bg-indigo-100 text-indigo-700',
  OFFERED: 'bg-teal-100 text-teal-700',
  JOINED: 'bg-emerald-100 text-emerald-700',
  REJECTED: 'bg-red-100 text-red-700',
  ON_HOLD: 'bg-gray-100 text-gray-600',
};

const STATUSES = ['NEW','SCREENING','SHORTLISTED','INTERVIEW_SCHEDULED','INTERVIEWED','OFFERED','JOINED','REJECTED','ON_HOLD'];

const SHARE_STATUS_COLORS: Record<string, string> = {
  SENT: 'bg-blue-100 text-blue-700',
  VIEWED: 'bg-indigo-100 text-indigo-700',
  DOWNLOADED: 'bg-purple-100 text-purple-700',
  SHORTLISTED: 'bg-emerald-100 text-emerald-700',
  REJECTED: 'bg-red-100 text-red-700',
  INTERVIEW_REQUESTED: 'bg-amber-100 text-amber-700',
  INTERVIEW_SCHEDULED: 'bg-indigo-100 text-indigo-700',
  WITHDRAWN: 'bg-gray-100 text-gray-500',
};

const FIELD_LABELS: Record<string, string> = {
  firstName: 'First Name', lastName: 'Last Name', email: 'Email', phone: 'Phone',
  headline: 'Headline', summary: 'Summary', nationality: 'Nationality',
  currentLocation: 'Location', experience: 'Experience', skills: 'Skills',
  languages: 'Languages', education: 'Education', linkedIn: 'LinkedIn',
  portfolio: 'Portfolio', isPublic: 'Public Profile', status: 'Status',
  notes: 'Notes', cvPath: 'CV', photo: 'Photo',
};

function formatChangeValue(val: any): string {
  if (val === null || val === undefined) return '—';
  if (Array.isArray(val)) return val.join(', ') || '—';
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  return String(val);
}

function EditHistoryItem({ entry }: { entry: any }) {
  const [open, setOpen] = useState(false);
  const changes = entry.changes as Record<string, { old: any; new: any }>;
  const changedFields = Object.keys(changes);
  const isAdmin = entry.editedBy === 'admin';

  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50 transition-colors"
      >
        <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${isAdmin ? 'bg-blue-100' : 'bg-purple-100'}`}>
          {isAdmin ? <Edit3 size={12} className="text-blue-600" /> : <User size={12} className="text-purple-600" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-gray-800">
            {entry.editorName || entry.editedBy} <span className="font-normal text-gray-400">updated</span>{' '}
            {changedFields.map(f => FIELD_LABELS[f] || f).join(', ')}
          </p>
          <p className="text-[10px] text-gray-400 mt-0.5">
            {new Date(entry.createdAt).toLocaleString('en-AE', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            {' · '}<span className={`font-semibold ${isAdmin ? 'text-blue-500' : 'text-purple-500'}`}>{isAdmin ? 'Admin' : 'Candidate'}</span>
          </p>
        </div>
        <span className="text-[10px] font-bold bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full shrink-0">{changedFields.length} change{changedFields.length > 1 ? 's' : ''}</span>
        {open ? <ChevronUp size={12} className="text-gray-400 shrink-0" /> : <ChevronDown size={12} className="text-gray-400 shrink-0" />}
      </button>

      {open && (
        <div className="border-t border-gray-100 divide-y divide-gray-50">
          {changedFields.map(field => (
            <div key={field} className="px-3 py-2 grid grid-cols-3 gap-2 text-xs">
              <p className="font-semibold text-gray-500">{FIELD_LABELS[field] || field}</p>
              <p className="text-red-500 line-through truncate">{formatChangeValue(changes[field].old)}</p>
              <p className="text-emerald-600 font-medium truncate">{formatChangeValue(changes[field].new)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CandidateDetailPage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const qc = useQueryClient();
  const { data: categories } = useCategories();
  const { data: industries } = useIndustries();
  const validTabs = ['profile', 'history', 'applications', 'documents', 'shares', 'tracking'] as const;
  const tabParam = searchParams.get('tab');
  const [tab, setTab] = useState<typeof validTabs[number]>(
    validTabs.includes(tabParam as any) ? (tabParam as any) : 'profile'
  );
  const [editing, setEditing] = useState(false);
  const [skillInput, setSkillInput] = useState('');
  const [form, setForm] = useState<Record<string, any>>({});
  const [shareModalOpen, setShareModalOpen] = useState(false);

  const { data: candidateRaw, isLoading } = useQuery({
    queryKey: ['candidate-detail', id],
    queryFn: () => api.get(`/candidates/${id}`).then(r => r.data as any),
    enabled: !!id,
  } as any);
  const candidate = candidateRaw as any;

  useEffect(() => {
    const d = candidate;
    if (!d) return;
    setForm({
      firstName: d.firstName, lastName: d.lastName, email: d.email, phone: d.phone,
      headline: d.headline || '', summary: d.summary || '', nationality: d.nationality || '',
      currentLocation: d.currentLocation || '', experience: d.experience ?? '',
      skills: d.skills || [], languages: d.languages || [], education: d.education || '',
      linkedIn: d.linkedIn || '', portfolio: d.portfolio || '', introVideoUrl: d.introVideoUrl || '',
      status: d.status, notes: d.notes || '', isPublic: d.isPublic,
      currentSalary: d.currentSalary || '', expectedSalary: d.expectedSalary || '',
      categoryId: d.categoryId || '', industryId: d.industryId || '',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidate?.id]);

  const saveMutation = useMutation({
    mutationFn: (data: any) => api.put(`/candidates/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['candidate-detail', id] });
      toast.success('Candidate updated');
      setEditing(false);
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Update failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/candidates/${id}`),
    onSuccess: () => { toast.success('Candidate deleted'); router.push('/admin/candidates'); },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed to delete'),
  });

  const { data: shares } = useQuery({
    queryKey: ['profile-shares', id],
    queryFn: () => api.get('/profile-shares', { params: { candidateId: id, limit: 50 } }).then(r => r.data.data),
    enabled: !!id,
    staleTime: 0,
  });

  const withdrawMutation = useMutation({
    mutationFn: (shareId: string) => api.patch(`/profile-shares/${shareId}/withdraw`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profile-shares', id] });
      toast.success('Share withdrawn');
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed to withdraw'),
  });

  function handleSave() {
    const payload = { ...form, skills: form.skills.join(','), languages: form.languages.join(',') };
    saveMutation.mutate(payload);
  }

  function addSkill(s: string) {
    const t = s.trim();
    if (t && !form.skills.includes(t)) setForm(f => ({ ...f, skills: [...f.skills, t] }));
    setSkillInput('');
  }

  if (isLoading) {
    return (
      <div className="p-8 text-center text-gray-400">
        <div className="w-8 h-8 border-2 border-primary-300 border-t-primary-500 rounded-full animate-spin mx-auto mb-3" />
        Loading candidate…
      </div>
    );
  }

  if (!candidate) return <div className="p-8 text-center text-red-500">Candidate not found</div>;

  const c = candidate;

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/candidates" className="p-2 rounded-xl hover:bg-gray-100 text-gray-500 transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-gray-900 truncate">{c.firstName} {c.lastName}</h1>
          <div className="flex items-center gap-2">
            {c.cvId && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold font-mono bg-gray-900 text-white px-2 py-0.5 rounded-md tracking-wide">
                <FileText size={10} /> {c.cvId}
              </span>
            )}
            {c.headline && <p className="text-sm text-gray-500 truncate">{c.headline}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-xs font-bold px-3 py-1 rounded-full ${STATUS_COLORS[c.status] || 'bg-gray-100 text-gray-600'}`}>{c.status}</span>
          {c.isPublic ? (
            <span className="flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full font-semibold"><Eye size={10} /> Public</span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-gray-500 bg-gray-100 border border-gray-200 px-2.5 py-1 rounded-full font-semibold"><EyeOff size={10} /> Private</span>
          )}
          {!editing ? (
            <>
              <button onClick={() => setShareModalOpen(true)} className="flex items-center gap-1.5 bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded-xl hover:bg-emerald-600 transition-colors">
                <Share2 size={12} /> Share Profile
              </button>
              <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 bg-primary-400 text-white text-xs font-bold px-3 py-1.5 rounded-xl hover:bg-primary-500 transition-colors">
                <Edit3 size={12} /> Edit
              </button>
            </>
          ) : (
            <div className="flex gap-1.5">
              <button onClick={handleSave} disabled={saveMutation.isPending} className="flex items-center gap-1.5 bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded-xl hover:bg-emerald-600 transition-colors disabled:opacity-60">
                <Save size={12} /> {saveMutation.isPending ? 'Saving…' : 'Save'}
              </button>
              <button onClick={() => setEditing(false)} className="flex items-center gap-1.5 bg-gray-100 text-gray-600 text-xs font-bold px-3 py-1.5 rounded-xl hover:bg-gray-200 transition-colors">
                <X size={12} /> Cancel
              </button>
            </div>
          )}
          <button onClick={() => { if (confirm('Delete this candidate permanently?')) deleteMutation.mutate(); }}
            className="p-1.5 text-red-500 hover:bg-red-50 rounded-xl transition-colors">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-gray-100 rounded-xl p-1 w-fit">
        {validTabs.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`text-xs font-semibold px-4 py-1.5 rounded-lg capitalize transition-all ${tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {t}
            {t === 'history' && c.editHistory?.length > 0 && (
              <span className="ml-1 bg-primary-100 text-primary-600 px-1.5 rounded-full text-[10px]">{c.editHistory.length}</span>
            )}
            {t === 'applications' && c.applications?.length > 0 && (
              <span className="ml-1 bg-blue-100 text-blue-600 px-1.5 rounded-full text-[10px]">{c.applications.length}</span>
            )}
            {t === 'shares' && shares?.length > 0 && (
              <span className="ml-1 bg-emerald-100 text-emerald-600 px-1.5 rounded-full text-[10px]">{shares.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── PROFILE TAB ── */}
      {tab === 'profile' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Left column */}
          <div className="space-y-4">
            {/* Avatar + quick info */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5 text-center">
              <div className="w-20 h-20 mx-auto rounded-2xl bg-primary-50 border-2 border-primary-100 flex items-center justify-center text-2xl font-bold text-primary-600 mb-3">
                {c.photo ? (
                  <img src={`${API_URL}/${c.photo}`} alt="" className="w-full h-full object-cover rounded-2xl" />
                ) : `${c.firstName?.[0]}${c.lastName?.[0]}`}
              </div>
              {editing ? (
                <>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <input className="input text-sm" value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} placeholder="First" />
                    <input className="input text-sm" value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} placeholder="Last" />
                  </div>
                  <input className="input text-sm mb-2" value={form.headline} onChange={e => setForm(f => ({ ...f, headline: e.target.value }))} placeholder="Headline" />
                  <select className="input text-sm" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                    {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </>
              ) : (
                <>
                  <p className="font-bold text-gray-900 text-base">{c.firstName} {c.lastName}</p>
                  {c.headline && <p className="text-sm text-gray-500 mt-0.5">{c.headline}</p>}
                </>
              )}
            </div>

            {/* Contact */}
            <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Contact</h3>
              {editing ? (
                <div className="space-y-2">
                  <input className="input text-sm" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="Email" />
                  <input className="input text-sm" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="Phone" />
                  <input className="input text-sm" value={form.linkedIn} onChange={e => setForm(f => ({ ...f, linkedIn: e.target.value }))} placeholder="LinkedIn URL" />
                  <input className="input text-sm" value={form.portfolio} onChange={e => setForm(f => ({ ...f, portfolio: e.target.value }))} placeholder="Portfolio URL" />
                </div>
              ) : (
                <div className="space-y-2 text-sm">
                  {c.email && <p className="flex items-center gap-2 text-gray-700"><Mail size={12} className="text-gray-400 shrink-0" /> {c.email}</p>}
                  {c.phone && <p className="flex items-center gap-2 text-gray-700"><Phone size={12} className="text-gray-400 shrink-0" /> {c.phone}</p>}
                  {c.currentLocation && <p className="flex items-center gap-2 text-gray-700"><MapPin size={12} className="text-gray-400 shrink-0" /> {c.currentLocation}</p>}
                  {c.linkedIn && <a href={c.linkedIn} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-primary-500 hover:underline"><Linkedin size={12} /> LinkedIn</a>}
                  {c.portfolio && <a href={c.portfolio} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-primary-500 hover:underline"><Globe size={12} /> Portfolio</a>}
                </div>
              )}
            </div>

            {/* Quick stats */}
            <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Info</h3>
              {editing ? (
                <div className="space-y-2">
                  <input className="input text-sm" value={form.nationality} onChange={e => setForm(f => ({ ...f, nationality: e.target.value }))} placeholder="Nationality" />
                  <input className="input text-sm" value={form.currentLocation} onChange={e => setForm(f => ({ ...f, currentLocation: e.target.value }))} placeholder="Location" />
                  <input className="input text-sm" type="number" value={form.experience} onChange={e => setForm(f => ({ ...f, experience: e.target.value }))} placeholder="Experience (yrs)" />
                  <input className="input text-sm" type="number" value={form.currentSalary} onChange={e => setForm(f => ({ ...f, currentSalary: e.target.value }))} placeholder="Current Salary (AED)" />
                  <input className="input text-sm" type="number" value={form.expectedSalary} onChange={e => setForm(f => ({ ...f, expectedSalary: e.target.value }))} placeholder="Expected Salary (AED)" />
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="isPublic" checked={form.isPublic} onChange={e => setForm(f => ({ ...f, isPublic: e.target.checked }))} />
                    <label htmlFor="isPublic" className="text-sm text-gray-700">Visible on public page</label>
                  </div>
                  <select className="input text-sm" value={form.categoryId || ''} onChange={e => setForm(f => ({ ...f, categoryId: e.target.value }))}>
                    <option value="">No category</option>
                    {(categories || []).map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                  </select>
                  <select className="input text-sm" value={form.industryId || ''} onChange={e => setForm(f => ({ ...f, industryId: e.target.value }))}>
                    <option value="">No industry</option>
                    {(industries || []).map((ind) => <option key={ind.id} value={ind.id}>{ind.name}</option>)}
                  </select>
                </div>
              ) : (
                <div className="space-y-2 text-sm">
                  {[
                    ['Nationality', c.nationality],
                    ['Visa Status', c.visaStatus],
                    ['Experience', c.experience ? `${c.experience} yrs` : null],
                    ['Current Salary', c.currentSalary ? `AED ${c.currentSalary.toLocaleString()}` : null],
                    ['Expected Salary', c.expectedSalary ? `AED ${c.expectedSalary.toLocaleString()}` : null],
                    ['Source', c.source],
                  ].map(([label, val]) => val ? (
                    <div key={label as string} className="flex justify-between">
                      <span className="text-gray-400">{label}</span>
                      <span className="font-semibold text-gray-700">{val}</span>
                    </div>
                  ) : null)}
                  {(c.category || c.industry) && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {c.category && <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${c.category.color}18`, color: c.category.color }}>{c.category.name}</span>}
                      {c.industry && <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${c.industry.color}18`, color: c.industry.color }}>{c.industry.name}</span>}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* CV link */}
            {c.cvPath && (
              <a href={`${API_URL}/${c.cvPath}`} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 bg-white border border-gray-200 rounded-2xl p-4 text-sm text-primary-500 font-semibold hover:bg-primary-50 transition-colors">
                <FileText size={14} /> View / Download CV
              </a>
            )}
          </div>

          {/* Right column */}
          <div className="lg:col-span-2 space-y-4">
            {/* Summary */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Professional Summary</h3>
              {editing ? (
                <textarea className="input w-full h-28 resize-none text-sm" value={form.summary} onChange={e => setForm(f => ({ ...f, summary: e.target.value }))} placeholder="Professional summary…" />
              ) : (
                <p className="text-sm text-gray-700 leading-relaxed">{c.summary || <span className="text-gray-300">No summary added</span>}</p>
              )}
            </div>

            {/* Intro Video */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <PlayCircle size={13} /> Intro Video
              </h3>
              {editing ? (
                <div className="space-y-2">
                  <input className="input text-sm" value={form.introVideoUrl} onChange={e => setForm(f => ({ ...f, introVideoUrl: e.target.value }))} placeholder="https://youtube.com/watch?v=… or https://youtu.be/…" />
                  {form.introVideoUrl && !isValidYouTubeUrl(form.introVideoUrl) && (
                    <p className="text-xs text-red-500">That doesn't look like a valid YouTube link</p>
                  )}
                </div>
              ) : c.introVideoUrl ? (
                <div className="max-w-sm">
                  <YouTubeEmbed url={c.introVideoUrl} title={`${c.firstName} ${c.lastName} — intro video`} />
                </div>
              ) : (
                <p className="text-sm text-gray-300">No intro video added</p>
              )}
            </div>

            {/* Skills */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Skills</h3>
              <div className="flex flex-wrap gap-2 mb-3">
                {(editing ? form.skills : c.skills || []).map((s: string) => (
                  <span key={s} className="flex items-center gap-1 bg-primary-50 border border-primary-100 text-primary-700 text-xs font-semibold px-2.5 py-1 rounded-full">
                    {s}
                    {editing && (
                      <button type="button" onClick={() => setForm(f => ({ ...f, skills: f.skills.filter((x: string) => x !== s) }))} className="hover:text-red-500 ml-0.5">
                        <X size={10} />
                      </button>
                    )}
                  </span>
                ))}
                {(editing ? form.skills : c.skills || []).length === 0 && <span className="text-gray-300 text-sm">No skills listed</span>}
              </div>
              {editing && (
                <div className="flex gap-2">
                  <input className="input flex-1 text-sm" value={skillInput} onChange={e => setSkillInput(e.target.value)}
                    placeholder="Add skill…" onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSkill(skillInput); } }} />
                  <button type="button" onClick={() => addSkill(skillInput)} className="btn-outline text-xs px-3 py-2"><Plus size={13} /></button>
                </div>
              )}
            </div>

            {/* Languages */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Languages</h3>
              <div className="flex flex-wrap gap-2">
                {(c.languages || []).map((l: string) => (
                  <span key={l} className="bg-gray-100 text-gray-700 text-xs font-semibold px-2.5 py-1 rounded-full">{l}</span>
                ))}
                {(c.languages || []).length === 0 && <span className="text-gray-300 text-sm">None listed</span>}
              </div>
              {editing && (
                <div className="flex gap-2 mt-3">
                  <input className="input flex-1 text-sm" placeholder="Add language…"
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        const t = (e.target as HTMLInputElement).value.trim();
                        if (t && !form.languages.includes(t)) setForm(f => ({ ...f, languages: [...f.languages, t] }));
                        (e.target as HTMLInputElement).value = '';
                      }
                    }} />
                </div>
              )}
            </div>

            {/* Education */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Education</h3>
              {editing ? (
                <textarea className="input w-full h-20 resize-none text-sm" value={form.education} onChange={e => setForm(f => ({ ...f, education: e.target.value }))} placeholder="Education details…" />
              ) : (
                <p className="text-sm text-gray-700 whitespace-pre-line">{c.education || <span className="text-gray-300">No education info</span>}</p>
              )}
            </div>

            {/* Internal notes */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Internal Notes</h3>
              {editing ? (
                <textarea className="input w-full h-20 resize-none text-sm" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Internal notes (not visible to candidate)…" />
              ) : (
                <p className="text-sm text-gray-700 whitespace-pre-line">{c.notes || <span className="text-gray-300">No notes</span>}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── EDIT HISTORY TAB ── */}
      {tab === 'history' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h2 className="text-base font-bold text-gray-900">Edit History</h2>
              <p className="text-xs text-gray-400 mt-0.5">Complete audit trail of all profile changes</p>
            </div>
            <span className="text-xs font-semibold bg-gray-100 text-gray-600 px-3 py-1 rounded-full">
              {(c.editHistory || []).length} entries
            </span>
          </div>

          {(c.editHistory || []).length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center">
              <History size={28} className="text-gray-300 mx-auto mb-3" />
              <p className="text-sm font-semibold text-gray-600">No edit history yet</p>
              <p className="text-xs text-gray-400 mt-1">Changes made by the candidate or admin will appear here</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              {/* Column headers */}
              <div className="grid grid-cols-3 gap-2 px-3 py-2 bg-gray-50 border-b border-gray-100 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                <span className="col-span-1">Who / When</span>
                <span>Previous Value</span>
                <span>New Value</span>
              </div>
              <div className="divide-y divide-gray-50">
                {(c.editHistory || []).map((entry: any) => (
                  <EditHistoryItem key={entry.id} entry={entry} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── APPLICATIONS TAB ── */}
      {tab === 'applications' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-base font-bold text-gray-900">Applications</h2>
            <span className="text-xs font-semibold bg-gray-100 text-gray-600 px-3 py-1 rounded-full">{(c.applications || []).length} total</span>
          </div>
          {(c.applications || []).length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center text-gray-400 text-sm">No applications yet</div>
          ) : (
            (c.applications || []).map((app: any) => (
              <div key={app.id} className="bg-white rounded-2xl border border-gray-200 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{app.job?.title}</p>
                    <p className="text-xs text-gray-500">{app.job?.client?.companyName} · {app.job?.location}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${STATUS_COLORS[app.status] || 'bg-gray-100 text-gray-600'}`}>{app.status}</span>
                    <p className="text-[10px] text-gray-400 mt-1">{new Date(app.appliedAt).toLocaleDateString('en-AE')}</p>
                  </div>
                </div>
                {app.notes && <p className="text-xs text-gray-500 mt-2 bg-gray-50 rounded-lg px-3 py-2">Note: {app.notes}</p>}
              </div>
            ))
          )}
        </div>
      )}

      {/* ── DOCUMENTS TAB ── */}
      {tab === 'documents' && (
        <div className="space-y-3">
          <h2 className="text-base font-bold text-gray-900 mb-2">Documents</h2>
          {(c.documents || []).length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center text-gray-400 text-sm">No documents uploaded</div>
          ) : (
            (c.documents || []).map((doc: any) => (
              <div key={doc.id} className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText size={16} className="text-primary-400 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{doc.title}</p>
                    <p className="text-[11px] text-gray-400">{doc.type} · {new Date(doc.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
                <a href={`${API_URL}/${doc.filePath}`} target="_blank" rel="noopener noreferrer"
                  className="text-xs font-semibold text-primary-500 hover:underline">View</a>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── SHARES TAB ── */}
      {tab === 'shares' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h2 className="text-base font-bold text-gray-900">Profile Shares</h2>
              <p className="text-xs text-gray-400 mt-0.5">Companies this candidate's profile has been shared with</p>
            </div>
            <button onClick={() => setShareModalOpen(true)} className="flex items-center gap-1.5 bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded-xl hover:bg-emerald-600 transition-colors">
              <Share2 size={12} /> Share Profile
            </button>
          </div>
          {(shares || []).length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center">
              <Share2 size={28} className="text-gray-300 mx-auto mb-3" />
              <p className="text-sm font-semibold text-gray-600">Not shared with any company yet</p>
            </div>
          ) : (
            (shares || []).map((s: any) => (
              <Link key={s.id} href={`/admin/profile-shares/${s.id}`} className="block bg-white rounded-2xl border border-gray-200 p-4 hover:border-primary-200 transition-colors">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{s.client?.companyName}</p>
                    <p className="text-xs text-gray-500">{s.job?.title || 'General profile'} · {s.sentByUser?.name}</p>
                    <p className="text-[10px] text-gray-400 mt-1">{new Date(s.sentAt).toLocaleDateString('en-AE', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${SHARE_STATUS_COLORS[s.status] || 'bg-gray-100 text-gray-600'}`}>{s.status}</span>
                    {s.status !== 'WITHDRAWN' && (
                      <button
                        onClick={(e) => { e.preventDefault(); if (confirm('Withdraw this share? The company will no longer be able to view it.')) withdrawMutation.mutate(s.id); }}
                        className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition-colors" title="Withdraw"
                      >
                        <Ban size={13} />
                      </button>
                    )}
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      )}

      {/* ── TRACKING TAB ── */}
      {tab === 'tracking' && (
        <div>
          <div className="mb-4">
            <h2 className="text-base font-bold text-gray-900">Industry Tracking</h2>
            <p className="text-xs text-gray-400 mt-0.5">Track this candidate against the SOP/KPI checklist for their placement industry</p>
          </div>
          <CandidateTrackingPanel candidateId={c.id} />
        </div>
      )}

      <ShareProfileModal isOpen={shareModalOpen} onClose={() => setShareModalOpen(false)} candidate={c} />
    </div>
  );
}
