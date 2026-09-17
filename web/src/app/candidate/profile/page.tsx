'use client';
import { useState, useRef, useEffect } from 'react';
import { useCandidateAuth, candidateApi } from '@/lib/candidateAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Camera, Upload, Plus, X, Save, Eye, EyeOff, Lock, Loader2, PlayCircle, AlertCircle } from 'lucide-react';
import YouTubeEmbed from '@/components/YouTubeEmbed';
import { isValidYouTubeUrl } from '@/lib/youtube';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:5001';

export default function CandidateProfilePage() {
  const { candidate, accessToken, refreshProfile } = useCandidateAuth();
  const api = candidateApi(accessToken!);
  const qc = useQueryClient();
  const photoRef = useRef<HTMLInputElement>(null);
  const cvRef    = useRef<HTMLInputElement>(null);

  const { data: profile, isLoading } = useQuery({
    queryKey: ['candidate-me'],
    queryFn: () => api.get('/api/candidate-auth/me').then(r => r.data),
    enabled: !!accessToken,
  });

  const [form, setForm] = useState<any>({});
  const [skillInput, setSkillInput]   = useState('');
  const [langInput, setLangInput]     = useState('');
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile]     = useState<File | null>(null);
  const [cvFile, setCvFile]           = useState<File | null>(null);
  const [pwForm, setPwForm]           = useState({ current: '', next: '', confirm: '' });
  const [showPw, setShowPw]           = useState(false);

  useEffect(() => {
    if (profile) {
      setForm({
        firstName:       profile.firstName || '',
        lastName:        profile.lastName || '',
        phone:           profile.phone || '',
        nationality:     profile.nationality || '',
        currentLocation: profile.currentLocation || '',
        headline:        profile.headline || '',
        summary:         profile.summary || '',
        education:       profile.education || '',
        linkedIn:        profile.linkedIn || '',
        portfolio:       profile.portfolio || '',
        experience:      profile.experience ?? '',
        currentSalary:   profile.currentSalary ?? '',
        expectedSalary:  profile.expectedSalary ?? '',
        currency:        profile.currency || 'AED',
        visaStatus:      profile.visaStatus || '',
        skills:          profile.skills || [],
        languages:       profile.languages || [],
        introVideoUrl:   profile.introVideoUrl || '',
      });
    }
  }, [profile]);

  const set = (f: string, v: any) => setForm((p: any) => ({ ...p, [f]: v }));
  const addSkill = (s: string) => { const t = s.trim(); if (t && !form.skills?.includes(t)) set('skills', [...form.skills, t]); setSkillInput(''); };
  const removeSkill = (s: string) => set('skills', form.skills.filter((x: string) => x !== s));
  const addLang = (l: string) => { const t = l.trim(); if (t && !form.languages?.includes(t)) set('languages', [...form.languages, t]); setLangInput(''); };
  const removeLang = (l: string) => set('languages', form.languages.filter((x: string) => x !== l));

  const updateMutation = useMutation({
    mutationFn: async () => {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => {
        if (Array.isArray(v)) v.forEach(i => fd.append(k, i));
        else if (v !== '' && v !== null && v !== undefined) fd.append(k, String(v));
      });
      if (photoFile) fd.append('photo', photoFile);
      if (cvFile)    fd.append('cv', cvFile);
      return api.put('/api/candidate-auth/me', fd);
    },
    onSuccess: () => {
      toast.success('Profile updated successfully!');
      qc.invalidateQueries({ queryKey: ['candidate-me'] });
      refreshProfile();
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Update failed'),
  });

  const pwMutation = useMutation({
    mutationFn: () => api.put('/api/candidate-auth/change-password', {
      currentPassword: pwForm.current,
      newPassword: pwForm.next,
    }),
    onSuccess: () => {
      toast.success('Password changed!');
      setPwForm({ current: '', next: '', confirm: '' });
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed to change password'),
  });

  function handlePwSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pwForm.next !== pwForm.confirm) { toast.error('Passwords do not match'); return; }
    if (pwForm.next.length < 8) { toast.error('Minimum 8 characters'); return; }
    pwMutation.mutate();
  }

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 size={24} className="animate-spin text-gray-400" />
    </div>
  );

  const photoUrl = photoPreview
    || (profile?.photo ? `${API}/${profile.photo}` : null);

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-5">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">My Profile</h1>
          <p className="text-gray-500 text-sm mt-0.5">Keep your information up to date for better opportunities</p>
        </div>
        <button
          onClick={() => updateMutation.mutate()}
          disabled={updateMutation.isPending}
          className="btn-primary text-sm py-2.5 px-5 disabled:opacity-60"
        >
          {updateMutation.isPending ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : <><Save size={14} /> Save</>}
        </button>
      </div>

      {/* Photo */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 flex items-center gap-5">
        <div className="relative shrink-0">
          <div className="w-20 h-20 rounded-full overflow-hidden bg-primary-50 flex items-center justify-center border-2 border-primary-100">
            {photoUrl
              ? <img src={photoUrl} className="w-full h-full object-cover" alt="photo" />
              : <span className="text-primary-600 font-bold text-2xl">{form.firstName?.[0]}{form.lastName?.[0]}</span>
            }
          </div>
          <button
            onClick={() => photoRef.current?.click()}
            className="absolute -bottom-1 -right-1 w-7 h-7 bg-primary-400 hover:bg-primary-500 rounded-full flex items-center justify-center shadow-md transition-colors"
          >
            <Camera size={13} className="text-white" />
          </button>
          <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={e => {
            const f = e.target.files?.[0];
            if (f) { setPhotoFile(f); setPhotoPreview(URL.createObjectURL(f)); }
          }} />
        </div>
        <div>
          <p className="font-bold text-gray-900">{form.firstName} {form.lastName}</p>
          <p className="text-sm text-gray-500">{form.headline || 'Add your professional headline'}</p>
          <p className="text-xs text-gray-400 mt-0.5">{profile?.email}</p>
        </div>
      </div>

      {/* Personal */}
      <Section title="Personal Information">
        <Grid2>
          <Field label="First Name *"><input className="input" value={form.firstName} onChange={e => set('firstName', e.target.value)} /></Field>
          <Field label="Last Name *"><input className="input" value={form.lastName} onChange={e => set('lastName', e.target.value)} /></Field>
          <Field label="Phone"><input className="input" value={form.phone} onChange={e => set('phone', e.target.value)} /></Field>
          <Field label="Nationality"><input className="input" value={form.nationality} onChange={e => set('nationality', e.target.value)} placeholder="e.g. Indian" /></Field>
          <Field label="Current Location"><input className="input" value={form.currentLocation} onChange={e => set('currentLocation', e.target.value)} placeholder="e.g. Dubai, UAE" /></Field>
          <Field label="Visa Status"><input className="input" value={form.visaStatus} onChange={e => set('visaStatus', e.target.value)} placeholder="e.g. Visit Visa, Employment Visa" /></Field>
        </Grid2>
      </Section>

      {/* Professional */}
      <Section title="Professional Profile">
        <Field label="Professional Headline">
          <input className="input" value={form.headline} onChange={e => set('headline', e.target.value)} placeholder="e.g. Senior Software Engineer with 8+ years in UAE" />
        </Field>
        <Field label="Professional Summary">
          <textarea className="input h-28 resize-none" value={form.summary} onChange={e => set('summary', e.target.value)} placeholder="Brief overview of your career and expertise…" />
        </Field>
        <Grid2>
          <Field label="Years of Experience">
            <input className="input" type="number" min="0" value={form.experience} onChange={e => set('experience', e.target.value)} />
          </Field>
          <Field label="LinkedIn URL">
            <input className="input" value={form.linkedIn} onChange={e => set('linkedIn', e.target.value)} placeholder="https://linkedin.com/in/…" />
          </Field>
          <Field label="Portfolio / Website">
            <input className="input" value={form.portfolio} onChange={e => set('portfolio', e.target.value)} placeholder="https://…" />
          </Field>
        </Grid2>
        <Field label="Education">
          <textarea className="input h-20 resize-none" value={form.education} onChange={e => set('education', e.target.value)} placeholder="Degree, University, Year" />
        </Field>
      </Section>

      {/* Intro Video */}
      <Section title="Intro Video">
        <p className="text-xs text-gray-400 -mt-1 mb-1">
          Add a short (around 1 minute) YouTube video introducing yourself. It plays right here on your dashboard and when your profile is shared — no one is sent to YouTube.
        </p>
        <Field label="YouTube Video URL">
          <input className="input" value={form.introVideoUrl} onChange={e => set('introVideoUrl', e.target.value)}
            placeholder="https://youtube.com/watch?v=… or https://youtu.be/…" />
        </Field>
        {form.introVideoUrl && !isValidYouTubeUrl(form.introVideoUrl) && (
          <p className="text-xs text-red-500 flex items-center gap-1.5"><AlertCircle size={12} /> That doesn't look like a valid YouTube link</p>
        )}
        {form.introVideoUrl && isValidYouTubeUrl(form.introVideoUrl) && (
          <div className="max-w-sm">
            <YouTubeEmbed url={form.introVideoUrl} title="Intro video preview" />
          </div>
        )}
        {!form.introVideoUrl && (
          <div className="flex items-center gap-2 text-gray-400 text-xs bg-gray-50 rounded-lg px-3 py-2.5">
            <PlayCircle size={14} /> No intro video added yet
          </div>
        )}
      </Section>

      {/* Salary */}
      <Section title="Salary Expectations">
        <div className="grid grid-cols-3 gap-3">
          <Field label="Current Salary (AED/mo)">
            <input className="input" type="number" value={form.currentSalary} onChange={e => set('currentSalary', e.target.value)} placeholder="0" />
          </Field>
          <Field label="Expected Salary (AED/mo)">
            <input className="input" type="number" value={form.expectedSalary} onChange={e => set('expectedSalary', e.target.value)} placeholder="0" />
          </Field>
          <Field label="Currency">
            <select className="input" value={form.currency} onChange={e => set('currency', e.target.value)}>
              {['AED','USD','EUR','GBP','INR','PKR'].map(c => <option key={c}>{c}</option>)}
            </select>
          </Field>
        </div>
      </Section>

      {/* Skills */}
      <Section title="Skills">
        <div className="flex flex-wrap gap-2 mb-3">
          {form.skills?.map((s: string) => (
            <span key={s} className="flex items-center gap-1 bg-primary-50 border border-primary-100 text-primary-700 text-xs font-semibold px-2.5 py-1 rounded-full">
              {s} <button onClick={() => removeSkill(s)} className="hover:text-red-500"><X size={10} /></button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input className="input flex-1 text-sm" value={skillInput} onChange={e => setSkillInput(e.target.value)}
            placeholder="Add a skill and press Enter"
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSkill(skillInput); } }} />
          <button type="button" onClick={() => addSkill(skillInput)} className="btn-outline px-3 py-2 text-xs"><Plus size={14} /></button>
        </div>
      </Section>

      {/* Languages */}
      <Section title="Languages">
        <div className="flex flex-wrap gap-2 mb-3">
          {form.languages?.map((l: string) => (
            <span key={l} className="flex items-center gap-1 bg-gray-50 border border-gray-200 text-gray-700 text-xs font-semibold px-2.5 py-1 rounded-full">
              {l} <button onClick={() => removeLang(l)} className="hover:text-red-500"><X size={10} /></button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input className="input flex-1 text-sm" value={langInput} onChange={e => setLangInput(e.target.value)}
            placeholder="Add a language"
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addLang(langInput); } }} />
          <button type="button" onClick={() => addLang(langInput)} className="btn-outline px-3 py-2 text-xs"><Plus size={14} /></button>
        </div>
      </Section>

      {/* CV Upload */}
      <Section title="Resume / CV">
        {profile?.cvPath && (
          <div className="flex items-center gap-3 bg-blue-50 border border-blue-100 rounded-xl p-3 mb-3">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center shrink-0">
              <Upload size={14} className="text-blue-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-blue-800">Current CV uploaded</p>
              <p className="text-xs text-blue-500 truncate">{profile.cvPath.split('/').pop()}</p>
            </div>
          </div>
        )}
        <div
          className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center cursor-pointer hover:border-primary-400 hover:bg-primary-50/20 transition-all"
          onClick={() => cvRef.current?.click()}
        >
          <input ref={cvRef} type="file" accept=".pdf,.doc,.docx" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) setCvFile(f); }} />
          <Upload size={20} className="text-gray-400 mx-auto mb-2" />
          {cvFile
            ? <p className="text-sm font-semibold text-primary-600">{cvFile.name}</p>
            : <><p className="text-sm text-gray-500">Click to upload new CV</p><p className="text-xs text-gray-400 mt-1">PDF, DOC, DOCX</p></>
          }
        </div>
      </Section>

      {/* Change password */}
      <Section title="Change Password">
        <form onSubmit={handlePwSubmit} className="space-y-3">
          <Field label="Current Password">
            <div className="relative">
              <input type={showPw ? 'text' : 'password'} className="input pr-10" value={pwForm.current} onChange={e => setPwForm(p => ({ ...p, current: e.target.value }))} />
              <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"><EyeOff size={14} /></button>
            </div>
          </Field>
          <Grid2>
            <Field label="New Password">
              <input type="password" className="input" value={pwForm.next} onChange={e => setPwForm(p => ({ ...p, next: e.target.value }))} />
            </Field>
            <Field label="Confirm Password">
              <input type="password" className="input" value={pwForm.confirm} onChange={e => setPwForm(p => ({ ...p, confirm: e.target.value }))} />
            </Field>
          </Grid2>
          <button type="submit" disabled={pwMutation.isPending} className="btn-primary text-sm py-2.5 disabled:opacity-60">
            {pwMutation.isPending ? 'Updating…' : <><Lock size={13} /> Update Password</>}
          </button>
        </form>
      </Section>

      {/* Save button (bottom) */}
      <div className="pb-4">
        <button
          onClick={() => updateMutation.mutate()}
          disabled={updateMutation.isPending}
          className="w-full btn-primary text-sm py-3 justify-center rounded-xl disabled:opacity-60"
        >
          {updateMutation.isPending ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : <><Save size={14} /> Save All Changes</>}
        </button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5">
      <h3 className="text-sm font-bold text-gray-900 mb-4 pb-3 border-b border-gray-100">{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Grid2({ children }: { children: React.ReactNode }) {
  return <div className="grid sm:grid-cols-2 gap-3">{children}</div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}
