'use client';
import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { MailCheck, Loader2, RotateCw } from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:5001';

type Purpose = 'CANDIDATE_REGISTRATION' | 'COMPANY_REGISTRATION';

interface Props {
  email: string;
  purpose: Purpose;
  onVerified: (ticket: string) => void;
}

export default function OtpVerifyStep({ email, purpose, onVerified }: Props) {
  const [code, setCode] = useState('');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [sentOnce, setSentOnce] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);
  const sentForEmail = useRef<string | null>(null);

  async function send() {
    if (!email) return;
    sentForEmail.current = email;
    setSending(true);
    try {
      const { data } = await axios.post(`${API}/api/otp/send`, { email, purpose });
      setSentOnce(true);
      setCooldown(60);
      if (data.devCode) {
        // No SMTP configured on the server — the email was never actually delivered.
        // Surface the code directly instead of leaving the user stuck with no way to get it.
        setDevCode(data.devCode);
        setCode(data.devCode);
        toast.success('SMTP not configured — showing the code directly below', { duration: 6000 });
      } else {
        setDevCode(null);
        toast.success(`Verification code sent to ${email}`);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Could not send verification code');
    } finally {
      setSending(false);
    }
  }

  useEffect(() => {
    if (email && sentForEmail.current !== email) {
      send();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  async function verify() {
    if (code.length !== 6) { toast.error('Enter the 6-digit code'); return; }
    setVerifying(true);
    try {
      const { data } = await axios.post(`${API}/api/otp/verify`, { email, code, purpose });
      toast.success('Email verified');
      onVerified(data.ticket);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Verification failed');
    } finally {
      setVerifying(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Verify Your Email</h1>
      <p className="text-gray-500 text-sm mb-8">
        We've sent a 6-digit code to <strong>{email}</strong>. Enter it below to continue.
      </p>

      <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
        <div className="w-14 h-14 bg-primary-50 border-2 border-primary-100 rounded-2xl flex items-center justify-center mx-auto">
          <MailCheck size={26} className="text-primary-400" />
        </div>

        {devCode && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-center">
            <p className="text-xs font-bold text-amber-700 uppercase tracking-wide mb-1">Dev mode — SMTP not configured</p>
            <p className="text-sm text-amber-800">
              Your code is <span className="font-mono font-bold text-base">{devCode}</span> (pre-filled below). Configure SMTP in Admin Settings to email real codes.
            </p>
          </div>
        )}

        <input
          className="input text-center text-2xl font-bold tracking-[0.5em] py-3"
          value={code}
          maxLength={6}
          inputMode="numeric"
          placeholder="------"
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          onKeyDown={(e) => { if (e.key === 'Enter') verify(); }}
        />

        <button onClick={verify} disabled={verifying || code.length !== 6} className="btn-primary w-full justify-center disabled:opacity-60">
          {verifying ? (
            <><Loader2 size={15} className="animate-spin" /> Verifying…</>
          ) : (
            'Verify Code'
          )}
        </button>

        <div className="text-center">
          <button
            type="button"
            onClick={send}
            disabled={cooldown > 0 || sending}
            className="text-xs text-gray-400 hover:text-primary-500 disabled:hover:text-gray-400 disabled:opacity-60 inline-flex items-center gap-1.5"
          >
            <RotateCw size={11} className={sending ? 'animate-spin' : ''} />
            {cooldown > 0 ? `Resend code in ${cooldown}s` : sentOnce ? 'Resend code' : 'Send code'}
          </button>
        </div>
      </div>
    </div>
  );
}
