'use client';
import { useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Upload, CheckCircle, AlertCircle, ArrowRight, ArrowLeft, User, FileText, Plus, X, Loader2, ShieldCheck } from 'lucide-react';
import OtpVerifyStep from '@/components/OtpVerifyStep';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:5001';

const STEPS = ['Upload CV', 'Review & Edit', 'Verify Email', 'Set Password', 'Done'];

type ParsedCV = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  nationality?: string;
  currentLocation?: string;
  experience?: number;
  skills?: string[];
  languages?: string[];
  education?: string;
  summary?: string;
  headline?: string;
  linkedIn?: string;
};

type FormState = ParsedCV & {
  password: string;
  confirmPassword: string;
};

const INITIAL_FORM: FormState = {
  firstName: '', lastName: '', email: '', phone: '',
  nationality: '', currentLocation: '', experience: undefined,
  skills: [], languages: [], education: '', summary: '', headline: '', linkedIn: '',
  password: '', confirmPassword: '',
};

export default function CandidateRegisterPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep]           = useState(0);
  const [cvFile, setCvFile]       = useState<File | null>(null);
  const [parsing, setParsing]     = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm]           = useState<FormState>(INITIAL_FORM);
  const [parsedRaw, setParsedRaw] = useState<ParsedCV | null>(null);
  const [skillInput, setSkillInput] = useState('');
  const [langInput, setLangInput]   = useState('');
  const [ticket, setTicket]         = useState<string | null>(null);
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);

  function setField(field: keyof FormState, value: FormState[keyof FormState]) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  function addSkill(raw: string) {
    const t = raw.trim();
    if (t && !form.skills?.includes(t)) {
      setField('skills', [...(form.skills || []), t]);
    }
    setSkillInput('');
  }

  function removeSkill(s: string) {
    setField('skills', (form.skills || []).filter(x => x !== s));
  }

  function addLang(raw: string) {
    const t = raw.trim();
    if (t && !form.languages?.includes(t)) {
      setField('languages', [...(form.languages || []), t]);
    }
    setLangInput('');
  }

  function removeLang(l: string) {
    setField('languages', (form.languages || []).filter(x => x !== l));
  }

  async function handleCVUpload(file: File) {
    setCvFile(file);
    setParsing(true);
    try {
      const fd = new FormData();
      fd.append('cv', file);
      const { data } = await axios.post(`${API}/api/candidate-auth/parse-cv`, fd);
      const p: ParsedCV & { _error?: string } = data.parsed ?? {};
      setParsedRaw(p);

      if (p._error) {
        toast.error(p._error, { duration: 6000 });
      }

      // Count how many fields we actually got
      const filled = [p.firstName, p.lastName, p.email, p.phone, p.nationality, p.currentLocation].filter(Boolean).length;

      setForm(prev => ({
        ...prev,
        firstName:       p.firstName       || prev.firstName,
        lastName:        p.lastName        || prev.lastName,
        email:           p.email           || prev.email,
        phone:           p.phone           || prev.phone,
        nationality:     p.nationality     || prev.nationality,
        currentLocation: p.currentLocation || prev.currentLocation,
        experience:      p.experience      ?? prev.experience,
        skills:          p.skills?.length  ? p.skills : prev.skills,
        languages:       p.languages?.length ? p.languages : prev.languages,
        education:       p.education || prev.education,
        summary:         p.summary   || prev.summary,
        headline:        p.headline  || prev.headline,
        linkedIn:        p.linkedIn  || prev.linkedIn,
      }));

      if (!p._error) {
        toast.success(filled > 0
          ? `CV parsed — ${filled} fields auto-filled. Review and complete below.`
          : 'CV uploaded. Please fill in your details below.',
          { duration: 4000 }
        );
      }
      setStep(1);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Could not parse CV — please fill in your details manually.');
      setStep(1);
    } finally {
      setParsing(false);
    }
  }

  async function handleSubmit() {
    if (form.password !== form.confirmPassword) { toast.error('Passwords do not match'); return; }
    if (form.password.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    if (!form.firstName || !form.lastName || !form.email || !form.phone) {
      toast.error('Please fill all required fields'); return;
    }
    if (!ticket || verifiedEmail !== form.email) {
      toast.error('Please verify your email first'); setStep(2); return;
    }
    setSubmitting(true);
    try {
      const fd = new FormData();
      (Object.entries(form) as [string, FormState[keyof FormState]][]).forEach(([k, v]) => {
        if (k === 'confirmPassword') return;
        if (Array.isArray(v)) v.forEach((i: string) => fd.append(k, i));
        else if (v !== undefined && v !== null && v !== '') fd.append(k, String(v));
      });
      // Save the original parsed data for admin audit trail
      if (parsedRaw) fd.append('parsedData', JSON.stringify(parsedRaw));
      if (cvFile) fd.append('cv', cvFile);
      fd.append('emailVerificationTicket', ticket);
      await axios.post(`${API}/api/candidate-auth/register`, fd);
      setStep(4);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-5 py-4 flex items-center gap-3">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary-400 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">A</span>
          </div>
          <span className="font-bold text-gray-900">Al Khadim</span>
        </Link>
        <span className="text-gray-300">›</span>
        <span className="text-sm text-gray-500">Candidate Registration</span>
      </header>

      {/* Progress */}
      <div className="bg-white border-b border-gray-100 px-5 py-3">
        <div className="max-w-2xl mx-auto flex items-center gap-2">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all ${
                i < step ? 'bg-emerald-500 text-white' : i === step ? 'bg-primary-400 text-white' : 'bg-gray-100 text-gray-400'
              }`}>
                {i < step ? '✓' : i + 1}
              </div>
              <span className={`text-xs font-medium hidden sm:block ${i === step ? 'text-primary-500' : 'text-gray-400'}`}>{s}</span>
              {i < STEPS.length - 1 && <div className="flex-1 h-px bg-gray-200 mx-1" />}
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 max-w-2xl mx-auto w-full px-5 py-8">

        {/* STEP 0 – Upload */}
        {step === 0 && (
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Upload Your CV</h1>
            <p className="text-gray-500 text-sm mb-8">We'll automatically extract your details. Supports PDF and DOCX files.</p>

            <div
              className={`border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center cursor-pointer transition-all ${
                parsing ? 'border-primary-300 bg-primary-50' : 'border-gray-300 bg-white hover:border-primary-400 hover:bg-primary-50/30'
              }`}
              onClick={() => !parsing && fileRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleCVUpload(f); }}
            >
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.doc,.docx"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleCVUpload(f); }}
              />

              {parsing ? (
                <>
                  <Loader2 size={40} className="text-primary-400 animate-spin mb-3" />
                  <p className="font-semibold text-primary-600">Parsing your CV…</p>
                  <p className="text-sm text-gray-400 mt-1">Extracting name, skills, experience and more</p>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 bg-primary-50 border-2 border-primary-100 rounded-2xl flex items-center justify-center mb-4">
                    <Upload size={28} className="text-primary-400" />
                  </div>
                  <p className="font-semibold text-gray-700">Drag &amp; drop your CV here</p>
                  <p className="text-sm text-gray-400 mt-1">or click to browse · PDF, DOC, DOCX · Max 10MB</p>
                </>
              )}
            </div>

            <div className="mt-6 text-center">
              <button onClick={() => setStep(1)} className="text-sm text-gray-400 hover:text-primary-500 underline-offset-2 hover:underline">
                Skip — I'll fill in my details manually →
              </button>
            </div>
          </div>
        )}

        {/* STEP 1 – Review & Edit */}
        {step === 1 && (
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Review Your Details</h1>
            <p className="text-gray-500 text-sm mb-4">
              {cvFile ? "We've auto-filled fields from your CV. Review everything and correct if needed." : 'Fill in your profile details below.'}
            </p>

            {/* Parsed data summary banner */}
            {parsedRaw && cvFile && (() => {
              const p = parsedRaw as ParsedCV & { _error?: string };
              const filledFields = [
                p.firstName && `Name: ${p.firstName} ${p.lastName}`,
                p.email && `Email: ${p.email}`,
                p.phone && `Phone: ${p.phone}`,
                p.experience && `${p.experience} yrs exp`,
                p.nationality && p.nationality,
                p.currentLocation && p.currentLocation,
                (p.skills?.length ?? 0) > 0 && `${p.skills!.length} skills`,
                (p.languages?.length ?? 0) > 0 && `${p.languages!.length} languages`,
              ].filter(Boolean) as string[];

              return filledFields.length > 0 ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 mb-5 flex items-start gap-3">
                  <CheckCircle size={16} className="text-emerald-500 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-emerald-700 mb-1.5">Extracted from your CV</p>
                    <div className="flex flex-wrap gap-1.5">
                      {filledFields.map(f => (
                        <span key={f} className="text-[11px] font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">{f}</span>
                      ))}
                    </div>
                  </div>
                </div>
              ) : p._error ? (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-5 flex items-start gap-3">
                  <AlertCircle size={16} className="text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-amber-700">Could not read CV text</p>
                    <p className="text-xs text-amber-600 mt-0.5">The file may be a scanned/image PDF. Please fill in your details manually below.</p>
                  </div>
                </div>
              ) : null;
            })()}

            <div className="space-y-5">
              <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
                <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                  <User size={14} /> Personal Info
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">First Name *</label>
                    <input className="input" value={form.firstName} onChange={e => setField('firstName', e.target.value)} placeholder="First name" />
                  </div>
                  <div>
                    <label className="label">Last Name *</label>
                    <input className="input" value={form.lastName} onChange={e => setField('lastName', e.target.value)} placeholder="Last name" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Email *</label>
                    <input className="input" type="email" value={form.email} onChange={e => setField('email', e.target.value)} placeholder="you@email.com" />
                  </div>
                  <div>
                    <label className="label">Phone *</label>
                    <input className="input" value={form.phone} onChange={e => setField('phone', e.target.value)} placeholder="+971 50 123 4567" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Nationality</label>
                    <input className="input" value={form.nationality} onChange={e => setField('nationality', e.target.value)} placeholder="e.g. Indian" />
                  </div>
                  <div>
                    <label className="label">Current Location</label>
                    <input className="input" value={form.currentLocation} onChange={e => setField('currentLocation', e.target.value)} placeholder="e.g. Dubai, UAE" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Years of Experience</label>
                    <input className="input" type="number" min="0" max="50"
                      value={form.experience ?? ''}
                      onChange={e => setField('experience', e.target.value ? parseInt(e.target.value) : undefined)}
                      placeholder="0" />
                  </div>
                  <div>
                    <label className="label">LinkedIn URL</label>
                    <input className="input" value={form.linkedIn} onChange={e => setField('linkedIn', e.target.value)} placeholder="linkedin.com/in/…" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
                <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                  <FileText size={14} /> Professional Profile
                </h3>
                <div>
                  <label className="label">Professional Headline</label>
                  <input className="input" value={form.headline} onChange={e => setField('headline', e.target.value)} placeholder="e.g. Senior Software Engineer with 8+ years in UAE" />
                </div>
                <div>
                  <label className="label">Professional Summary</label>
                  <textarea className="input h-24 resize-none" value={form.summary} onChange={e => setField('summary', e.target.value)} placeholder="Brief overview of your professional background…" />
                </div>
                <div>
                  <label className="label">Education</label>
                  <textarea className="input h-20 resize-none" value={form.education} onChange={e => setField('education', e.target.value)} placeholder="e.g. B.Tech Computer Science, XYZ University, 2015" />
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
                <h3 className="text-sm font-bold text-gray-700">Skills</h3>
                <div className="flex flex-wrap gap-2">
                  {(form.skills || []).map(s => (
                    <span key={s} className="flex items-center gap-1 bg-primary-50 border border-primary-100 text-primary-700 text-xs font-semibold px-2.5 py-1 rounded-full">
                      {s}
                      <button type="button" onClick={() => removeSkill(s)} className="hover:text-red-500">
                        <X size={10} />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input className="input flex-1 text-sm" value={skillInput} onChange={e => setSkillInput(e.target.value)}
                    placeholder="Add a skill (e.g. React, Python, SAP)"
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSkill(skillInput); } }} />
                  <button type="button" onClick={() => addSkill(skillInput)} className="btn-outline text-xs px-3 py-2">
                    <Plus size={14} />
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
                <h3 className="text-sm font-bold text-gray-700">Languages</h3>
                <div className="flex flex-wrap gap-2">
                  {(form.languages || []).map(l => (
                    <span key={l} className="flex items-center gap-1 bg-gray-50 border border-gray-200 text-gray-700 text-xs font-semibold px-2.5 py-1 rounded-full">
                      {l}
                      <button type="button" onClick={() => removeLang(l)} className="hover:text-red-500">
                        <X size={10} />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input className="input flex-1 text-sm" value={langInput} onChange={e => setLangInput(e.target.value)}
                    placeholder="Add a language (e.g. English, Arabic)"
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addLang(langInput); } }} />
                  <button type="button" onClick={() => addLang(langInput)} className="btn-outline text-xs px-3 py-2">
                    <Plus size={14} />
                  </button>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setStep(0)} className="btn-outline flex items-center gap-2">
                <ArrowLeft size={15} /> Back
              </button>
              <button
                onClick={() => {
                  if (!form.firstName || !form.lastName || !form.email || !form.phone) {
                    toast.error('Please fill required fields'); return;
                  }
                  setStep(2);
                }}
                className="btn-primary flex-1 justify-center"
              >
                Continue <ArrowRight size={15} />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2 – Verify Email */}
        {step === 2 && (
          ticket && verifiedEmail === form.email ? (
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Email Verified</h1>
              <p className="text-gray-500 text-sm mb-8">{form.email} is verified. Continue to set your password.</p>
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 mb-6 flex items-center gap-3">
                <ShieldCheck size={18} className="text-emerald-500 shrink-0" />
                <p className="text-sm text-emerald-700 font-medium">{form.email}</p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setStep(1)} className="btn-outline flex items-center gap-2">
                  <ArrowLeft size={15} /> Back
                </button>
                <button onClick={() => setStep(3)} className="btn-primary flex-1 justify-center">
                  Continue <ArrowRight size={15} />
                </button>
              </div>
            </div>
          ) : (
            <div>
              <OtpVerifyStep
                email={form.email}
                purpose="CANDIDATE_REGISTRATION"
                onVerified={(t) => { setTicket(t); setVerifiedEmail(form.email); setStep(3); }}
              />
              <div className="flex gap-3 mt-6">
                <button onClick={() => setStep(1)} className="btn-outline flex items-center gap-2">
                  <ArrowLeft size={15} /> Back
                </button>
              </div>
            </div>
          )
        )}

        {/* STEP 3 – Password */}
        {step === 3 && (
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Create Your Password</h1>
            <p className="text-gray-500 text-sm mb-8">You'll use this to log into your candidate dashboard after approval.</p>

            <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
              <div>
                <label className="label">Password</label>
                <input type="password" className="input" value={form.password} onChange={e => setField('password', e.target.value)} placeholder="Minimum 8 characters" />
              </div>
              <div>
                <label className="label">Confirm Password</label>
                <input type="password" className="input" value={form.confirmPassword} onChange={e => setField('confirmPassword', e.target.value)} placeholder="Repeat password" />
              </div>
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700">
                <strong>Note:</strong> Your account will be activated once our team reviews your profile. You can log in after approval.
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setStep(2)} className="btn-outline flex items-center gap-2">
                <ArrowLeft size={15} /> Back
              </button>
              <button onClick={handleSubmit} disabled={submitting} className="btn-primary flex-1 justify-center disabled:opacity-60">
                {submitting ? (
                  <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Submitting…</>
                ) : (
                  <>Submit Application <ArrowRight size={15} /></>
                )}
              </button>
            </div>
          </div>
        )}

        {/* STEP 4 – Done */}
        {step === 4 && (
          <div className="text-center py-10">
            <div className="w-20 h-20 bg-emerald-50 border-2 border-emerald-200 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle size={40} className="text-emerald-500" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-3">Application Submitted!</h1>
            <p className="text-gray-500 text-sm max-w-sm mx-auto leading-relaxed mb-8">
              Your profile is now under review. We'll notify you once our team approves your candidature. This usually takes 1–2 business days.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/" className="btn-outline">Back to Homepage</Link>
              <Link href="/candidate/login" className="btn-primary">Go to Login</Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
