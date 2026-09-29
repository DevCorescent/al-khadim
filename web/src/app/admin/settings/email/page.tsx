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

/** One-click host/port for common providers. Credentials still come from the admin. */
const PRESETS = [
  { label: 'Gmail / Google Workspace', host: 'smtp.gmail.com',      port: 587, secure: false, note: 'Use an App Password (Google Account → Security → App passwords).' },
  { label: 'Outlook / Microsoft 365',  host: 'smtp.office365.com',  port: 587, secure: false, note: 'SMTP AUTH must be enabled for the mailbox in Microsoft 365 admin.' },
  { label: 'Zoho Mail',                host: 'smtp.zoho.com',       port: 465, secure: true,  note: 'Use smtp.zoho.in / smtp.zoho.eu if your account is in that region.' },
  { label: 'Hostinger',                host: 'smtp.hostinger.com',  port: 465, secure: true,  note: 'Username is the full mailbox address.' },
  { label: 'SendGrid',                 host: 'smtp.sendgrid.net',   port: 587, secure: false, note: 'Username is literally "apikey"; password is the SendGrid API key.' },
  { label: 'Amazon SES',               host: 'email-smtp.us-east-1.amazonaws.com', port: 587, secure: false, note: 'Change the region in the host to match your SES region; use SMTP credentials, not IAM keys.' },
];

const INPUT = 'input py-2';

