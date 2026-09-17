'use client';
import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { Mail, Save, Send, ShieldCheck, ShieldOff, Info } from 'lucide-react';

interface SmtpSettings {
  enabled: boolean;
  host: string;
  port: number;
  secure: boolean;
  user: string;
  hasPassword: boolean;
  fromDomain: string;
  restrictFromToAuthUser: boolean;
  updatedAt: string | null;
  envConfigured: boolean;
}

const INITIAL_FORM = {
  enabled: false, host: '', port: 587, secure: false,
  user: '', pass: '', fromDomain: '', restrictFromToAuthUser: true,
};

export default function EmailSettingsPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState(INITIAL_FORM);
  const [testTo, setTestTo] = useState('');

  const { data, isLoading } = useQuery<SmtpSettings>({
    queryKey: ['smtp-settings'],
    queryFn: () => api.get('/emails/settings').then(r => r.data),
  });

  // Sync fetched settings into the editable form once loaded (password stays blank — never returned by the API).
  useEffect(() => {
    if (!data) return;
    setForm(f => ({
      ...f,
      enabled: data.enabled, host: data.host, port: data.port, secure: data.secure,
      user: data.user, fromDomain: data.fromDomain, pass: '',
      restrictFromToAuthUser: data.restrictFromToAuthUser,
    }));
  }, [data?.updatedAt]);

  function setField<K extends keyof typeof form>(field: K, value: typeof form[K]) {
    setForm(f => ({ ...f, [field]: value }));
  }

  const save = useMutation({
    mutationFn: () => api.put('/emails/settings', form),
    onSuccess: () => {
      toast.success('SMTP settings saved');
      setForm(f => ({ ...f, pass: '' }));
      qc.invalidateQueries({ queryKey: ['smtp-settings'] });
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed to save settings'),
  });

  const test = useMutation({
    mutationFn: () => api.post('/emails/settings/test', { to: testTo, ...form }),
    onSuccess: (r) => toast.success(r.data.message || 'Test email sent'),
    onError: (e: any) => toast.error(e.response?.data?.error || 'Test email failed'),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (form.enabled && !form.host) return toast.error('Host is required to enable SMTP');
    save.mutate();
  }

  const usingDb = !!data?.enabled && !!data?.host;
  const usingEnv = !usingDb && !!data?.envConfigured;

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-xl bg-primary-100 text-primary-600 flex items-center justify-center">
          <Mail size={18} />
        </div>
        <div>
          <h1 className="text-lg font-bold text-gray-900">Email / SMTP Settings</h1>
          <p className="text-xs text-gray-400">Configure the mail server used by every email the platform sends</p>
        </div>
      </div>

      {/* Active source banner */}
      <div className={`flex items-center gap-2.5 rounded-xl border px-4 py-3 text-xs ${
        usingDb ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
        : usingEnv ? 'bg-amber-50 border-amber-100 text-amber-700'
        : 'bg-gray-50 border-gray-100 text-gray-500'
      }`}>
        {usingDb ? <ShieldCheck size={15} /> : <Info size={15} />}
        {usingDb
          ? <span>Live: sending via the saved SMTP settings below ({data?.host}).</span>
          : usingEnv
            ? <span>Live: SMTP is not enabled here — falling back to the server&apos;s <code className="font-mono">SMTP_HOST</code> environment variable.</span>
            : <span>Live: no SMTP configured anywhere — outgoing emails are only logged to the server console, not delivered.</span>}
      </div>

      <form onSubmit={submit} className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.enabled} onChange={e => setField('enabled', e.target.checked)}
                className="w-4 h-4 rounded accent-primary-500" />
              <span className="text-sm font-bold text-gray-800">Enable custom SMTP</span>
            </label>
            <p className="text-[11px] text-gray-400 mt-1 ml-6">
              {form.enabled ? 'Emails will be sent through the server below.' : 'Disabled — falls back to the environment default (or console logging in dev).'}
            </p>
          </div>
          {form.enabled ? <ShieldCheck size={16} className="text-emerald-500" /> : <ShieldOff size={16} className="text-gray-300" />}
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="label">SMTP Host *</label>
            <input className="input" value={form.host} onChange={e => setField('host', e.target.value)} placeholder="smtp.gmail.com" />
          </div>
          <div>
            <label className="label">Port</label>
            <input className="input" type="number" value={form.port} onChange={e => setField('port', Number(e.target.value))} placeholder="587" />
          </div>
          <div className="flex items-end pb-2.5">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.secure} onChange={e => setField('secure', e.target.checked)}
                className="w-4 h-4 rounded accent-primary-500" />
              <span className="text-xs font-semibold text-gray-600">Use SSL/TLS (port 465)</span>
            </label>
          </div>
          <div>
            <label className="label">Username</label>
            <input className="input" value={form.user} onChange={e => setField('user', e.target.value)} placeholder="user@example.com" />
          </div>
          <div>
            <label className="label">Password {data?.hasPassword && <span className="text-gray-400 font-normal">(leave blank to keep current)</span>}</label>
            <input className="input" type="password" value={form.pass} onChange={e => setField('pass', e.target.value)}
              placeholder={data?.hasPassword ? '••••••••' : ''} autoComplete="new-password" />
          </div>
          <div className="sm:col-span-2">
            <label className="label">From Domain</label>
            <input className="input" value={form.fromDomain} onChange={e => setField('fromDomain', e.target.value)} placeholder="alkhadim.ae" />
            <p className="text-[11px] text-gray-400 mt-1">Each module has its own conceptual address at this domain (e.g. careers@…, hr@…) — see the Identities table on the Emails page. Whether mail actually sends "from" these addresses depends on the setting below.</p>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 p-4 flex items-start justify-between gap-4">
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.restrictFromToAuthUser} onChange={e => setField('restrictFromToAuthUser', e.target.checked)}
                className="w-4 h-4 rounded accent-primary-500" />
              <span className="text-sm font-bold text-gray-800">Send only as the authenticated account (recommended)</span>
            </label>
            <p className="text-[11px] text-gray-400 mt-1 ml-6 max-w-xl">
              Most SMTP providers — especially shared/business hosting — reject mail sent &quot;From&quot; any address other than the exact mailbox you log in with, bouncing with an error like <code className="font-mono">553 5.7.1 ... not owned by user</code>. When enabled, every module still shows its own name (e.g. &quot;Al Khadim Careers&quot;) and routes replies to its own address, but the technical From/envelope address is always <strong>{form.user || 'your SMTP username'}</strong>. Turn this off only if your provider explicitly allows sending as other addresses (e.g. verified domain aliases).
            </p>
          </div>
        </div>

        <div className="flex justify-end pt-1">
          <button type="submit" disabled={save.isPending || isLoading}
            className="btn-primary text-sm py-2 px-5 flex items-center gap-2 disabled:opacity-60">
            <Save size={14} />{save.isPending ? 'Saving…' : 'Save Settings'}
          </button>
        </div>
      </form>

      {/* Test send */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
        <h3 className="text-sm font-bold text-gray-900">Send a Test Email</h3>
        <p className="text-xs text-gray-400">
          Tests the form above as-is — even before saving — so you can confirm it works first. If the host field is blank, this tests whatever is currently live (saved settings or the env fallback).
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <input className="input flex-1" type="email" value={testTo} onChange={e => setTestTo(e.target.value)} placeholder="you@example.com" />
          <button type="button" onClick={() => testTo && test.mutate()} disabled={test.isPending || !testTo}
            className="btn-outline text-sm py-2 px-4 flex items-center justify-center gap-2 disabled:opacity-50 shrink-0">
            <Send size={13} />{test.isPending ? 'Sending…' : 'Send Test'}
          </button>
        </div>
      </div>
    </div>
  );
}
