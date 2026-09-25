'use client';
import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import {
  Upload, FileText, CheckCircle, AlertCircle, Loader2,
  User, Mail, Phone, MapPin, Briefcase, Globe, Link2,
  Star, BookOpen, ChevronRight, ArrowLeft, Eye, EyeOff,
  RefreshCw, Plus, X, Save,
} from 'lucide-react';

/* ── Helpers ── */
function Field({ label, icon: Icon, value, onChange, multiline = false, placeholder = '', type = 'text' }: any) {
  return (
    <div>
      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">{label}</label>
      <div className="relative">
        {Icon && <Icon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />}
        {multiline ? (
          <textarea
            value={value || ''} onChange={e => onChange(e.target.value)}
            placeholder={placeholder}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/30 focus:border-primary-400 resize-none h-24 bg-white transition-all"
          />
        ) : (
          <input
            type={type} value={value || ''} onChange={e => onChange(e.target.value)}
            placeholder={placeholder}
            className={`w-full border border-gray-200 rounded-xl py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/30 focus:border-primary-400 bg-white transition-all ${Icon ? 'pl-9 pr-3' : 'px-3'}`}
          />
        )}
      </div>
    </div>
  );
}

function TagEditor({ label, values, onChange }: { label: string; values: string[]; onChange: (v: string[]) => void }) {
  const [input, setInput] = useState('');
  const add = () => {
    const v = input.trim();
    if (v && !values.includes(v)) onChange([...values, v]);
    setInput('');
  };
  return (
    <div>
      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">{label}</label>
      <div className="flex flex-wrap gap-1.5 mb-2 min-h-[28px]">
        {values.map((v, i) => (
          <span key={i} className="flex items-center gap-1 bg-primary-50 border border-primary-200 text-primary-700 text-xs font-semibold px-2.5 py-1 rounded-full">
            {v}
            <button onClick={() => onChange(values.filter((_, j) => j !== i))} className="text-primary-400 hover:text-primary-700 ml-0.5"><X size={10} /></button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          placeholder="Type and press Enter"
          className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/30 focus:border-primary-400 bg-white"
        />
        <button onClick={add} className="w-9 h-9 flex items-center justify-center bg-primary-400 text-white rounded-xl hover:bg-primary-500 transition-colors shrink-0">
          <Plus size={14} />
        </button>
      </div>
    </div>
  );
}

/* ── Steps ── */
type Step = 'upload' | 'review' | 'done';

const STATUSES = ['NEW','SCREENING','SHORTLISTED','INTERVIEW_SCHEDULED','INTERVIEWED','OFFERED','JOINED','REJECTED','ON_HOLD'];

export default function AdminImportCVPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>('upload');
  const [dragging, setDragging] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cvPath, setCvPath] = useState('');
  const [parseError, setParseError] = useState('');
  const [createdId, setCreatedId] = useState('');

  const [form, setForm] = useState<any>({
    firstName: '', lastName: '', email: '', phone: '',
    headline: '', summary: '', nationality: '', currentLocation: '',
    experience: '', linkedIn: '', portfolio: '',
    skills: [], languages: [],
    education: '', status: 'NEW', notes: '',
    isPublic: false,
  });

  function set(key: string, val: any) {
    setForm((f: any) => ({ ...f, [key]: val }));
  }

  async function parseFile(file: File) {
    setParsing(true);
    setParseError('');
    try {
      const fd = new FormData();
      fd.append('cv', file);
      const { data } = await api.post('/candidates/parse-cv', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setCvPath(data.cvPath || '');
      const p = data.parsed || {};
      if (p._error) {
        setParseError(p._error);
        toast.error('Could not extract text from CV — please fill in manually');
      } else {
        toast.success('CV parsed successfully!');
      }
      setForm({
        firstName:       p.firstName       || '',
        lastName:        p.lastName        || '',
        email:           p.email           || '',
        phone:           p.phone           || '',
        headline:        p.headline        || '',
        summary:         p.summary         || '',
        nationality:     p.nationality     || '',
        currentLocation: p.currentLocation || '',
        experience:      p.experience      || '',
        linkedIn:        p.linkedIn        || '',
        portfolio:       p.portfolio       || '',
        skills:          Array.isArray(p.skills)    ? p.skills    : [],
        languages:       Array.isArray(p.languages) ? p.languages : [],
        education:       p.education       || '',
        status: 'NEW', notes: '', isPublic: false,
      });
      setStep('review');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Could not parse CV — please fill in the details manually.');
      setCvPath('');
      setParseError(err.response?.data?.error || 'CV parsing is unavailable right now.');
      setStep('review');
    } finally {
      setParsing(false);
    }
  }

  function skipToManual() {
    setCvPath('');
    setParseError('');
    setStep('review');
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) parseFile(file);
  }, []);

  async function handleSave(makePublic: boolean) {
    if (!form.firstName || !form.lastName || !form.email || !form.phone) {
      toast.error('First name, last name, email and phone are required');
      return;
    }
    setSaving(true);
    try {
      const fd = new FormData();
      const payload = { ...form, isPublic: makePublic };
      Object.entries(payload).forEach(([k, v]) => {
        if (Array.isArray(v)) fd.append(k, (v as string[]).join(','));
        else if (v !== null && v !== undefined) fd.append(k, String(v));
      });
      if (cvPath) fd.append('cvPath', cvPath);

      const { data } = await api.post('/candidates/admin-import', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setCreatedId(data.id);
      setStep('done');
      toast.success(makePublic ? 'Candidate added & published!' : 'Candidate added (draft)');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  /* ─── STEP: upload ─── */
  if (step === 'upload') return (
    <div className="max-w-2xl mx-auto py-6">
      <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6 transition-colors">
        <ArrowLeft size={15} /> Back to Candidates
      </button>

      <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-primary-50 border border-primary-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FileText size={24} className="text-primary-500" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Import Candidate from CV</h1>
          <p className="text-sm text-gray-500 mt-1.5">Upload a resume — we'll auto-fill all the details for you to review</p>
        </div>

        {/* Drop zone */}
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl py-14 flex flex-col items-center justify-center cursor-pointer transition-all ${
            dragging ? 'border-primary-400 bg-primary-50' : 'border-gray-200 hover:border-primary-300 hover:bg-gray-50'
          }`}
        >
          {parsing ? (
            <>
              <Loader2 size={32} className="text-primary-400 animate-spin mb-3" />
              <p className="text-sm font-semibold text-gray-600">Parsing CV…</p>
              <p className="text-xs text-gray-400 mt-1">Extracting name, email, skills and more</p>
            </>
          ) : (
            <>
              <Upload size={32} className={`mb-3 ${dragging ? 'text-primary-400' : 'text-gray-300'}`} />
              <p className="text-sm font-bold text-gray-700">Drop CV here or click to browse</p>
              <p className="text-xs text-gray-400 mt-1">PDF, DOCX, DOC — up to 10MB</p>
            </>
          )}
          <input ref={fileRef} type="file" accept=".pdf,.doc,.docx" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) parseFile(f); }} />
        </div>

        <div className="mt-6 grid grid-cols-3 gap-3 text-center">
          {[
            { label: 'Auto-fills name, email, phone', icon: User },
            { label: 'Extracts skills & languages', icon: Star },
            { label: 'Works with scanned PDFs', icon: FileText },
          ].map(({ label, icon: Icon }) => (
            <div key={label} className="bg-gray-50 rounded-xl p-3">
              <Icon size={16} className="text-primary-400 mx-auto mb-1.5" />
              <p className="text-[11px] font-semibold text-gray-600">{label}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 text-center">
          <button onClick={skipToManual} className="text-sm text-gray-400 hover:text-primary-500 underline-offset-2 hover:underline">
            Skip — I&apos;ll enter the candidate&apos;s details manually →
          </button>
        </div>
      </div>
    </div>
  );

  /* ─── STEP: review ─── */
  if (step === 'review') return (
    <div className="max-w-3xl mx-auto py-6 pb-10">
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => setStep('upload')} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors">
          <ArrowLeft size={15} /> Re-upload CV
        </button>
        {cvPath && !parseError ? (
          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 bg-emerald-50 border border-emerald-100 px-3 py-1.5 rounded-full">
            <CheckCircle size={12} /> CV parsed — review & edit below
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 bg-gray-100 border border-gray-200 px-3 py-1.5 rounded-full">
            <User size={12} /> Manual entry
          </div>
        )}
      </div>

      {parseError && (
        <div className="mb-4 flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700">
          <AlertCircle size={15} className="shrink-0 mt-0.5" />
          <span>Could not extract text from this CV: <em>{parseError}</em>. Please fill in the fields manually.</span>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 bg-gray-50">
          <h2 className="font-bold text-gray-900">Review Candidate Profile</h2>
          <p className="text-xs text-gray-400 mt-0.5">All fields are editable — correct anything the parser got wrong</p>
        </div>

        <div className="p-6 space-y-6">
          {/* Basic info */}
          <section>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <User size={12} /> Basic Information
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="First Name *" icon={User}  value={form.firstName} onChange={(v: string) => set('firstName', v)} placeholder="John" />
              <Field label="Last Name *"  icon={User}  value={form.lastName}  onChange={(v: string) => set('lastName', v)}  placeholder="Doe" />
              <Field label="Email *"      icon={Mail}  value={form.email}     onChange={(v: string) => set('email', v)}     placeholder="john@example.com" type="email" />
              <Field label="Phone *"      icon={Phone} value={form.phone}     onChange={(v: string) => set('phone', v)}     placeholder="+971 50 000 0000" />
              <Field label="Nationality"  icon={Globe} value={form.nationality}     onChange={(v: string) => set('nationality', v)}     placeholder="UAE" />
              <Field label="Current Location" icon={MapPin} value={form.currentLocation} onChange={(v: string) => set('currentLocation', v)} placeholder="Dubai, UAE" />
              <Field label="Experience (years)" icon={Briefcase} value={form.experience} onChange={(v: string) => set('experience', v)} placeholder="5" type="number" />
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Status</label>
                <select value={form.status} onChange={e => set('status', e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/30 bg-white">
                  {STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
            </div>
          </section>

          {/* Professional */}
          <section className="border-t border-gray-100 pt-6">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Briefcase size={12} /> Professional
            </h3>
            <div className="space-y-4">
              <Field label="Headline / Job Title" value={form.headline} onChange={(v: string) => set('headline', v)} placeholder="Senior HR Manager" />
              <Field label="Summary" value={form.summary} onChange={(v: string) => set('summary', v)} multiline placeholder="Professional summary…" />
              <Field label="Education" icon={BookOpen} value={form.education} onChange={(v: string) => set('education', v)} multiline placeholder="BSc Computer Science, 2018…" />
            </div>
          </section>

          {/* Skills & languages */}
          <section className="border-t border-gray-100 pt-6">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Star size={12} /> Skills & Languages
            </h3>
            <div className="space-y-4">
              <TagEditor label="Skills" values={form.skills} onChange={v => set('skills', v)} />
              <TagEditor label="Languages" values={form.languages} onChange={v => set('languages', v)} />
            </div>
          </section>

          {/* Links */}
          <section className="border-t border-gray-100 pt-6">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Link2 size={12} /> Links & Notes
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="LinkedIn URL"  icon={Link2} value={form.linkedIn}  onChange={(v: string) => set('linkedIn', v)}  placeholder="https://linkedin.com/in/…" />
              <Field label="Portfolio URL" icon={Link2} value={form.portfolio} onChange={(v: string) => set('portfolio', v)} placeholder="https://…" />
              <div className="sm:col-span-2">
                <Field label="Internal Notes" value={form.notes} onChange={(v: string) => set('notes', v)} multiline placeholder="Recruiter notes visible only to admins…" />
              </div>
            </div>
          </section>
        </div>

        {/* Action footer */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="flex-1 flex items-center gap-2 text-sm text-gray-500">
            <FileText size={14} className="text-gray-400" />
            {cvPath ? <span className="truncate text-xs font-mono text-gray-400">{cvPath.split('/').pop()}</span> : <span className="text-xs text-gray-400">No CV file</span>}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleSave(false)}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-300 text-gray-700 text-sm font-semibold hover:bg-white hover:border-gray-400 transition-all disabled:opacity-50"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Save as Draft
            </button>
            <button
              onClick={() => handleSave(true)}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary-400 text-white text-sm font-bold hover:bg-primary-500 transition-all disabled:opacity-50 shadow-sm shadow-primary-400/30"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Eye size={14} />}
              Save & Make Public
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  /* ─── STEP: done ─── */
  return (
    <div className="max-w-lg mx-auto py-16 text-center">
      <div className="w-16 h-16 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
        <CheckCircle size={30} className="text-emerald-500" />
      </div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Candidate Added!</h1>
      <p className="text-sm text-gray-500 mb-8">The candidate profile has been created successfully.</p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <button
          onClick={() => router.push(`/admin/candidates/${createdId}`)}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-primary-400 text-white font-bold rounded-xl hover:bg-primary-500 transition-all shadow-sm"
        >
          <User size={15} /> View Profile <ChevronRight size={14} />
        </button>
        <button
          onClick={() => { setStep('upload'); setForm({ firstName:'',lastName:'',email:'',phone:'',headline:'',summary:'',nationality:'',currentLocation:'',experience:'',linkedIn:'',portfolio:'',skills:[],languages:[],education:'',status:'NEW',notes:'',isPublic:false }); setCvPath(''); }}
          className="flex items-center justify-center gap-2 px-5 py-2.5 border border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-all"
        >
          <RefreshCw size={14} /> Import Another
        </button>
        <button
          onClick={() => router.push('/admin/candidates')}
          className="flex items-center justify-center gap-2 px-5 py-2.5 border border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-all"
        >
          All Candidates
        </button>
      </div>
    </div>
  );
}
