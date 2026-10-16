'use client';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { KeyRound, Loader2, Lock, Mail, RefreshCw, ShieldOff } from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/lib/auth';
import CredentialFields, { draftToPayload, emptyCredentialDraft, type CredentialDraft } from './CredentialFields';

const fmt = (d?: string | null) => (d ? new Date(d).toLocaleString('en-AE', { dateStyle: 'medium', timeStyle: 'short' }) : '');
const STATE: Record<string, { label: string; cls: string }> = {
  active: { label: 'Active', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  expired: { label: 'Expired', cls: 'bg-gray-100 text-gray-500 border-gray-200' },
  revoked: { label: 'Revoked', cls: 'bg-red-50 text-red-600 border-red-200' },
};

/**
 * Status of an interview's login credentials, with set / replace / revoke /
 * re-send for staff allowed to manage them. The username and password are
 * never shown here — only the candidate can see them.
 */
export default function InterviewCredentialsPanel({ interviewId, interviewAt, compact = false }: {
  interviewId: string; interviewAt?: string | null; compact?: boolean;
}) {
  const qc = useQueryClient();
  const canManage = useAuth(s => s.can('interview_credentials', 'manage'));
  const key = ['interview-credentials', interviewId];
  const { data, isLoading } = useQuery({
    queryKey: key,
    queryFn: () => api.get(`/interviews/${interviewId}/credentials`).then(r => r.data.credential as any),
  });
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<CredentialDraft>(() => emptyCredentialDraft(interviewAt));
  const [sendEmail, setSendEmail] = useState(true);
  const onError = (e: any) => toast.error(e.response?.data?.error || 'Something went wrong');

  const save = useMutation({
    mutationFn: () => api.put(`/interviews/${interviewId}/credentials`, { ...draftToPayload(draft), sendEmail }),
    onSuccess: (r) => {
      qc.setQueryData(key, r.data.credential);
      setEditing(false);
      setDraft(emptyCredentialDraft(interviewAt));
      if (r.data.emailError) toast.error(`Saved, but the email failed: ${r.data.emailError}`);
      else toast.success(r.data.emailed ? 'Saved and emailed to the candidate' : 'Saved — visible in the candidate dashboard');
    },
    onError,
  });
  const revoke = useMutation({
    mutationFn: () => api.delete(`/interviews/${interviewId}/credentials`),
    onSuccess: (r) => { qc.setQueryData(key, r.data.credential); toast.success('Revoked — removed from the candidate dashboard'); },
    onError,
  });
  const resend = useMutation({
    mutationFn: () => api.post(`/interviews/${interviewId}/credentials/resend`),
    onSuccess: (r) => { qc.setQueryData(key, r.data.credential); toast.success('Login details emailed to the candidate'); },
    onError,
  });

  if (isLoading) return <div className="text-xs text-gray-400 flex items-center gap-2"><Loader2 size={13} className="animate-spin" /> Loading…</div>;
  const c = data;
  const state = c ? STATE[c.state] : null;

  return (
    <div className={compact ? '' : 'bg-white border border-gray-200 rounded-2xl p-4'}>
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <KeyRound size={15} className="text-primary-500" />
        <p className="text-sm font-bold text-gray-900">Interview login for the candidate</p>
        {state && <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${state.cls}`}>{state.label}</span>}
      </div>

      {c ? (
        <div className="text-xs text-gray-600 space-y-1 mb-3">
          {c.label && <p><span className="text-gray-400">For:</span> {c.label}</p>}
          {c.loginUrl && <p className="truncate"><span className="text-gray-400">Login page:</span> {c.loginUrl}</p>}
          <p className="flex items-center gap-1.5 text-gray-500"><Lock size={11} /> Username and password are visible only to the candidate.</p>
          <p><span className="text-gray-400">{c.state === 'active' ? 'Expires' : c.state === 'revoked' ? 'Revoked' : 'Expired'}:</span> {fmt(c.state === 'revoked' ? c.revokedAt : c.expiresAt)}</p>
          <p><span className="text-gray-400">Emailed:</span> {c.emailedAt ? fmt(c.emailedAt) : 'Not yet'}{' · '}
            <span className="text-gray-400">Seen by candidate:</span> {c.viewedAt ? fmt(c.viewedAt) : 'Not yet'}</p>
        </div>
      ) : (
        <p className="text-xs text-gray-500 mb-3">No login details have been given to the candidate for this interview.</p>
      )}

      {canManage ? (
        editing ? (
          <div className="space-y-3 border-t border-gray-100 pt-3">
            <CredentialFields value={draft} onChange={setDraft} interviewAt={interviewAt} />
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" checked={sendEmail} onChange={e => setSendEmail(e.target.checked)} className="accent-primary-500" />
              Email these details to the candidate
            </label>
            <div className="flex gap-2">
              <button type="button" onClick={() => setEditing(false)} className="px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-600">Cancel</button>
              <button type="button" onClick={() => save.mutate()} disabled={save.isPending || !draft.username || !draft.password}
                className="flex-1 btn-primary justify-center text-sm py-2 rounded-xl disabled:opacity-50">
                {save.isPending ? 'Saving…' : c ? 'Replace login details' : 'Save login details'}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setEditing(true)}
              className="flex items-center gap-1.5 text-xs font-bold text-white bg-primary-400 hover:bg-primary-500 px-3 py-2 rounded-xl">
              <KeyRound size={13} /> {c ? 'Replace' : 'Add login details'}
            </button>
            {c?.state === 'active' && (
              <>
                <button type="button" onClick={() => resend.mutate()} disabled={resend.isPending}
                  className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 border border-gray-200 px-3 py-2 rounded-xl hover:bg-gray-50 disabled:opacity-50">
                  {resend.isPending ? <RefreshCw size={13} className="animate-spin" /> : <Mail size={13} />} Email again
                </button>
                <button type="button" onClick={() => { if (confirm('Revoke these login details? They will disappear from the candidate dashboard immediately.')) revoke.mutate(); }}
                  disabled={revoke.isPending}
                  className="flex items-center gap-1.5 text-xs font-semibold text-red-600 border border-red-200 px-3 py-2 rounded-xl hover:bg-red-50 disabled:opacity-50">
                  <ShieldOff size={13} /> Revoke
                </button>
              </>
            )}
          </div>
        )
      ) : (
        <p className="text-[11px] text-gray-400">Only the Super Admin, or a role given “Interview credentials”, can add or change these.</p>
      )}
    </div>
  );
}
