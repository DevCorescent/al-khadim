'use client';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Calendar, Copy, ExternalLink, Eye, EyeOff, KeyRound, Lock, Timer } from 'lucide-react';
import { candidateApi, useCandidateAuth } from '@/lib/candidateAuth';

interface Cred {
  interviewId: string; jobTitle: string | null; companyName: string | null; scheduledAt: string;
  label: string | null; loginUrl: string | null; instructions: string | null;
  username: string; password: string; expiresAt: string;
}

function remaining(ms: number) {
  const m = Math.max(0, Math.floor(ms / 60_000));
  const d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), min = m % 60;
  return d ? `${d}d ${h}h` : h ? `${h}h ${min}m` : `${min}m`;
}

function copy(value: string, what: string) {
  navigator.clipboard?.writeText(value).then(() => toast.success(`${what} copied`)).catch(() => toast.error('Could not copy'));
}

function Row({ label, value, secret = false }: { label: string; value: string; secret?: boolean }) {
  const [show, setShow] = useState(!secret);
  return (
    <div className="flex items-center gap-2 py-2.5 border-t border-gray-100 first:border-0">
      <span className="text-xs text-gray-500 w-20 shrink-0">{label}</span>
      <span className="flex-1 min-w-0 font-mono text-sm font-semibold text-gray-900 truncate select-all">{show ? value : '•'.repeat(Math.min(12, value.length))}</span>
      {secret && (
        <button type="button" onClick={() => setShow(s => !s)} aria-label={show ? 'Hide' : 'Show'}
          className="grid place-items-center w-8 h-8 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700">{show ? <EyeOff size={14} /> : <Eye size={14} />}</button>
      )}
      <button type="button" onClick={() => copy(value, label)} aria-label={`Copy ${label.toLowerCase()}`}
        className="grid place-items-center w-8 h-8 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700"><Copy size={14} /></button>
    </div>
  );
}

/**
 * Login details for upcoming interviews, visible only to the signed-in
 * candidate. Each card disappears automatically when its details expire.
 */
export default function CandidateInterviewCredentials() {
  const { accessToken } = useCandidateAuth();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(t); }, []);

  const { data = [] } = useQuery({
    queryKey: ['candidate-interview-credentials'],
    queryFn: () => candidateApi(accessToken!).get('/api/candidate-auth/interview-credentials').then(r => r.data as Cred[]),
    enabled: !!accessToken,
    refetchInterval: 5 * 60_000,
    gcTime: 0,
  });

  const active = data.filter(c => new Date(c.expiresAt).getTime() > now);
  if (!active.length) return null;

  return (
    <div className="space-y-3">
      {active.map(c => {
        const left = new Date(c.expiresAt).getTime() - now;
        return (
          <div key={c.interviewId} className="bg-white rounded-2xl border border-primary-200 shadow-sm overflow-hidden">
            <div className="flex flex-wrap items-center gap-2 px-4 py-3 bg-primary-400 text-white">
              <KeyRound size={16} />
              <p className="text-sm font-bold flex-1 min-w-0 truncate">Interview login{c.label ? ` — ${c.label}` : ''}</p>
              <span className={`flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${left < 3 * 3_600_000 ? 'bg-amber-300 text-amber-950' : 'bg-white/15'}`}>
                <Timer size={11} /> Expires in {remaining(left)}
              </span>
            </div>
            <div className="px-4 pt-3 pb-4">
              {(c.jobTitle || c.scheduledAt) && (
                <p className="text-xs text-gray-500 flex flex-wrap items-center gap-x-3 gap-y-1 mb-2">
                  {c.jobTitle && <span className="font-semibold text-gray-800">{c.jobTitle}{c.companyName ? ` · ${c.companyName}` : ''}</span>}
                  <span className="flex items-center gap-1"><Calendar size={11} /> {new Date(c.scheduledAt).toLocaleString('en-AE', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                </p>
              )}
              <div className="rounded-xl border border-gray-200 px-3">
                <Row label="Username" value={c.username} />
                <Row label="Password" value={c.password} secret />
              </div>
              {c.loginUrl && (
                <a href={c.loginUrl} target="_blank" rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-white bg-primary-400 hover:bg-primary-500 px-4 py-2 rounded-xl">
                  Open login page <ExternalLink size={13} />
                </a>
              )}
              {c.instructions && <p className="text-xs text-gray-600 mt-3 whitespace-pre-line">{c.instructions}</p>}
              <p className="flex items-start gap-1.5 text-[11px] text-gray-400 mt-3">
                <Lock size={11} className="mt-0.5 shrink-0" />
                Only you can see these details. They disappear on {new Date(c.expiresAt).toLocaleString('en-AE', { dateStyle: 'medium', timeStyle: 'short' })}.
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
