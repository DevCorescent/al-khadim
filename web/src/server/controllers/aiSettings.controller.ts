// Ported from api/src/routes/aiSettings.js
/**
 * AI assistant settings — Super-Admin-only dynamic config for the OpenAI
 * integration (both the public widget and the internal assistant share this
 * one SiteConfig{key:'ai'} row). Stricter than email settings (SUPER_ADMIN
 * only, not ADMIN too) — an LLM API key is more sensitive, and per
 * `users.js` only SUPER_ADMIN can create users anyway.
 */
import OpenAI from 'openai';
import { prisma } from '@/lib/prisma';
import { requireStaff } from '../auth';
import { body, handler, json, query } from '../http';
import {
  invalidateAiSettingsCache, ALLOWED_MODELS, PROVIDER_PRESETS, defaultModel, describeAiError, providerBaseUrl, resolveProvider,
} from '../utils/aiClient';

const MAX_TOKENS_CAP = 4000;

function shapeSettings(row: any) {
  const v = row?.value || {};
  return {
    enabled: !!v.enabled,
    publicEnabled: !!v.publicEnabled,
    provider: resolveProvider(v.providerPreset),
    providers: Object.entries(PROVIDER_PRESETS).map(([id, p]) => ({ id, label: p.label, defaultModel: p.model, models: p.models })),
    // Until a provider is saved here, the server .env decides (AI_PROVIDER / OPENAI_BASE_URL).
    providerFromEnv: !PROVIDER_PRESETS[v.providerPreset],
    model: v.model || defaultModel(v.providerPreset),
    temperature: v.temperature != null ? v.temperature : 0.3,
    maxTokens: v.maxTokens != null ? v.maxTokens : 1000,
    hasApiKey: !!v.apiKey,
    rateLimitPublicPerIpPerHour: v.rateLimitPublicPerIpPerHour || 30,
    rateLimitAdminPerUserPerHour: v.rateLimitAdminPerUserPerHour || 60,
    adminSystemPromptExtra: v.adminSystemPromptExtra || '',
    updatedAt: row?.updatedAt || null,
    envConfigured: !!process.env.OPENAI_API_KEY,
    allowedModels: ALLOWED_MODELS,
  };
}

/* Get current settings — apiKey is NEVER returned, only whether one is set */
export const get = handler(async (req) => {
  await requireStaff(req, 'SUPER_ADMIN');
  const row = await prisma.siteConfig.findUnique({ where: { key: 'ai' } });
  return json(shapeSettings(row));
});