export default function EmailSettingsPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState(INITIAL_FORM);
  const [testTo, setTestTo] = useState('');
  const [presetNote, setPresetNote] = useState('');

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

  function setPort(port: number) {
    // 465 is implicit TLS; 587/25 use STARTTLS. Keep the checkbox in step unless the admin overrides it after.
    setForm(f => ({ ...f, port, secure: port === 465 ? true : port === 587 || port === 25 ? false : f.secure }));
  }

  function applyPreset(label: string) {
    const p = PRESETS.find(x => x.label === label);
    if (!p) return;
    setForm(f => ({ ...f, host: p.host, port: p.port, secure: p.secure }));
    setPresetNote(p.note);
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
    <form onSubmit={submit} className="w-full space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2.5 mr-auto">
          <div className="w-9 h-9 rounded-xl bg-primary-100 text-primary-600 flex items-center justify-center">
            <Mail size={18} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Email / SMTP Settings</h1>
            <p className="text-xs text-gray-400">The mail server used by every email the platform sends</p>
          </div>
        </div>
        <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs ${
          usingDb ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
          : usingEnv ? 'bg-amber-50 border-amber-100 text-amber-700'
          : 'bg-gray-50 border-gray-100 text-gray-500'
        }`}>
          {usingDb ? <ShieldCheck size={14} /> : <Info size={14} />}
          {usingDb
            ? <span>Live: sending via {data?.host}</span>
            : usingEnv
              ? <span>Live: using the server&apos;s <code className="font-mono">SMTP_HOST</code> fallback</span>
              : <span>Not configured: emails are only logged to the server console</span>}
        </div>
        <button type="submit" disabled={save.isPending || isLoading}
          className="btn-primary text-sm py-2 px-5 flex items-center gap-2 disabled:opacity-60">
          <Save size={14} />{save.isPending ? 'Saving…' : 'Save Settings'}
        </button>
      </div>

      <div className="grid xl:grid-cols-3 gap-4 items-start">
        {/* Main column */}
        <section className="xl:col-span-2 bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <label className="cursor-pointer">
              <span className="flex items-center gap-2">
                <input type="checkbox" checked={form.enabled} onChange={e => setField('enabled', e.target.checked)}
                  className="w-4 h-4 rounded accent-primary-500" />
                <span className="text-sm font-bold text-gray-800">Enable custom SMTP</span>
              </span>
              <span className="block text-[11px] text-gray-400 mt-1 ml-6">
                {form.enabled ? 'Emails will be sent through the server below.' : 'Disabled: falls back to the environment default (or console logging in dev).'}
              </span>
            </label>
            {form.enabled ? <ShieldCheck size={16} className="text-emerald-500 shrink-0" /> : <ShieldOff size={16} className="text-gray-300 shrink-0" />}
          </div>

          <div>
            <label className="label">Quick setup</label>
            <select className={INPUT} value="" onChange={e => applyPreset(e.target.value)}>
              <option value="">Choose a provider to fill host &amp; port…</option>
              {PRESETS.map(p => <option key={p.label} value={p.label}>{p.label}</option>)}
            </select>
            {presetNote && <p className="text-[11px] text-primary-600 mt-1">{presetNote}</p>}
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="sm:col-span-2">
              <label className="label">SMTP Host *</label>
              <input className={INPUT} value={form.host} onChange={e => setField('host', e.target.value)} placeholder="smtp.gmail.com" />
            </div>
            <div>
              <label className="label">Port</label>
              <input className={INPUT} type="number" value={form.port} onChange={e => setPort(Number(e.target.value))} placeholder="587" />
            </div>
            <div className="flex items-end pb-2.5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.secure} onChange={e => setField('secure', e.target.checked)}
                  className="w-4 h-4 rounded accent-primary-500" />
                <span className="text-xs font-semibold text-gray-600">Use SSL/TLS (port 465)</span>
              </label>
            </div>
            <div className="sm:col-span-2">
              <label className="label">Username</label>
              <input className={INPUT} value={form.user} onChange={e => setField('user', e.target.value)} placeholder="user@example.com"
                autoComplete="off" />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Password / App key {data?.hasPassword && <span className="text-gray-400 font-normal">(blank keeps current)</span>}</label>
              <input className={INPUT} type="password" value={form.pass} onChange={e => setField('pass', e.target.value)}
                placeholder={data?.hasPassword ? '••••••••' : ''} autoComplete="new-password" />
            </div>
            <div className="sm:col-span-2 lg:col-span-4">
              <label className="label">From Domain</label>
              <input className={INPUT} value={form.fromDomain} onChange={e => setField('fromDomain', e.target.value)} placeholder="alkhadim.ae" />
              <p className="text-[11px] text-gray-400 mt-1">Each module has its own address at this domain (careers@, hr@…). See the Identities table on the Emails page.</p>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 p-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.restrictFromToAuthUser} onChange={e => setField('restrictFromToAuthUser', e.target.checked)}
                className="w-4 h-4 rounded accent-primary-500" />
              <span className="text-sm font-bold text-gray-800">Send only as the authenticated account (recommended)</span>
            </label>
            <p className="text-[11px] text-gray-400 mt-1 ml-6">
              Most providers reject mail &quot;From&quot; any address other than the mailbox you log in with (error <code className="font-mono">553 5.7.1</code>).
              When on, each module keeps its own display name and reply-to, but the technical From is always <strong>{form.user || 'your SMTP username'}</strong>.
              Turn off only if your provider allows verified aliases.
            </p>
          </div>
        </section>

        {/* Side column */}
        <div className="space-y-4">
          <section className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
            <h2 className="text-sm font-bold text-gray-900">Send a Test Email</h2>
            <p className="text-xs text-gray-400">
              Tests the form as it is, even before saving. With the host blank, it tests whatever is currently live.
            </p>
            <input className={INPUT} type="email" value={testTo} onChange={e => setTestTo(e.target.value)} placeholder="you@example.com" />
            <button type="button" onClick={() => testTo && test.mutate()} disabled={test.isPending || !testTo}
              className="btn-outline w-full text-sm py-2 px-4 flex items-center justify-center gap-2 disabled:opacity-50">
              <Send size={13} />{test.isPending ? 'Sending…' : 'Send Test'}
            </button>
          </section>

          <section className="bg-white rounded-2xl border border-gray-200 p-5 space-y-2 text-xs text-gray-500">
            <h2 className="text-sm font-bold text-gray-900">Tips</h2>
            <p><strong className="text-gray-700">Port 587</strong> with SSL/TLS off (STARTTLS) works for most providers. Use <strong className="text-gray-700">465</strong> with SSL/TLS on otherwise.</p>
            <p><strong className="text-gray-700">Gmail</strong> needs 2-Step Verification and an App Password; your normal password is rejected.</p>
            <p>The password is stored on the server and is never shown again after saving.</p>
          </section>
        </div>
      </div>
    </form>
  );
}
