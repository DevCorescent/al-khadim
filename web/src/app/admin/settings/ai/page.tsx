'use client';
import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { Bot, Save, Zap, ShieldCheck, ShieldOff, Info, Search, RefreshCw, Check, ExternalLink } from 'lucide-react';

interface ProviderOption { id: string; label: string; defaultModel: string; models: string[] }

interface AiSettings {
  enabled: boolean;
  publicEnabled: boolean;
  provider: string;
  providers: ProviderOption[];
  providerFromEnv: boolean;
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

interface ModelOption {
  id: string;
  name: string;
  contextLength?: number;
  promptPrice?: number;
  completionPrice?: number;
  tools?: boolean;
}

interface ModelList { provider: string; source: 'live' | 'preset'; note?: string; models: ModelOption[] }

/** Where each provider hands out API keys. */
const KEY_LINKS: Record<string, { url: string; hint: string }> = {
  openai:     { url: 'https://platform.openai.com/api-keys', hint: 'sk-…' },
  openrouter: { url: 'https://openrouter.ai/keys',           hint: 'sk-or-…' },
  gemini:     { url: 'https://aistudio.google.com/apikey',   hint: 'AIza…' },
  groq:       { url: 'https://console.groq.com/keys',        hint: 'gsk_…' },
};

const INITIAL_FORM = {
  enabled: false, publicEnabled: false, apiKey: '', provider: '', model: '',
  temperature: 0.3, maxTokens: 1000,
  rateLimitPublicPerIpPerHour: 30, rateLimitAdminPerUserPerHour: 60,
  adminSystemPromptExtra: '',
};

const INPUT = 'input py-2';

function price(v?: number) {
  if (v === undefined) return '—';
  if (v === 0) return 'Free';
  return `$${v < 1 ? v.toFixed(3) : v.toFixed(2)}`;
}

function ctx(n?: number) {
  if (!n) return '';
  return n >= 1_000_000 ? `${(n / 1_000_000).toFixed(n % 1_000_000 ? 1 : 0)}M` : `${Math.round(n / 1000)}K`;
}

export default function AiSettingsPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState(INITIAL_FORM);
  const [search, setSearch] = useState('');
  const [toolsOnly, setToolsOnly] = useState(true);
  const [freeOnly, setFreeOnly] = useState(false);

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
      provider: data.provider, model: data.model, temperature: data.temperature, maxTokens: data.maxTokens,
      rateLimitPublicPerIpPerHour: data.rateLimitPublicPerIpPerHour,
      rateLimitAdminPerUserPerHour: data.rateLimitAdminPerUserPerHour,
      adminSystemPromptExtra: data.adminSystemPromptExtra,
      apiKey: '',
    }));
  }, [data?.updatedAt]);

  const modelList = useQuery<ModelList>({
    queryKey: ['ai-models', form.provider],
    queryFn: () => api.get('/ai-settings/models', { params: { provider: form.provider } }).then(r => r.data),
    enabled: !!form.provider,
    staleTime: 10 * 60 * 1000,
  });

  function setField<K extends keyof typeof form>(field: K, value: typeof form[K]) {
    setForm(f => ({ ...f, [field]: value }));
  }

  const save = useMutation({
    mutationFn: () => api.put('/ai-settings', form),
    onSuccess: () => {
      toast.success('AI settings saved');
      setForm(f => ({ ...f, apiKey: '' }));
      qc.invalidateQueries({ queryKey: ['ai-settings'] });
      qc.invalidateQueries({ queryKey: ['ai-models'] });
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed to save settings'),
  });

  const test = useMutation({
    mutationFn: () => api.post('/ai-settings/test', { apiKey: form.apiKey, provider: form.provider, model: form.model }),
    onSuccess: (r) => toast.success(r.data.message || 'Connection successful'),
    onError: (e: any) => toast.error(e.response?.data?.error || 'Connection failed'),
  });

  const providerChanged = !!data && form.provider !== data.provider;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (form.enabled && !form.apiKey && !data?.hasApiKey) return toast.error('An API key is required to enable the assistant');
    if (form.enabled && providerChanged && !form.apiKey) return toast.error('Enter the API key for the new provider');
    save.mutate();
  }

  function changeProvider(id: string) {
    const next = data?.providers?.find(p => p.id === id);
    setSearch('');
    setForm(f => ({ ...f, provider: id, model: next?.defaultModel || f.model }));
  }

  const provider = data?.providers?.find(p => p.id === form.provider);
  const models = modelList.data?.models || [];
  const rich = models.some(m => m.promptPrice !== undefined); // OpenRouter-style catalogue with metadata
  const selected = models.find(m => m.id === form.model);
  const keyLink = KEY_LINKS[form.provider];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return models.filter(m =>
      (!rich || !toolsOnly || m.tools) &&
      (!rich || !freeOnly || (m.promptPrice === 0 && m.completionPrice === 0)) &&
      (!q || m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q)));
  }, [models, rich, search, toolsOnly, freeOnly]);

  const live = !!data?.hasApiKey && !!data?.enabled;
  const usingEnv = !data?.hasApiKey && !!data?.envConfigured;

  return (
    <form onSubmit={submit} className="w-full space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2.5 mr-auto">
          <div className="w-9 h-9 rounded-xl bg-primary-100 text-primary-600 flex items-center justify-center">
            <Bot size={18} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">AI Assistant Settings</h1>
            <p className="text-xs text-gray-400">Provider, model and limits for the internal assistant and public homepage widget</p>
          </div>
        </div>
        <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs ${
          live ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
          : usingEnv ? 'bg-amber-50 border-amber-100 text-amber-700'
          : 'bg-gray-50 border-gray-100 text-gray-500'
        }`}>
          {live ? <ShieldCheck size={14} /> : <Info size={14} />}
          {live
            ? <span>Live: the internal assistant is active.</span>
            : usingEnv
              ? <span>Using the server&apos;s <code className="font-mono">OPENAI_API_KEY</code> fallback.</span>
              : <span>Not configured: set a key to enable the assistant.</span>}
        </div>
        <button type="submit" disabled={save.isPending || isLoading}
          className="btn-primary text-sm py-2 px-5 flex items-center gap-2 disabled:opacity-60">
          <Save size={14} />{save.isPending ? 'Saving…' : 'Save Settings'}
        </button>
      </div>

      <div className="grid xl:grid-cols-3 gap-4 items-start">
        {/* Main column */}
        <div className="xl:col-span-2 space-y-4">
          <section className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
            <h2 className="text-sm font-bold text-gray-900">Provider &amp; Model</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="label">Provider</label>
                <select className={INPUT} value={form.provider} onChange={e => changeProvider(e.target.value)}>
                  {(data?.providers || []).map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
                {data?.providerFromEnv && !providerChanged && (
                  <p className="text-[11px] text-gray-400 mt-1">Currently taken from the server .env. Saving here makes it the setting.</p>
                )}
              </div>
              <div>
                <label className="label flex items-center justify-between">
                  <span>
                    {provider?.label || 'Provider'} API Key{' '}
                    {data?.hasApiKey && !providerChanged && <span className="text-gray-400 font-normal">(blank keeps current)</span>}
                  </span>
                  {keyLink && (
                    <a href={keyLink.url} target="_blank" rel="noreferrer"
                      className="text-[11px] font-semibold text-primary-500 hover:underline flex items-center gap-1">
                      Get a key <ExternalLink size={10} />
                    </a>
                  )}
                </label>
                <input className={INPUT} type="password" value={form.apiKey} onChange={e => setField('apiKey', e.target.value)}
                  placeholder={data?.hasApiKey && !providerChanged ? '••••••••' : keyLink?.hint || ''} autoComplete="new-password" />
                {providerChanged && (
                  <p className="text-[11px] text-amber-600 mt-1">Switching provider needs that provider&apos;s own API key.</p>
                )}
              </div>
            </div>

            {/* Model picker */}
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                <label className="text-sm font-semibold text-gray-700">
                  Model <span className="font-mono text-xs text-primary-600 ml-1">{form.model || '—'}</span>
                </label>
                <div className="flex items-center gap-3 text-[11px] text-gray-400">
                  {modelList.data && (
                    <span>{modelList.data.source === 'live' ? `${models.length} models available` : 'Suggested models'}</span>
                  )}
                  <button type="button" onClick={() => modelList.refetch()} disabled={modelList.isFetching}
                    className="flex items-center gap-1 font-semibold text-primary-500 hover:underline disabled:opacity-50">
                    <RefreshCw size={10} className={modelList.isFetching ? 'animate-spin' : ''} /> Refresh
                  </button>
                </div>
              </div>

              {rich ? (
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="flex flex-wrap items-center gap-3 p-2 border-b border-gray-100 bg-gray-50">
                    <div className="relative flex-1 min-w-[180px]">
                      <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search models, e.g. claude, gpt, llama"
                        className="w-full border border-gray-200 rounded-lg pl-8 pr-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-400/30" />
                    </div>
                    <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                      <input type="checkbox" checked={toolsOnly} onChange={e => setToolsOnly(e.target.checked)} className="accent-primary-500" />
                      Supports tools
                    </label>
                    <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                      <input type="checkbox" checked={freeOnly} onChange={e => setFreeOnly(e.target.checked)} className="accent-primary-500" />
                      Free only
                    </label>
                  </div>
                  <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 px-3 py-1.5 text-[10px] font-bold uppercase text-gray-400 border-b border-gray-100">
                    <span>Model</span><span className="w-14 text-right">Context</span><span className="w-28 text-right">In / Out per 1M</span>
                  </div>
                  <ul className="max-h-64 overflow-y-auto divide-y divide-gray-50">
                    {filtered.map(m => (
                      <li key={m.id}>
                        <button type="button" onClick={() => setField('model', m.id)}
                          className={`w-full grid grid-cols-[1fr_auto_auto] gap-x-4 items-center px-3 py-2 text-left text-xs hover:bg-primary-50 ${
                            m.id === form.model ? 'bg-primary-50' : ''}`}>
                          <span className="min-w-0">
                            <span className="flex items-center gap-1.5 font-semibold text-gray-800 truncate">
                              {m.id === form.model && <Check size={12} className="text-primary-500 shrink-0" />}
                              {m.name}
                            </span>
                            <span className="block font-mono text-[10px] text-gray-400 truncate">{m.id}</span>
                          </span>
                          <span className="w-14 text-right text-gray-500">{ctx(m.contextLength)}</span>
                          <span className="w-28 text-right text-gray-500">{price(m.promptPrice)} / {price(m.completionPrice)}</span>
                        </button>
                      </li>
                    ))}
                    {!filtered.length && (
                      <li className="px-3 py-4 text-xs text-gray-400 text-center">
                        No models match.
                        {search.trim() && (
                          <button type="button" onClick={() => setField('model', search.trim())}
                            className="ml-1 font-semibold text-primary-500 hover:underline">
                            Use &quot;{search.trim()}&quot; anyway
                          </button>
                        )}
                      </li>
                    )}
                  </ul>
                </div>
              ) : (
                <>
                  <input className={INPUT} list="ai-model-options" value={form.model} onChange={e => setField('model', e.target.value)}
                    placeholder={provider?.defaultModel} />
                  <datalist id="ai-model-options">
                    {models.map(m => <option key={m.id} value={m.id} />)}
                  </datalist>
                </>
              )}
              {modelList.data?.note && <p className="text-[11px] text-gray-400 mt-1">{modelList.data.note}</p>}
              {rich && form.model && !selected && !modelList.isFetching && (
                <p className="text-[11px] text-amber-600 mt-1">&quot;{form.model}&quot; is not in this provider&apos;s model list. Pick one above.</p>
              )}
            </div>
          </section>

          <section className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
            <h2 className="text-sm font-bold text-gray-900">Behaviour &amp; Limits</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="label">Temperature</label>
                <input className={INPUT} type="number" step="0.1" min="0" max="2" value={form.temperature}
                  onChange={e => setField('temperature', Number(e.target.value))} />
              </div>
              <div>
                <label className="label">Max Tokens</label>
                <input className={INPUT} type="number" min="1" max="4000" value={form.maxTokens}
                  onChange={e => setField('maxTokens', Number(e.target.value))} />
              </div>
              <div>
                <label className="label">Public limit <span className="text-gray-400 font-normal">/IP/hr</span></label>
                <input className={INPUT} type="number" min="1" value={form.rateLimitPublicPerIpPerHour}
                  onChange={e => setField('rateLimitPublicPerIpPerHour', Number(e.target.value))} />
              </div>
              <div>
                <label className="label">Staff limit <span className="text-gray-400 font-normal">/user/hr</span></label>
                <input className={INPUT} type="number" min="1" value={form.rateLimitAdminPerUserPerHour}
                  onChange={e => setField('rateLimitAdminPerUserPerHour', Number(e.target.value))} />
              </div>
            </div>
            <div>
              <label className="label">Extra system prompt instructions <span className="text-gray-400 font-normal">(optional)</span></label>
              <textarea className={`${INPUT} min-h-[70px]`} value={form.adminSystemPromptExtra}
                onChange={e => setField('adminSystemPromptExtra', e.target.value)}
                placeholder="e.g. Always mention the fiscal year runs April–March." />
              <p className="text-[11px] text-gray-400 mt-1">Added to the assistant&apos;s built-in behaviour and guardrails, not a replacement for them.</p>
            </div>
          </section>
        </div>

        {/* Side column */}
        <div className="space-y-4">
          <section className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
            <h2 className="text-sm font-bold text-gray-900">Availability</h2>
            {([
              ['enabled', 'Internal assistant', form.enabled ? 'Available to staff in the admin panel.' : 'Off: the admin assistant drawer will not respond.'],
              ['publicEnabled', 'Public homepage assistant', 'Floating widget for website visitors. Independent of the staff assistant, so you can keep it off to control cost.'],
            ] as const).map(([field, title, hint]) => (
              <div key={field} className="flex items-start justify-between gap-3">
                <label className="cursor-pointer">
                  <span className="flex items-center gap-2">
                    <input type="checkbox" checked={form[field]} onChange={e => setField(field, e.target.checked)}
                      className="w-4 h-4 rounded accent-primary-500" />
                    <span className="text-sm font-bold text-gray-800">{title}</span>
                  </span>
                  <span className="block text-[11px] text-gray-400 mt-1 ml-6">{hint}</span>
                </label>
                {form[field] ? <ShieldCheck size={16} className="text-emerald-500 shrink-0" /> : <ShieldOff size={16} className="text-gray-300 shrink-0" />}
              </div>
            ))}
          </section>

          {selected && rich && (
            <section className="bg-white rounded-2xl border border-gray-200 p-5 space-y-2">
              <h2 className="text-sm font-bold text-gray-900">Selected Model</h2>
              <p className="text-sm font-semibold text-gray-800">{selected.name}</p>
              <p className="font-mono text-[11px] text-gray-400 break-all">{selected.id}</p>
              <dl className="grid grid-cols-2 gap-2 pt-1 text-xs">
                <dt className="text-gray-400">Context</dt><dd className="text-gray-700 text-right">{ctx(selected.contextLength) || '—'}</dd>
                <dt className="text-gray-400">Input / 1M tokens</dt><dd className="text-gray-700 text-right">{price(selected.promptPrice)}</dd>
                <dt className="text-gray-400">Output / 1M tokens</dt><dd className="text-gray-700 text-right">{price(selected.completionPrice)}</dd>
                <dt className="text-gray-400">Tool calling</dt>
                <dd className={`text-right ${selected.tools ? 'text-emerald-600' : 'text-amber-600'}`}>{selected.tools ? 'Supported' : 'Not supported'}</dd>
              </dl>
              {!selected.tools && (
                <p className="text-[11px] text-amber-600">The internal assistant uses tools to look up data. Pick a tool-capable model for full answers.</p>
              )}
            </section>
          )}

          <section className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
            <h2 className="text-sm font-bold text-gray-900">Test Connection</h2>
            <p className="text-xs text-gray-400">
              Tests the provider, key and model above, even before saving. With the key field blank, it uses the saved key.
            </p>
            <button type="button" onClick={() => test.mutate()} disabled={test.isPending}
              className="btn-outline w-full text-sm py-2 px-4 flex items-center justify-center gap-2 disabled:opacity-50">
              <Zap size={13} />{test.isPending ? 'Testing…' : 'Test Connection'}
            </button>
          </section>
        </div>
      </div>
    </form>
  );
}
