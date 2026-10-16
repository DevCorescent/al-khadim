'use client';
import { useState } from 'react';
import { Eye, EyeOff, Wand2 } from 'lucide-react';

export interface CredentialDraft {
  label: string; loginUrl: string; username: string; password: string; instructions: string; expiresAt: string;
}

const pad = (n: number) => String(n).padStart(2, '0');
export function toLocalInput(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Default: one day after the interview (or after now, if no time is known yet). */
export function emptyCredentialDraft(interviewAt?: string | Date | null): CredentialDraft {
  const base = interviewAt ? new Date(interviewAt) : new Date();
  const valid = isNaN(base.getTime()) ? new Date() : base;
  return { label: '', loginUrl: '', username: '', password: '', instructions: '', expiresAt: toLocalInput(new Date(valid.getTime() + 86_400_000)) };
}

export function draftToPayload(d: CredentialDraft) {
  return { ...d, expiresAt: new Date(d.expiresAt).toISOString() };
}

/** A strong password without look-alike characters. */
function generatePassword(len = 12) {
  const sets = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnpqrstuvwxyz', '23456789', '@#$%&*?!'];
  const all = sets.join('');
  const rand = (n: number) => {
    const a = new Uint32Array(1);
    crypto.getRandomValues(a);
    return a[0] % n;
  };
  const chars = sets.map(s => s[rand(s.length)]);
  while (chars.length < len) chars.push(all[rand(all.length)]);
  for (let i = chars.length - 1; i > 0; i--) { const j = rand(i + 1); [chars[i], chars[j]] = [chars[j], chars[i]]; }
  return chars.join('');
}

const input = 'input text-sm';

export default function CredentialFields({ value, onChange, interviewAt }: {
  value: CredentialDraft; onChange: (v: CredentialDraft) => void; interviewAt?: string | Date | null;
}) {
  const [show, setShow] = useState(false);
  const set = (k: keyof CredentialDraft, v: string) => onChange({ ...value, [k]: v });
  const base = interviewAt && !isNaN(new Date(interviewAt).getTime()) ? new Date(interviewAt) : new Date();
  const presets: [string, number][] = [['+3 hours', 3], ['+1 day', 24], ['+3 days', 72], ['+7 days', 168]];

  return (
    <div className="space-y-3">
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1.5">What is this login for?</label>
          <input className={input} value={value.label} onChange={e => set('label', e.target.value)} maxLength={120} placeholder="e.g. Online assessment portal" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1.5">Login page (optional)</label>
          <input className={input} value={value.loginUrl} onChange={e => set('loginUrl', e.target.value)} placeholder="https://…" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1.5">Username *</label>
          <input className={`${input} font-mono`} value={value.username} onChange={e => set('username', e.target.value)} autoComplete="off" spellCheck={false} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1.5">Password *</label>
          <div className="flex gap-1.5">
            <div className="relative flex-1">
              <input className={`${input} font-mono pr-9`} type={show ? 'text' : 'password'} value={value.password}
                onChange={e => set('password', e.target.value)} autoComplete="new-password" spellCheck={false} />
              <button type="button" onClick={() => setShow(s => !s)} aria-label={show ? 'Hide password' : 'Show password'}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700">{show ? <EyeOff size={15} /> : <Eye size={15} />}</button>
            </div>
            <button type="button" title="Generate a strong password" onClick={() => { set('password', generatePassword()); setShow(true); }}
              className="shrink-0 grid place-items-center w-10 rounded-xl border border-gray-200 text-gray-500 hover:text-primary-600 hover:border-primary-300"><Wand2 size={15} /></button>
          </div>
        </div>
      </div>
      <div>
        <label className="block text-xs font-semibold text-gray-700 mb-1.5">Instructions for the candidate (optional)</label>
        <textarea className="input w-full h-16 resize-none text-sm" value={value.instructions} onChange={e => set('instructions', e.target.value)} maxLength={1000}
          placeholder="e.g. Log in 10 minutes early and complete the system check." />
      </div>
      <div>
        <label className="block text-xs font-semibold text-gray-700 mb-1.5">Expires *</label>
        <div className="flex flex-wrap items-center gap-2">
          <input type="datetime-local" className={`${input} w-auto`} value={value.expiresAt} onChange={e => set('expiresAt', e.target.value)} />
          {presets.map(([label, h]) => (
            <button key={label} type="button" onClick={() => set('expiresAt', toLocalInput(new Date(base.getTime() + h * 3_600_000)))}
              className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:border-primary-300 hover:text-primary-600">
              {label}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-gray-400 mt-1">Counted from the interview time. After this, the details disappear from the candidate’s dashboard and are deleted.</p>
      </div>
    </div>
  );
}
