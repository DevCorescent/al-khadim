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
import { body, handler, json } from '../http';
import { invalidateAiSettingsCache, ALLOWED_MODELS, DEFAULT_MODEL } from '../utils/aiClient';

const MAX_TOKENS_CAP = 4000;

function shapeSettings(row: any) {
  const v = row?.value || {};
  return {
    enabled: !!v.enabled,
    publicEnabled: !!v.publicEnabled,
    model: v.model || DEFAULT_MODEL,
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
      apiKey, model, temperature, maxTokens, enabled, publicEnabled,
      rateLimitPublicPerIpPerHour, rateLimitAdminPerUserPerHour, adminSystemPromptExtra,
    } = await body(req);

    if (model !== undefined && model !== null && model !== '' && !ALLOWED_MODELS.includes(model)) {
      return json({ error: `Invalid model. Allowed: ${ALLOWED_MODELS.join(', ')}` }, 400);
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

    const existing = await prisma.siteConfig.findUnique({ where: { key: 'ai' } });
    const prev: any = existing?.value || undefined;
    const prevApiKey = prev?.apiKey || '';
    const mergedApiKey = apiKey ? apiKey : prevApiKey;

    if (enabled && !mergedApiKey) {
      return json({ error: 'An API key is required to enable the assistant' }, 400);
    }

    const value = {
      provider: 'openai',
      apiKey: mergedApiKey,
      model: model || prev?.model || DEFAULT_MODEL,
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
    const { apiKey, model } = (await body(req)) || {};
    let effectiveKey = apiKey;
    let effectiveModel = model;

    if (!effectiveKey) {
      const existing = await prisma.siteConfig.findUnique({ where: { key: 'ai' } });
      const prev: any = existing?.value || undefined;
      effectiveKey = prev?.apiKey || undefined;
      if (!effectiveModel) effectiveModel = prev?.model || undefined;
    }
    if (!effectiveModel) effectiveModel = DEFAULT_MODEL;

    if (!effectiveKey) {
      return json({ error: 'No API key is saved yet — enter a key and test before saving.' }, 400);
    }

    const testClient = new OpenAI({ apiKey: effectiveKey });
    await testClient.chat.completions.create({
      model: effectiveModel,
      max_tokens: 5,
      messages: [{ role: 'user', content: 'Reply with OK' }],
    });

    return json({ message: 'Connection successful', model: effectiveModel });
  } catch (err: any) {
    return json({ error: err.message || 'Connection failed' }, 400);
  }
});
