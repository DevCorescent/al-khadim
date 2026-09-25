'use client';
import { useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { X, Mail, Lock, ArrowRight, ArrowLeft } from 'lucide-react';
import OtpVerifyStep from './OtpVerifyStep';

const API = process.env.NEXT_PUBLIC_API_URL || '';

type Purpose = 'CANDIDATE_PASSWORD_RESET' | 'COMPANY_PASSWORD_RESET';

interface Props {
  purpose: Purpose;
  /** e.g. '/api/candidate-auth/reset-password' */
  resetPath: string;
  onClose: () => void;
}

type Step = 'email' | 'otp' | 'password' | 'done';

export default function ForgotPasswordModal({ purpose, resetPath, onClose }: Props) {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [ticket, setTicket] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const normalizedEmail = email.trim().toLowerCase();

  async function handleReset() {
    if (password.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    if (password !== confirm) { toast.error('Passwords do not match'); return; }
    setSubmitting(true);
    try {
      await axios.post(`${API}${resetPath}`, { email: normalizedEmail, ticket, password });
      setStep('done');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Could not reset password');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-md w-full p-6 relative shadow-xl" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute right-4 top-4 text-gray-400 hover:text-gray-600" aria-label="Close">
          <X size={18} />
        </button>

        {step === 'email' && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-1">Reset your password</h2>
            <p className="text-sm text-gray-500 mb-6">Enter your account email — we'll send a verification code.</p>
            <div className="relative mb-4">
              <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && normalizedEmail) setStep('otp'); }}
                placeholder="you@example.com"
                className="input pl-10"
                autoFocus
              />
            </div>
            <button
              onClick={() => { if (!normalizedEmail) { toast.error('Enter your email'); return; } setStep('otp'); }}
              className="btn-primary w-full justify-center"
            >
              Send Code <ArrowRight size={15} />
            </button>
          </div>
        )}

        {step === 'otp' && (
          <div>
            <OtpVerifyStep
              email={normalizedEmail}
              purpose={purpose}
              onVerified={(t) => { setTicket(t); setStep('password'); }}
            />
            <button onClick={() => setStep('email')} className="mt-4 text-sm text-gray-400 hover:text-gray-600 flex items-center gap-1.5">
              <ArrowLeft size={13} /> Back
            </button>
          </div>
        )}

        {step === 'password' && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-1">Set a new password</h2>
            <p className="text-sm text-gray-500 mb-6">Choose a new password for {normalizedEmail}.</p>
            <div className="space-y-3">
              <div className="relative">
                <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="New password (min 8 characters)"
                  className="input pl-10"
                />
              </div>
              <div className="relative">
                <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleReset(); }}
                  placeholder="Confirm new password"
                  className="input pl-10"
                />
              </div>
            </div>
            <button onClick={handleReset} disabled={submitting} className="btn-primary w-full justify-center mt-5 disabled:opacity-60">
              {submitting ? (
                <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Updating…</>
              ) : (
                <>Update Password <ArrowRight size={15} /></>
              )}
            </button>
          </div>
        )}

        {step === 'done' && (
          <div className="text-center py-4">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Password updated</h2>
            <p className="text-sm text-gray-500 mb-6">You can now sign in with your new password.</p>
            <button onClick={onClose} className="btn-primary w-full justify-center">Back to Sign In</button>
          </div>
        )}
      </div>
    </div>
  );
}
