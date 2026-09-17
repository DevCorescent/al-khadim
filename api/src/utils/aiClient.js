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
const OpenAI = require('openai');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const DEFAULT_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const ALLOWED_MODELS = ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4.1-mini', 'gpt-3.5-turbo'];

const DEFAULTS = {
  provider: 'openai',
  model: DEFAULT_MODEL,
  temperature: 0.3,
  maxTokens: 1000,
  enabled: false,
  publicEnabled: false,
  rateLimitPublicPerIpPerHour: 30,
  rateLimitAdminPerUserPerHour: 60,
  adminSystemPromptExtra: null,
};

const SETTINGS_CACHE_MS = 30_000;
let _settingsCache; // undefined = not loaded yet, null = loaded, no DB row
let _settingsCachedAt = 0;

/** Read the admin-managed AI config (SiteConfig key "ai"), cached briefly. */
async function loadAiSettings() {
  if (_settingsCache !== undefined && Date.now() - _settingsCachedAt < SETTINGS_CACHE_MS) {
    return _settingsCache;
  }
  try {
    const row = await prisma.siteConfig.findUnique({ where: { key: 'ai' } });
    _settingsCache = row?.value || null;
  } catch (err) {
    console.error('[aiClient] failed to load AI settings from DB, falling back to env:', err.message);
    _settingsCache = null;
  }
  _settingsCachedAt = Date.now();
  return _settingsCache;
}

/** Call after the AI settings are saved so the next request picks them up immediately. */
function invalidateAiSettingsCache() {
  _settingsCache = undefined;
  _settingsCachedAt = 0;
  _client = null;
  _clientKey = null;
}

/** DB settings (if enabled+configured) win; otherwise fall back to OPENAI_API_KEY env. */
function resolveConfig(settings) {
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

let _client;
let _clientKey;

/**
 * Resolve the current OpenAI client + effective settings (rebuilding the
 * client only when the resolved apiKey/model actually changed).
 * @returns {Promise<{configured:boolean, client:OpenAI|null, model:string,
 *   temperature:number, maxTokens:number, publicEnabled:boolean,
 *   rateLimitPublicPerIpPerHour:number, rateLimitAdminPerUserPerHour:number,
 *   adminSystemPromptExtra:string|null}>}
 */
async function getClient() {
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

module.exports = {
  getClient, loadAiSettings, invalidateAiSettingsCache, resolveConfig,
  ALLOWED_MODELS, DEFAULT_MODEL,
};
