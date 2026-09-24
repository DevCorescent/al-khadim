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
 */
const PROVIDER_PRESETS: Record<string, { baseUrl: string; model: string }> = {
  openai: { baseUrl: '',                                                         model: 'gpt-4o-mini' },
  // gemini-2.5-flash is closed to new projects and gemini-flash-latest returns
  // 503 under load, so the preset names a specific current model. Verified
  // against the API: it accepts strict json_schema.
  gemini: { baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/', model: 'gemini-3.6-flash' },
  groq:   { baseUrl: 'https://api.groq.com/openai/v1',                           model: 'llama-3.3-70b-versatile' },
};

function preset() {
  return PROVIDER_PRESETS[(process.env.AI_PROVIDER || '').trim().toLowerCase()];
}

/** Endpoint to talk to. An explicit OPENAI_BASE_URL overrides the preset. */
export function providerBaseUrl(): string | undefined {
  return process.env.OPENAI_BASE_URL?.trim() || preset()?.baseUrl || undefined;
}

/** Model to use when nothing more specific is configured. */
export function defaultModel(): string {
  return process.env.OPENAI_MODEL?.trim() || preset()?.model || 'gpt-4o-mini';
}

/** Read once at import for the admin settings UI; request paths use defaultModel(). */
export const DEFAULT_MODEL = defaultModel();

const DEFAULTS = {
  provider: 'openai',
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
    return {
      apiKey: settings.apiKey,
      // A custom endpoint is env-only: it changes who receives the data, so it
      // is not something the admin UI can repoint.
      baseUrl: providerBaseUrl(),
      // The model allowlist only applies to OpenAI itself — a compatible
      // provider has its own model names.
      model: providerBaseUrl()
        ? (settings.model || defaultModel())
        : (ALLOWED_MODELS.includes(settings.model) ? settings.model : defaultModel()),
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
