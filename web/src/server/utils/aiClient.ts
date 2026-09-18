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

export const DEFAULT_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
export const ALLOWED_MODELS = ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4.1-mini', 'gpt-3.5-turbo'];

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
      model: ALLOWED_MODELS.includes(settings.model) ? settings.model : DEFAULT_MODEL,
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
      model: DEFAULT_MODEL,
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

  const key = `${config.apiKey}:${config.model}`;
  if (!_client || _clientKey !== key) {
    _client = new OpenAI({ apiKey: config.apiKey });
    _clientKey = key;
  }

  return { configured: true, client: _client, ...config };
}