/* Save settings — merge semantics: a blank apiKey keeps the existing one */
export const update = handler(async (req) => {
  const user = await requireStaff(req, 'SUPER_ADMIN');
  try {
    const {
      apiKey, provider, model, temperature, maxTokens, enabled, publicEnabled,
      rateLimitPublicPerIpPerHour, rateLimitAdminPerUserPerHour, adminSystemPromptExtra,
    } = await body(req);

    if (provider !== undefined && provider !== null && provider !== '' && !PROVIDER_PRESETS[provider]) {
      return json({ error: `Invalid provider. Allowed: ${Object.keys(PROVIDER_PRESETS).join(', ')}` }, 400);
    }
    const existing = await prisma.siteConfig.findUnique({ where: { key: 'ai' } });
    const prev: any = existing?.value || undefined;
    const providerPreset: string | undefined = provider || prev?.providerPreset || undefined;

    // The allowlist names OpenAI's models. Against a compatible provider
    // (Gemini, Groq…) the model names are theirs and change often — pinning
    // them here is what leaves an admin unable to move off a decommissioned
    // model. So a provider's own name is accepted, while an OpenAI-shaped name
    // is still checked, which keeps typos like "gpt-99" out either way.
    if (model !== undefined && model !== null && model !== '' && !ALLOWED_MODELS.includes(model)) {
      const named = typeof model === 'string' && /^[\w.\-\/:]{1,80}$/.test(model);
      const looksOpenAi = named && /^(gpt|o[0-9])[\w.\-]*$/i.test(model);
      if (!named || looksOpenAi || !providerBaseUrl(providerPreset)) {
        return json({ error: `Invalid model. Allowed: ${ALLOWED_MODELS.join(', ')}` }, 400);
      }
    }
    if (temperature !== undefined && temperature !== null && temperature !== '') {
      const t = Number(temperature);
      if (Number.isNaN(t) || t < 0 || t > 2) return json({ error: 'temperature must be between 0 and 2' }, 400);
    }
    if (maxTokens !== undefined && maxTokens !== null && maxTokens !== '') {
      const mt = Number(maxTokens);
      if (!Number.isInteger(mt) || mt <= 0 || mt > MAX_TOKENS_CAP) {
        return json({ error: `maxTokens must be a positive integer up to ${MAX_TOKENS_CAP}` }, 400);
      }
    }

    for (const [field, v] of [
      ['rateLimitPublicPerIpPerHour', rateLimitPublicPerIpPerHour],
      ['rateLimitAdminPerUserPerHour', rateLimitAdminPerUserPerHour],
    ] as const) {
      if (v !== undefined && v !== null && v !== '') {
        const n = Number(v);
        if (!Number.isInteger(n) || n <= 0 || n > 100_000) {
          return json({ error: `${field} must be a positive integer` }, 400);
        }
      }
    }
    if (apiKey !== undefined && apiKey !== null && typeof apiKey !== 'string') {
      return json({ error: 'apiKey must be a string' }, 400);
    }
    if (adminSystemPromptExtra !== undefined && adminSystemPromptExtra !== null && typeof adminSystemPromptExtra !== 'string') {
      return json({ error: 'adminSystemPromptExtra must be a string' }, 400);
    }

    const prevApiKey = prev?.apiKey || '';
    const mergedApiKey = apiKey ? apiKey : prevApiKey;

    if (enabled && !mergedApiKey) {
      return json({ error: 'An API key is required to enable the assistant' }, 400);
    }

    const value = {
      ...(providerPreset && { providerPreset }),
      apiKey: mergedApiKey,
      // A provider switch without a model falls back to that provider's default.
      model: model || (provider && provider !== prev?.providerPreset ? defaultModel(provider) : prev?.model) || defaultModel(providerPreset),
      temperature: temperature !== undefined && temperature !== null && temperature !== ''
        ? Number(temperature) : (prev?.temperature ?? 0.3),
      maxTokens: maxTokens !== undefined && maxTokens !== null && maxTokens !== ''
        ? Number(maxTokens) : (prev?.maxTokens ?? 1000),
      enabled: enabled !== undefined ? !!enabled : !!prev?.enabled,
      publicEnabled: publicEnabled !== undefined ? !!publicEnabled : !!prev?.publicEnabled,
      rateLimitPublicPerIpPerHour: rateLimitPublicPerIpPerHour ? Number(rateLimitPublicPerIpPerHour) : (prev?.rateLimitPublicPerIpPerHour || 30),
      rateLimitAdminPerUserPerHour: rateLimitAdminPerUserPerHour ? Number(rateLimitAdminPerUserPerHour) : (prev?.rateLimitAdminPerUserPerHour || 60),
      adminSystemPromptExtra: adminSystemPromptExtra !== undefined ? (adminSystemPromptExtra || null) : (prev?.adminSystemPromptExtra || null),
    };

    const row = await prisma.siteConfig.upsert({
      where: { key: 'ai' },
      create: { key: 'ai', value, updatedBy: user?.id },
      update: { value, updatedBy: user?.id },
    });
    invalidateAiSettingsCache();

    return json(shapeSettings(row));
  } catch (err: any) {
    return json({ error: err.message }, 400);
  }
});

/* Test the AI connection — tests the saved config, or an unsaved draft if provided */
export const test = handler(async (req) => {
  await requireStaff(req, 'SUPER_ADMIN');
  try {
    const { apiKey, model, provider } = (await body(req)) || {};
    if (provider && !PROVIDER_PRESETS[provider]) {
      return json({ error: `Invalid provider. Allowed: ${Object.keys(PROVIDER_PRESETS).join(', ')}` }, 400);
    }
    const existing = await prisma.siteConfig.findUnique({ where: { key: 'ai' } });
    const prev: any = existing?.value || undefined;
    const effectiveProvider: string | undefined = provider || prev?.providerPreset || undefined;
    let effectiveKey = apiKey;
    let effectiveModel = model;

    if (!effectiveKey) {
      effectiveKey = prev?.apiKey || undefined;
      if (!effectiveModel) effectiveModel = prev?.model || undefined;
    }
    if (!effectiveModel) effectiveModel = defaultModel(effectiveProvider);

    if (!effectiveKey) {
      return json({ error: 'No API key is saved yet — enter a key and test before saving.' }, 400);
    }

    // Must hit the same endpoint the app will use, or a Gemini/Groq key gets
    // tested against api.openai.com and always reports "Connection failed".
    const testClient = new OpenAI({ apiKey: effectiveKey, baseURL: providerBaseUrl(effectiveProvider) });
    await testClient.chat.completions.create({
      model: effectiveModel,
      max_tokens: 5,
      messages: [{ role: 'user', content: 'Reply with OK' }],
    });

    return json({ message: 'Connection successful', model: effectiveModel });
  } catch (err: any) {
    return json({ error: describeAiError(err) }, 400);
  }
});

