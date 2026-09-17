'use client';
import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { Bot, Save, Zap, ShieldCheck, ShieldOff, Info } from 'lucide-react';

interface AiSettings {
  enabled: boolean;
  publicEnabled: boolean;
  model: string;
  temperature: number;
  maxTokens: number;
  hasApiKey: boolean;
  rateLimitPublicPerIpPerHour: number;
  rateLimitAdminPerUserPerHour: number;
  adminSystemPromptExtra: string;
  updatedAt: string | null;
  envConfigured: boolean;
  allowedModels: string[];
}

const INITIAL_FORM = {
  enabled: false, publicEnabled: false, apiKey: '', model: '',
  temperature: 0.3, maxTokens: 1000,
  rateLimitPublicPerIpPerHour: 30, rateLimitAdminPerUserPerHour: 60,
  adminSystemPromptExtra: '',
};

export default function AiSettingsPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState(INITIAL_FORM);

  const { data, isLoading } = useQuery<AiSettings>({
    queryKey: ['ai-settings'],
    queryFn: () => api.get('/ai-settings').then(r => r.data),
  });

  // Sync fetched settings into the editable form once loaded (API key stays blank — never returned by the API).
  useEffect(() => {
    if (!data) return;
    setForm(f => ({
      ...f,
      enabled: data.enabled, publicEnabled: data.publicEnabled,
      model: data.model, temperature: data.temperature, maxTokens: data.maxTokens,
      rateLimitPublicPerIpPerHour: data.rateLimitPublicPerIpPerHour,
      rateLimitAdminPerUserPerHour: data.rateLimitAdminPerUserPerHour,
      adminSystemPromptExtra: data.adminSystemPromptExtra,
      apiKey: '',
    }));
  }, [data?.updatedAt]);

  function setField<K extends keyof typeof form>(field: K, value: typeof form[K]) {
    setForm(f => ({ ...f, [field]: value }));
  }

  const save = useMutation({
    mutationFn: () => api.put('/ai-settings', form),
    onSuccess: () => {
      toast.success('AI settings saved');
      setForm(f => ({ ...f, apiKey: '' }));
      qc.invalidateQueries({ queryKey: ['ai-settings'] });
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed to save settings'),
  });

  const test = useMutation({
    mutationFn: () => api.post('/ai-settings/test', { apiKey: form.apiKey, model: form.model }),
    onSuccess: (r) => toast.success(r.data.message || 'Connection successful'),
    onError: (e: any) => toast.error(e.response?.data?.error || 'Connection failed'),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (form.enabled && !form.apiKey && !data?.hasApiKey) return toast.error('An API key is required to enable the assistant');
    save.mutate();
  }

  const live = !!data?.hasApiKey && !!data?.enabled;
  const usingEnv = !data?.hasApiKey && !!data?.envConfigured;

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-xl bg-primary-100 text-primary-600 flex items-center justify-center">
          <Bot size={18} />
        </div>
        <div>
          <h1 className="text-lg font-bold text-gray-900">AI Assistant Settings</h1>
          <p className="text-xs text-gray-400">Configure the OpenAI-powered internal assistant and public homepage widget</p>
        </div>
      </div>

      {/* Status banner */}
      <div className={`flex items-center gap-2.5 rounded-xl border px-4 py-3 text-xs ${
        live ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
        : usingEnv ? 'bg-amber-50 border-amber-100 text-amber-700'
        : 'bg-gray-50 border-gray-100 text-gray-500'
      }`}>
        {live ? <ShieldCheck size={15} /> : <Info size={15} />}
        {live
          ? <span>Live: the internal assistant is active.</span>
          : usingEnv
            ? <span>Falling back to the server&apos;s <code className="font-mono">OPENAI_API_KEY</code> environment variable.</span>
            : <span>Not configured — the assistant will return an error to users until a key is set.</span>}
      </div>

      <form onSubmit={submit} className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.enabled} onChange={e => setField('enabled', e.target.checked)}
                className="w-4 h-4 rounded accent-primary-500" />
              <span className="text-sm font-bold text-gray-800">Enable internal assistant</span>
            </label>
            <p className="text-[11px] text-gray-400 mt-1 ml-6">
              {form.enabled ? 'The assistant drawer is available to staff inside the admin panel.' : 'Disabled — the admin panel assistant drawer will not respond.'}
            </p>
          </div>
          {form.enabled ? <ShieldCheck size={16} className="text-emerald-500" /> : <ShieldOff size={16} className="text-gray-300" />}
        </div>

        <div className="flex items-center justify-between">
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.publicEnabled} onChange={e => setField('publicEnabled', e.target.checked)}
                className="w-4 h-4 rounded accent-primary-500" />
              <span className="text-sm font-bold text-gray-800">Enable public homepage assistant</span>
            </label>
            <p className="text-[11px] text-gray-400 mt-1 ml-6">
              Controls the floating widget shown to anonymous visitors on the public marketing site — independent of the toggle above, e.g. keep the staff assistant on while keeping the public widget off to control cost.
            </p>
          </div>
          {form.publicEnabled ? <ShieldCheck size={16} className="text-emerald-500" /> : <ShieldOff size={16} className="text-gray-300" />}
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="label">API Key {data?.hasApiKey && <span className="text-gray-400 font-normal">(leave blank to keep current)</span>}</label>
            <input className="input" type="password" value={form.apiKey} onChange={e => setField('apiKey', e.target.value)}
              placeholder={data?.hasApiKey ? '••••••••' : ''} autoComplete="new-password" />
          </div>
          <div>
            <label className="label">Model</label>
            <select className="input" value={form.model} onChange={e => setField('model', e.target.value)}>
              {(data?.allowedModels || []).map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Temperature</label>
            <input className="input" type="number" step="0.1" min="0" max="2" value={form.temperature}
              onChange={e => setField('temperature', Number(e.target.value))} />
          </div>
          <div>
            <label className="label">Max Tokens</label>
            <input className="input" type="number" min="1" value={form.maxTokens}
              onChange={e => setField('maxTokens', Number(e.target.value))} />
          </div>
          <div>
            <label className="label">Public visitor limit (messages/IP/hour)</label>
            <input className="input" type="number" min="1" value={form.rateLimitPublicPerIpPerHour}
              onChange={e => setField('rateLimitPublicPerIpPerHour', Number(e.target.value))} />
          </div>
          <div>
            <label className="label">Staff limit (messages/user/hour)</label>
            <input className="input" type="number" min="1" value={form.rateLimitAdminPerUserPerHour}
              onChange={e => setField('rateLimitAdminPerUserPerHour', Number(e.target.value))} />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Extra system prompt instructions <span className="text-gray-400 font-normal">(optional)</span></label>
            <textarea className="input min-h-[90px]" value={form.adminSystemPromptExtra}
              onChange={e => setField('adminSystemPromptExtra', e.target.value)}
              placeholder="e.g. Always mention the fiscal year runs April–March." />
            <p className="text-[11px] text-gray-400 mt-1">Appended to — not a replacement for — the base behavior and guardrails already built into the assistant.</p>
          </div>
        </div>

        <div className="flex justify-end pt-1">
          <button type="submit" disabled={save.isPending || isLoading}
            className="btn-primary text-sm py-2 px-5 flex items-center gap-2 disabled:opacity-60">
            <Save size={14} />{save.isPending ? 'Saving…' : 'Save Settings'}
          </button>
        </div>
      </form>

      {/* Test connection */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
        <h3 className="text-sm font-bold text-gray-900">Test Connection</h3>
        <p className="text-xs text-gray-400">
          Tests the form above as-is — even before saving — so you can confirm it works first. If the API key field is blank, this tests whatever is currently saved.
        </p>
        <button type="button" onClick={() => test.mutate()} disabled={test.isPending}
          className="btn-outline text-sm py-2 px-4 flex items-center justify-center gap-2 disabled:opacity-50 shrink-0">
          <Zap size={13} />{test.isPending ? 'Testing…' : 'Test Connection'}
        </button>
      </div>
    </div>
  );
}
