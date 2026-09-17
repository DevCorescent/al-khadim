'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useClientAuth } from '@/lib/clientAuth';
import { Building2, ArrowRight, ArrowLeft, CheckCircle, ShieldCheck } from 'lucide-react';
import OtpVerifyStep from '@/components/OtpVerifyStep';
import { useIndustries } from '@/lib/taxonomy';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:5001';

const STEPS = ['Company Details', 'Verify Email', 'Set Password', 'Done'];

type FormState = {
  companyName: string; contactPerson: string; email: string; phone: string;
  industry: string; industryId: string; country: string; city: string; address: string; website: string;
  password: string; confirmPassword: string;
};

const INITIAL_FORM: FormState = {
  companyName: '', contactPerson: '', email: '', phone: '',
  industry: '', industryId: '', country: 'UAE', city: '', address: '', website: '',
  password: '', confirmPassword: '',
};

export default function CompanyRegisterPage() {
  const router = useRouter();
  const { setTokens } = useClientAuth();

  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [ticket, setTicket] = useState<string | null>(null);
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);
  const { data: industries } = useIndustries();

  function setField(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function validateDetails() {
    if (!form.companyName || !form.contactPerson || !form.email || !form.phone) {
      toast.error('Please fill all required fields'); return false;
    }
    return true;
  }

  async function handleSubmit() {
    if (form.password !== form.confirmPassword) { toast.error('Passwords do not match'); return; }
    if (form.password.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    if (!ticket || verifiedEmail !== form.email) {
      toast.error('Please verify your email first'); setStep(1); return;
    }
    setSubmitting(true);
    try {
      const { data } = await axios.post(`${API}/api/client-auth/register`, {
        ...form,
        emailVerificationTicket: ticket,
      });
      setTokens(data.accessToken, data.refreshToken, data.clientUser);
      setStep(3);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200 px-5 py-4 flex items-center gap-3">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary-400 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">A</span>
          </div>
          <span className="font-bold text-gray-900">Al Khadim</span>
        </Link>
        <span className="text-gray-300">›</span>
        <span className="text-sm text-gray-500">Business Profile Registration</span>
      </header>

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

        {/* STEP 0 – Company details */}
        {step === 0 && (
          <div>
            <div className="inline-flex items-center gap-2 bg-primary-50 border border-primary-100 rounded-full px-3 py-1 mb-4">
              <Building2 size={12} className="text-primary-500" />
              <span className="text-xs font-semibold text-primary-600">Business Profile</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Create Your Business Profile</h1>
            <p className="text-gray-500 text-sm mb-8">Tell us about your company. Al Khadim will review and approve your account before you get full dashboard access.</p>

            <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Company Name *</label>
                  <input className="input" value={form.companyName} onChange={(e) => setField('companyName', e.target.value)} placeholder="e.g. ADNOC Group" />
                </div>
                <div>
                  <label className="label">Contact Person *</label>
                  <input className="input" value={form.contactPerson} onChange={(e) => setField('contactPerson', e.target.value)} placeholder="Full name" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Business Email *</label>
                  <input className="input" type="email" value={form.email} onChange={(e) => setField('email', e.target.value)} placeholder="you@company.com" />
                </div>
                <div>
                  <label className="label">Phone *</label>
                  <input className="input" value={form.phone} onChange={(e) => setField('phone', e.target.value)} placeholder="+971 50 123 4567" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Industry</label>
                  <select className="input" value={form.industryId} onChange={(e) => {
                    const selected = (industries || []).find((i) => i.id === e.target.value);
                    setForm((prev) => ({ ...prev, industryId: e.target.value, industry: selected?.name || '' }));
                  }}>
                    <option value="">Select industry</option>
                    {(industries || []).map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Country</label>
                  <input className="input" value={form.country} onChange={(e) => setField('country', e.target.value)} placeholder="UAE" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">City</label>
                  <input className="input" value={form.city} onChange={(e) => setField('city', e.target.value)} placeholder="e.g. Dubai" />
                </div>
                <div>
                  <label className="label">Website</label>
                  <input className="input" value={form.website} onChange={(e) => setField('website', e.target.value)} placeholder="https://…" />
                </div>
              </div>
              <div>
                <label className="label">Address</label>
                <input className="input" value={form.address} onChange={(e) => setField('address', e.target.value)} placeholder="Street, area" />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => { if (validateDetails()) setStep(1); }} className="btn-primary flex-1 justify-center">
                Continue <ArrowRight size={15} />
              </button>
            </div>

            <p className="text-center text-sm text-gray-400 mt-6">
              Already have an account? <Link href="/company/login" className="text-primary-500 font-semibold hover:underline">Sign in</Link>
            </p>
          </div>
        )}

        {/* STEP 1 – Verify Email */}
        {step === 1 && (
          ticket && verifiedEmail === form.email ? (
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Email Verified</h1>
              <p className="text-gray-500 text-sm mb-8">{form.email} is verified. Continue to set your password.</p>
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 mb-6 flex items-center gap-3">
                <ShieldCheck size={18} className="text-emerald-500 shrink-0" />
                <p className="text-sm text-emerald-700 font-medium">{form.email}</p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setStep(0)} className="btn-outline flex items-center gap-2">
                  <ArrowLeft size={15} /> Back
                </button>
                <button onClick={() => setStep(2)} className="btn-primary flex-1 justify-center">
                  Continue <ArrowRight size={15} />
                </button>
              </div>
            </div>
          ) : (
            <div>
              <OtpVerifyStep
                email={form.email}
                purpose="COMPANY_REGISTRATION"
                onVerified={(t) => { setTicket(t); setVerifiedEmail(form.email); setStep(2); }}
              />
              <div className="flex gap-3 mt-6">
                <button onClick={() => setStep(0)} className="btn-outline flex items-center gap-2">
                  <ArrowLeft size={15} /> Back
                </button>
              </div>
            </div>
          )
        )}

        {/* STEP 2 – Password */}
        {step === 2 && (
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Set Your Password</h1>
            <p className="text-gray-500 text-sm mb-8">You'll use this to log into your company dashboard.</p>

            <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
              <div>
                <label className="label">Password</label>
                <input type="password" className="input" value={form.password} onChange={(e) => setField('password', e.target.value)} placeholder="Minimum 8 characters" />
              </div>
              <div>
                <label className="label">Confirm Password</label>
                <input type="password" className="input" value={form.confirmPassword} onChange={(e) => setField('confirmPassword', e.target.value)} placeholder="Repeat password" />
              </div>
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700">
                <strong>Note:</strong> Your business profile will be reviewed by Al Khadim before full dashboard access is unlocked. You can log in right away to check your status.
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setStep(1)} className="btn-outline flex items-center gap-2">
                <ArrowLeft size={15} /> Back
              </button>
              <button onClick={handleSubmit} disabled={submitting} className="btn-primary flex-1 justify-center disabled:opacity-60">
                {submitting ? (
                  <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Submitting…</>
                ) : (
                  <>Create Business Profile <ArrowRight size={15} /></>
                )}
              </button>
            </div>
          </div>
        )}

        {/* STEP 3 – Done */}
        {step === 3 && (
          <div className="text-center py-10">
            <div className="w-20 h-20 bg-emerald-50 border-2 border-emerald-200 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle size={40} className="text-emerald-500" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-3">Business Profile Created!</h1>
            <p className="text-gray-500 text-sm max-w-sm mx-auto leading-relaxed mb-8">
              Your company profile is now under review. We'll notify you by email once it's approved and your full dashboard is unlocked.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button onClick={() => router.push('/company/dashboard')} className="btn-primary">
                Go to Dashboard <ArrowRight size={15} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
