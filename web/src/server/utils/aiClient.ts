// Ported from api/src/utils/aiClient.js
/**
 * Central AI client for the OpenAI-powered assistant (public guidance bot +
 * role-scoped internal analyst).
 *
 * Configuration comes from the admin-managed "ai" SiteConfig row (Settings ->
 * AI Assistant in the admin UI) when present and enabled, falling back to the
 * OPENAI_API_KEY/OPENAI_MODEL env vars, falling back to "not configured" —
 * unlike mail, there is no dev-mode no-op transport for an LLM, so callers
 * must check `configured` and fail closed with a clear error.
 *
 * The resolved config (and the OpenAI client instance built from it) is
 * cached briefly so every chat turn doesn't hit the DB, and the cache is
 * explicitly invalidated whenever the settings are saved.
 */
import OpenAI from 'openai';
import { prisma } from '@/lib/prisma';

export const ALLOWED_MODELS = ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4.1-mini', 'gpt-3.5-turbo'];

/**
 * Providers that speak the OpenAI chat-completions protocol, so switching
 * between them needs only a name and a key rather than a remembered URL.
 * `AI_PROVIDER=gemini` is the free-tier option (Google AI Studio); an explicit
 * OPENAI_BASE_URL still wins, for anything not listed here.
 *
 * The Super Admin can pick one of these in Settings -> AI Assistant (stored as
 * `providerPreset`), and that choice wins over the env. Only these fixed
 * endpoints are offered there — a free-form URL stays env-only
 * (OPENAI_BASE_URL), since it changes who receives the data.
 */
export const PROVIDER_PRESETS: Record<string, { label: string; baseUrl: string; model: string; models: string[] }> = {
  openai:     { label: 'OpenAI',     baseUrl: '', model: 'gpt-4o-mini', models: ALLOWED_MODELS },
  // Model names are "vendor/model"; any model listed at openrouter.ai/models works.
  openrouter: { label: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', model: 'openai/gpt-4o-mini',
                models: ['openai/gpt-4o-mini', 'openai/gpt-4o', 'openai/gpt-4.1-mini'] },
  // gemini-2.5-flash is closed to new projects and gemini-flash-latest returns
  // 503 under load, so the preset names a specific current model. Verified
  // against the API: it accepts strict json_schema.
  gemini:     { label: 'Google Gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/', model: 'gemini-3.6-flash',
                models: ['gemini-3.6-flash'] },
  groq:       { label: 'Groq', baseUrl: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile',
                models: ['llama-3.3-70b-versatile'] },
};

const presetKey = (id?: string | null) => (id || '').trim().toLowerCase();

/**
 * Effective provider id: the admin's saved choice, else AI_PROVIDER, else OpenAI.
 * `stored` is the SiteConfig `providerPreset` (absent on rows saved before the
 * picker existed, which keeps those on the env provider).
 */
export function resolveProvider(stored?: string | null): string {
  if (PROVIDER_PRESETS[presetKey(stored)]) return presetKey(stored);
  if (PROVIDER_PRESETS[presetKey(process.env.AI_PROVIDER)]) return presetKey(process.env.AI_PROVIDER);
  return 'openai';
}

/**
 * Endpoint to talk to: the admin's saved preset, else an explicit
 * OPENAI_BASE_URL, else the AI_PROVIDER preset. Undefined = OpenAI's own.
 */
export function providerBaseUrl(stored?: string | null): string | undefined {
  const chosen = PROVIDER_PRESETS[presetKey(stored)];
  if (chosen) return chosen.baseUrl || undefined;
  return process.env.OPENAI_BASE_URL?.trim() || PROVIDER_PRESETS[resolveProvider()].baseUrl || undefined;
}

/** Model to use when nothing more specific is configured. OPENAI_MODEL only applies to the env provider. */
export function defaultModel(stored?: string | null): string {
  const envModel = !PROVIDER_PRESETS[presetKey(stored)] && process.env.OPENAI_MODEL?.trim();
  return envModel || PROVIDER_PRESETS[resolveProvider(stored)].model;
}

/** Read once at import for the admin settings UI; request paths use defaultModel(). */
export const DEFAULT_MODEL = defaultModel();

const DEFAULTS = {
  model: DEFAULT_MODEL,
  temperature: 0.3,
  maxTokens: 1000,
  enabled: false,
  publicEnabled: false,
  rateLimitPublicPerIpPerHour: 30,
  rateLimitAdminPerUserPerHour: 60,
  adminSystemPromptExtra: null as string | null,
};

export interface AiConfig {
  apiKey: string;
  /** OpenAI-compatible endpoint. Undefined = OpenAI's own. */
  baseUrl?: string;
  model: string;
  temperature: number;
  maxTokens: number;
  publicEnabled: boolean;
  rateLimitPublicPerIpPerHour: number;
  rateLimitAdminPerUserPerHour: number;
  adminSystemPromptExtra: string | null;
}

export interface AiClientResult {
  configured: boolean;
  client: OpenAI | null;
  model: string;
  temperature: number;
  maxTokens: number;
  publicEnabled: boolean;
  rateLimitPublicPerIpPerHour: number;
  rateLimitAdminPerUserPerHour: number;
  adminSystemPromptExtra: string | null;
  [key: string]: any;
}

