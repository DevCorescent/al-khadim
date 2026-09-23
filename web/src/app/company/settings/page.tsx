'use client';
/**
 * Company portal account settings.
 *
 * Exists mainly so a company user can rotate their own password: the endpoint
 * (PUT /api/client-auth/change-password) was implemented but had no UI, which
 * left invited teammates permanently on whatever password they first set.
 */
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Building2, Eye, EyeOff, KeyRound, Mail, ShieldCheck, User } from 'lucide-react';
import { useClientAuth, clientApi } from '@/lib/clientAuth';

export default function CompanySettingsPage() {
  const { accessToken, clientUser } = useClientAuth();
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext] = useState(false);

  const pwMutation = useMutation({
    mutationFn: () => clientApi(accessToken!).put('/api/client-auth/change-password', {
      currentPassword: form.current,
      newPassword: form.next,
    }),
    onSuccess: () => {
      toast.success('Password changed');
      setForm({ current: '', next: '', confirm: '' });
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed to change password'),
  });

  const mismatch = !!form.confirm && form.next !== form.confirm;
  const tooShort = !!form.next && form.next.length < 8;
  const canSubmit = !!form.current && !!form.next && !!form.confirm && !mismatch && !tooShort && !pwMutation.isPending;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (form.next !== form.confirm) { toast.error('Passwords do not match'); return; }
    if (form.next.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    pwMutation.mutate();
  }

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold text-gray-900 mb-5">Account Settings</h1>

      {/* Who you're signed in as */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-5">
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Your Account</h2>
        <dl className="space-y-3">
          <div className="flex items-center gap-3">
            <User size={14} className="text-gray-400 shrink-0" />
            <dt className="sr-only">Name</dt>
            <dd className="text-sm font-semibold text-gray-800">{clientUser?.name}</dd>
            <span className="text-[10px] font-bold bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
              {clientUser?.role === 'COMPANY_ADMIN' ? 'Admin' : 'Member'}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Mail size={14} className="text-gray-400 shrink-0" />
            <dt className="sr-only">Email</dt>
            <dd className="text-sm text-gray-600">{clientUser?.email}</dd>
          </div>
          <div className="flex items-center gap-3">
            <Building2 size={14} className="text-gray-400 shrink-0" />
            <dt className="sr-only">Company</dt>
            <dd className="text-sm text-gray-600">{clientUser?.client?.companyName}</dd>
          </div>
        </dl>
        <p className="text-[11px] text-gray-400 mt-4 pt-3 border-t border-gray-100">
          Your name, email and company details are maintained by Al Khadim. Contact them to change these.
        </p>
      </div>

      {/* Password */}
      <form onSubmit={submit} className="bg-white rounded-2xl border border-gray-200 p-5">
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-1.5">
          <KeyRound size={13} /> Change Password
        </h2>

        <div className="space-y-4">
          <div>
            <label className="label" htmlFor="current">Current Password</label>
            <div className="relative">
              <input
                id="current"
                type={showCurrent ? 'text' : 'password'}
                autoComplete="current-password"
                className="input pr-10"
                value={form.current}
                onChange={e => setForm(p => ({ ...p, current: e.target.value }))}
              />
              <button type="button" onClick={() => setShowCurrent(v => !v)}
                aria-label={showCurrent ? 'Hide password' : 'Show password'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showCurrent ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          <div>
            <label className="label" htmlFor="next">New Password</label>
            <div className="relative">
              <input
                id="next"
                type={showNext ? 'text' : 'password'}
                autoComplete="new-password"
                className="input pr-10"
                value={form.next}
                onChange={e => setForm(p => ({ ...p, next: e.target.value }))}
              />
              <button type="button" onClick={() => setShowNext(v => !v)}
                aria-label={showNext ? 'Hide password' : 'Show password'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showNext ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            <p className={`text-[11px] mt-1.5 ${tooShort ? 'text-red-500' : 'text-gray-400'}`}>
              At least 8 characters.
            </p>
          </div>

          <div>
            <label className="label" htmlFor="confirm">Confirm New Password</label>
            <input
              id="confirm"
              type="password"
              autoComplete="new-password"
              className="input"
              value={form.confirm}
              onChange={e => setForm(p => ({ ...p, confirm: e.target.value }))}
            />
            {mismatch && <p className="text-[11px] text-red-500 mt-1.5">Passwords do not match.</p>}
          </div>
        </div>

        <div className="flex items-center gap-3 mt-5">
          <button type="submit" disabled={!canSubmit} className="btn-primary text-sm py-2.5 disabled:opacity-50">
            {pwMutation.isPending ? 'Saving…' : 'Change Password'}
          </button>
          <p className="text-[11px] text-gray-400 flex items-center gap-1.5">
            <ShieldCheck size={12} /> Signs out your other devices.
          </p>
        </div>
      </form>
    </div>
  );
}
