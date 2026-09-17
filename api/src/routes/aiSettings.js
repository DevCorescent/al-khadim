/**
 * AI assistant settings — Super-Admin-only dynamic config for the OpenAI
 * integration (both the public widget and the internal assistant share this
 * one SiteConfig{key:'ai'} row). Stricter than email settings (SUPER_ADMIN
 * only, not ADMIN too) — an LLM API key is more sensitive, and per
 * `users.js` only SUPER_ADMIN can create users anyway.
 */
const router = require('express').Router();
const OpenAI = require('openai');
const { PrismaClient } = require('@prisma/client');
const { authenticate, authorize } = require('../middleware/auth');
const { invalidateAiSettingsCache, ALLOWED_MODELS, DEFAULT_MODEL } = require('../utils/aiClient');

const prisma = new PrismaClient();

const MAX_TOKENS_CAP = 4000;

function shapeSettings(row) {
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
router.get('/', authenticate, authorize('SUPER_ADMIN'), async (req, res) => {
  const row = await prisma.siteConfig.findUnique({ where: { key: 'ai' } });
  res.json(shapeSettings(row));
});

/* Save settings — merge semantics: a blank apiKey keeps the existing one */
router.put('/', authenticate, authorize('SUPER_ADMIN'), async (req, res) => {
  try {
    const {
      apiKey, model, temperature, maxTokens, enabled, publicEnabled,
      rateLimitPublicPerIpPerHour, rateLimitAdminPerUserPerHour, adminSystemPromptExtra,
    } = req.body;

    if (model !== undefined && model !== null && model !== '' && !ALLOWED_MODELS.includes(model)) {
      return res.status(400).json({ error: `Invalid model. Allowed: ${ALLOWED_MODELS.join(', ')}` });
    }
    if (temperature !== undefined && temperature !== null && temperature !== '') {
      const t = Number(temperature);
      if (Number.isNaN(t) || t < 0 || t > 2) return res.status(400).json({ error: 'temperature must be between 0 and 2' });
    }
    if (maxTokens !== undefined && maxTokens !== null && maxTokens !== '') {
      const mt = Number(maxTokens);
      if (!Number.isInteger(mt) || mt <= 0 || mt > MAX_TOKENS_CAP) {
        return res.status(400).json({ error: `maxTokens must be a positive integer up to ${MAX_TOKENS_CAP}` });
      }
    }

    const existing = await prisma.siteConfig.findUnique({ where: { key: 'ai' } });
    const prevApiKey = existing?.value?.apiKey || '';
    const mergedApiKey = apiKey ? apiKey : prevApiKey;

    if (enabled && !mergedApiKey) {
      return res.status(400).json({ error: 'An API key is required to enable the assistant' });
    }

    const value = {
      provider: 'openai',
      apiKey: mergedApiKey,
      model: model || existing?.value?.model || DEFAULT_MODEL,
      temperature: temperature !== undefined && temperature !== null && temperature !== ''
        ? Number(temperature) : (existing?.value?.temperature ?? 0.3),
      maxTokens: maxTokens !== undefined && maxTokens !== null && maxTokens !== ''
        ? Number(maxTokens) : (existing?.value?.maxTokens ?? 1000),
      enabled: enabled !== undefined ? !!enabled : !!existing?.value?.enabled,
      publicEnabled: publicEnabled !== undefined ? !!publicEnabled : !!existing?.value?.publicEnabled,
      rateLimitPublicPerIpPerHour: rateLimitPublicPerIpPerHour ? Number(rateLimitPublicPerIpPerHour) : (existing?.value?.rateLimitPublicPerIpPerHour || 30),
      rateLimitAdminPerUserPerHour: rateLimitAdminPerUserPerHour ? Number(rateLimitAdminPerUserPerHour) : (existing?.value?.rateLimitAdminPerUserPerHour || 60),
      adminSystemPromptExtra: adminSystemPromptExtra !== undefined ? (adminSystemPromptExtra || null) : (existing?.value?.adminSystemPromptExtra || null),
    };

    const row = await prisma.siteConfig.upsert({
      where: { key: 'ai' },
      create: { key: 'ai', value, updatedBy: req.user?.id },
      update: { value, updatedBy: req.user?.id },
    });
    invalidateAiSettingsCache();

    res.json(shapeSettings(row));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/* Test the AI connection — tests the saved config, or an unsaved draft if provided */
router.post('/test', authenticate, authorize('SUPER_ADMIN'), async (req, res) => {
  const { apiKey, model } = req.body || {};

  try {
    let effectiveKey = apiKey;
    let effectiveModel = model;

    if (!effectiveKey) {
      const existing = await prisma.siteConfig.findUnique({ where: { key: 'ai' } });
      effectiveKey = existing?.value?.apiKey || undefined;
      if (!effectiveModel) effectiveModel = existing?.value?.model || undefined;
    }
    if (!effectiveModel) effectiveModel = DEFAULT_MODEL;

    if (!effectiveKey) {
      return res.status(400).json({ error: 'No API key is saved yet — enter a key and test before saving.' });
    }

    const testClient = new OpenAI({ apiKey: effectiveKey });
    await testClient.chat.completions.create({
      model: effectiveModel,
      max_tokens: 5,
      messages: [{ role: 'user', content: 'Reply with OK' }],
    });

    res.json({ message: 'Connection successful', model: effectiveModel });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Connection failed' });
  }
});

module.exports = router;