const SETTINGS_CACHE_MS = 30_000;
let _settingsCache: any; // undefined = not loaded yet, null = loaded, no DB row
let _settingsCachedAt = 0;

let _client: OpenAI | null = null;
let _clientKey: string | null = null;

/** Read the admin-managed AI config (SiteConfig key "ai"), cached briefly. */
export async function loadAiSettings(): Promise<any> {
  if (_settingsCache !== undefined && Date.now() - _settingsCachedAt < SETTINGS_CACHE_MS) {
    return _settingsCache;
  }
  try {
    const row = await prisma.siteConfig.findUnique({ where: { key: 'ai' } });
    _settingsCache = row?.value || null;
  } catch (err: any) {
    console.error('[aiClient] failed to load AI settings from DB, falling back to env:', err.message);
    _settingsCache = null;
  }
  _settingsCachedAt = Date.now();
  return _settingsCache;
}

/** Call after the AI settings are saved so the next request picks them up immediately. */
export function invalidateAiSettingsCache() {
  _settingsCache = undefined;
  _settingsCachedAt = 0;
  _client = null;
  _clientKey = null;
}

/** DB settings (if enabled+configured) win; otherwise fall back to OPENAI_API_KEY env. */
export function resolveConfig(settings: any): AiConfig | null {
  if (settings && settings.enabled && settings.apiKey) {
    // A custom endpoint is env-only: it changes who receives the data, so the
    // admin UI can only choose between the fixed PROVIDER_PRESETS.
    const baseUrl = providerBaseUrl(settings.providerPreset);
    return {
      apiKey: settings.apiKey,
      baseUrl,
      // The model allowlist only applies to OpenAI itself — a compatible
      // provider has its own model names.
      model: baseUrl
        ? (settings.model || defaultModel(settings.providerPreset))
        : (ALLOWED_MODELS.includes(settings.model) ? settings.model : defaultModel(settings.providerPreset)),
      temperature: settings.temperature != null ? Number(settings.temperature) : DEFAULTS.temperature,
      maxTokens: settings.maxTokens != null ? Number(settings.maxTokens) : DEFAULTS.maxTokens,
      publicEnabled: !!settings.publicEnabled,
      rateLimitPublicPerIpPerHour: settings.rateLimitPublicPerIpPerHour || DEFAULTS.rateLimitPublicPerIpPerHour,
      rateLimitAdminPerUserPerHour: settings.rateLimitAdminPerUserPerHour || DEFAULTS.rateLimitAdminPerUserPerHour,
      adminSystemPromptExtra: settings.adminSystemPromptExtra || null,
    };
  }
  if (process.env.OPENAI_API_KEY) {
    return {
      apiKey: process.env.OPENAI_API_KEY,
      baseUrl: providerBaseUrl(),
      model: defaultModel(),
      temperature: DEFAULTS.temperature,
      maxTokens: DEFAULTS.maxTokens,
      publicEnabled: process.env.OPENAI_PUBLIC_ENABLED === 'true',
      rateLimitPublicPerIpPerHour: DEFAULTS.rateLimitPublicPerIpPerHour,
      rateLimitAdminPerUserPerHour: DEFAULTS.rateLimitAdminPerUserPerHour,
      adminSystemPromptExtra: null,
    };
  }
  return null;
}

/**
 * Resolve the current OpenAI client + effective settings (rebuilding the
 * client only when the resolved apiKey/model actually changed).
 */
export async function getClient(): Promise<AiClientResult> {
  const settings = await loadAiSettings();
  const config = resolveConfig(settings);

  if (!config) {
    return { configured: false, client: null, ...DEFAULTS };
  }

  const key = `${config.apiKey}:${config.model}:${config.baseUrl ?? ''}`;
  if (!_client || _clientKey !== key) {
    // baseURL undefined => the SDK's default (api.openai.com).
    _client = new OpenAI({ apiKey: config.apiKey, baseURL: config.baseUrl });
    _clientKey = key;
  }

  return { configured: true, client: _client, ...config };
}

/**
 * Readable message for a provider error. The SDK's own message is the raw
 * upstream body (e.g. `503 [{"error":{...}}]`), which is noise to an admin.
 */
export function describeAiError(err: any): string {
  const status: number | undefined = err?.status;
  let detail = '';
  const raw = err?.error ?? err?.message;
  try {
    const body = typeof raw === 'string' ? JSON.parse(raw.replace(/^\d{3}\s*/, '')) : raw;
    const e = Array.isArray(body) ? body[0]?.error : body?.error ?? body;
    detail = (e?.message || '').toString();
  } catch { /* not JSON */ }
  if (!detail) detail = String(err?.message || '').replace(/^\d{3}\s*/, '');
  detail = detail.slice(0, 200);

  if (status === 401 || status === 403) return `The API key was rejected by the provider${detail ? `: ${detail}` : ''}`;
  if (status === 402) return 'The provider account has no credits left. Add credits or choose a free model.';
  if (status === 404) return `The model was not found at this provider${detail ? `: ${detail}` : ''}`;
  if (status === 429) return 'Rate limit or quota reached at the provider. Wait a moment, or check the plan/credits.';
  if (status === 503 || status === 502 || status === 529) {
    return 'The model is temporarily overloaded at the provider. Try again shortly or pick a different model.';
  }
  return detail || 'Connection failed';
}