/* ─── GET /models?provider=  live model list for the picker ─────────────── */

export interface ModelOption {
  id: string;
  name: string;
  contextLength?: number;
  /** USD per 1M tokens. */
  promptPrice?: number;
  completionPrice?: number;
  /** Supports function/tool calling, which the internal assistant relies on. */
  tools?: boolean;
}

const MODEL_LIST_TTL_MS = 60 * 60 * 1000;
const MODEL_LIST_TIMEOUT_MS = 10_000;
const _modelCache = new Map<string, { at: number; models: ModelOption[] }>();

const perMillion = (v: any) => (v != null && v !== '' && !Number.isNaN(Number(v)) ? Number(v) * 1_000_000 : undefined);

/** OpenRouter publishes its catalogue without a key. */
async function openRouterModels(): Promise<ModelOption[]> {
  const res = await fetch(`${PROVIDER_PRESETS.openrouter.baseUrl}/models`, { signal: AbortSignal.timeout(MODEL_LIST_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`OpenRouter returned ${res.status}`);
  const { data } = await res.json();
  return (data || [])
    .filter((m: any) => (m.architecture?.output_modalities || ['text']).includes('text'))
    .map((m: any) => ({
      id: m.id,
      name: m.name || m.id,
      contextLength: m.context_length || undefined,
      promptPrice: perMillion(m.pricing?.prompt),
      completionPrice: perMillion(m.pricing?.completion),
      tools: (m.supported_parameters || []).includes('tools'),
    }))
    .sort((a: ModelOption, b: ModelOption) => a.name.localeCompare(b.name));
}

/** Other compatible providers list models with the account's key (the saved one, for the saved provider). */
async function keyedModels(provider: string, apiKey: string): Promise<ModelOption[]> {
  const client = new OpenAI({ apiKey, baseURL: PROVIDER_PRESETS[provider].baseUrl || undefined, timeout: MODEL_LIST_TIMEOUT_MS });
  const ids: string[] = [];
  for await (const m of client.models.list()) ids.push(String(m.id).replace(/^models\//, ''));
  return [...new Set(ids)].sort().map((id) => ({ id, name: id }));
}

export const models = handler(async (req) => {
  await requireStaff(req, 'SUPER_ADMIN');
  const provider = String(query(req).provider || '');
  const preset = PROVIDER_PRESETS[provider];
  if (!preset) return json({ error: `Invalid provider. Allowed: ${Object.keys(PROVIDER_PRESETS).join(', ')}` }, 400);

  const fallback = (note?: string) => json({
    provider, source: 'preset', note,
    models: preset.models.map((id) => ({ id, name: id })),
  });
  // OpenAI is pinned to the allowlist the save endpoint enforces.
  if (provider === 'openai') return fallback();

  const cached = _modelCache.get(provider);
  if (cached && Date.now() - cached.at < MODEL_LIST_TTL_MS) return json({ provider, source: 'live', models: cached.models });

  let list: ModelOption[];
  try {
    if (provider === 'openrouter') {
      list = await openRouterModels();
    } else {
      const row = await prisma.siteConfig.findUnique({ where: { key: 'ai' } });
      const v: any = row?.value || {};
      if (!v.apiKey || resolveProvider(v.providerPreset) !== provider) {
        return fallback('Save an API key for this provider to load its full model list.');
      }
      list = await keyedModels(provider, v.apiKey);
    }
  } catch (err: any) {
    return fallback(`Could not load the live model list: ${describeAiError(err)}`);
  }
  if (!list.length) return fallback();
  _modelCache.set(provider, { at: Date.now(), models: list });
  return json({ provider, source: 'live', models: list });
});
