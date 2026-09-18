import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { BASE_URL, TAG, adminAuth, api, expectStatus, staffWithRole } from './_client';
import { disconnectDb, prisma, siteConfig } from './_emailDb';

/**
 * AI assistant (staff), public widget and AI settings. The test server has no
 * OPENAI_API_KEY and no saved key, so chat must fail closed with 503. To
 * exercise the streaming path, one block temporarily saves a DUMMY key: the
 * upstream call then fails and the stream must end with an SSE `error` event.
 * The original "ai" SiteConfig row is restored exactly afterwards.
 */

/** POSTs and reads the whole (SSE or JSON) response body as text. */
async function postRaw(path: string, body: unknown, token?: string) {
  const res = await fetch(`${BASE_URL}/api${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  });
  return { status: res.status, type: res.headers.get('content-type') || '', text: await res.text() };
}

function sseEvents(text: string) {
  return text.split('\n\n').filter(Boolean).map((block) => {
    const event = /^event: (.*)$/m.exec(block)?.[1];
    const data = /^data: (.*)$/m.exec(block)?.[1];
    return { event, data: data ? JSON.parse(data) : undefined };
  });
}

describe('ai', () => {
  let token: string;
  let admin: Awaited<ReturnType<typeof staffWithRole>>;
  let recruiter: Awaited<ReturnType<typeof staffWithRole>>;
  let aiBefore: Awaited<ReturnType<typeof siteConfig>>;
  const sessionId = `session-${TAG}`;

  async function restoreAiSettings() {
    if (aiBefore) {
      await prisma.siteConfig.update({ where: { key: 'ai' }, data: { value: aiBefore.value as any, updatedBy: aiBefore.updatedBy } });
    } else {
      await prisma.siteConfig.deleteMany({ where: { key: 'ai' } });
    }
  }

  before(async () => {
    token = await adminAuth();
    admin = await staffWithRole('ADMIN');
    recruiter = await staffWithRole('RECRUITER');
    aiBefore = await siteConfig('ai');
  });

  after(async () => {
    // Disable via the API first so the server drops its cached (dummy) config,
    // then put the row back exactly as it was.
    await api('PUT', '/ai-settings', { enabled: false, publicEnabled: false }, { token }).catch(() => {});
    await restoreAiSettings();
    await prisma.chatConversation.deleteMany({
      where: { OR: [{ sessionId }, { userId: { in: [admin?.user?.id, recruiter?.user?.id].filter(Boolean) } }] },
    });
    await admin?.cleanup();
    await recruiter?.cleanup();
    await disconnectDb();
  });

  describe('auth', () => {
    test('staff endpoints require a token', async () => {
      expectStatus(await api('POST', '/ai-assistant/chat', { message: 'hi' }), 401);
      expectStatus(await api('GET', '/ai-assistant/conversations'), 401);
      expectStatus(await api('GET', '/ai-assistant/conversations/x'), 401);
      expectStatus(await api('DELETE', '/ai-assistant/conversations/x'), 401);
      expectStatus(await api('GET', '/ai-assistant/audit/conversations'), 401);
      expectStatus(await api('GET', '/ai-settings'), 401);
      expectStatus(await api('PUT', '/ai-settings', {}), 401);
      expectStatus(await api('POST', '/ai-settings/test', {}), 401);
    });

    test('audit and AI settings are SUPER_ADMIN only', async () => {
      for (const who of [admin, recruiter]) {
        const t = { token: who.token };
        expectStatus(await api('GET', '/ai-assistant/audit/conversations', undefined, t), 403);
        expectStatus(await api('GET', '/ai-settings', undefined, t), 403);
        expectStatus(await api('PUT', '/ai-settings', { adminSystemPromptExtra: 'x' }, t), 403);
        expectStatus(await api('POST', '/ai-settings/test', {}, t), 403);
      }
    });
  });

  describe('not configured (no API key)', () => {
    test('staff chat validates the message, then fails closed with 503', async () => {
      expectStatus(await api('POST', '/ai-assistant/chat', {}, { token: recruiter.token }), 400);
      expectStatus(await api('POST', '/ai-assistant/chat', { message: 42 }, { token: recruiter.token }), 400);
      const res = await api('POST', '/ai-assistant/chat', { message: 'How many candidates?' }, { token: recruiter.token });
      expectStatus(res, 503);
      assert.equal(res.data.error, 'AI assistant is not configured');
      assert.equal(await prisma.chatConversation.count({ where: { userId: recruiter.user.id } }), 0);
    });

    test('public chat validates input, then reports unavailable with 503', async () => {
      expectStatus(await api('POST', '/ai-public/chat', { message: 'hi' }), 400);
      expectStatus(await api('POST', '/ai-public/chat', { sessionId }), 400);
      expectStatus(await api('POST', '/ai-public/chat', { sessionId: { a: 1 }, message: 'hi' }), 400);
      const res = await api('POST', '/ai-public/chat', { sessionId, message: 'What jobs are open?' });
      expectStatus(res, 503);
      assert.equal(res.data.error, 'The assistant is currently unavailable');
    });
  });

  describe('ai-settings', () => {
    test('GET never returns the key', async () => {
      const res = await api('GET', '/ai-settings', undefined, { token });
      expectStatus(res, 200);
      assert.equal(res.data.apiKey, undefined);
      assert.equal(typeof res.data.hasApiKey, 'boolean');
      assert.ok(Array.isArray(res.data.allowedModels));
      assert.ok(res.data.rateLimitPublicPerIpPerHour > 0);
    });

    test('PUT validates input', async () => {
      const t = { token };
      expectStatus(await api('PUT', '/ai-settings', { model: 'gpt-99' }, t), 400);
      expectStatus(await api('PUT', '/ai-settings', { temperature: 5 }, t), 400);
      expectStatus(await api('PUT', '/ai-settings', { maxTokens: 999999 }, t), 400);
      expectStatus(await api('PUT', '/ai-settings', { rateLimitPublicPerIpPerHour: -3 }, t), 400);
      expectStatus(await api('PUT', '/ai-settings', { rateLimitAdminPerUserPerHour: 'lots' }, t), 400);
      expectStatus(await api('PUT', '/ai-settings', { adminSystemPromptExtra: { x: 1 } }, t), 400);
      if (!aiBefore || !(aiBefore.value as any)?.apiKey) {
        const res = await api('PUT', '/ai-settings', { enabled: true }, t);
        expectStatus(res, 400);
        assert.match(res.data.error, /API key is required/);
      }
    });

    test('PUT saves settings (restored afterwards)', async () => {
      const res = await api('PUT', '/ai-settings', {
        model: 'gpt-4o', temperature: 0.7, maxTokens: 500, rateLimitPublicPerIpPerHour: 12,
        rateLimitAdminPerUserPerHour: 34, adminSystemPromptExtra: `extra ${TAG}`,
      }, { token });
      expectStatus(res, 200);
      assert.equal(res.data.model, 'gpt-4o');
      assert.equal(res.data.temperature, 0.7);
      assert.equal(res.data.maxTokens, 500);
      assert.equal(res.data.rateLimitPublicPerIpPerHour, 12);
      assert.equal(res.data.rateLimitAdminPerUserPerHour, 34);
      assert.equal(res.data.adminSystemPromptExtra, `extra ${TAG}`);
      assert.equal(res.data.apiKey, undefined);
      await restoreAiSettings();
    });

    test('test endpoint without any key is a 400', async () => {
      if (aiBefore && (aiBefore.value as any)?.apiKey) return; // a real key is saved; don't call out with it
      const res = await api('POST', '/ai-settings/test', {}, { token });
      expectStatus(res, 400);
      assert.match(res.data.error, /No API key/);
    });

    test('test endpoint with a dummy key fails with 400, not a crash', async () => {
      const res = await api('POST', '/ai-settings/test', { apiKey: `sk-dummy-${TAG}`, model: 'gpt-4o-mini' }, { token });
      expectStatus(res, 400);
      assert.ok(res.data.error);
    });
  });

  describe('streaming with a dummy key (restored afterwards)', () => {
    let conversationId: string;

    before(async () => {
      const res = await api('PUT', '/ai-settings', {
        apiKey: `sk-dummy-${TAG}`, enabled: true, publicEnabled: true, rateLimitAdminPerUserPerHour: 2,
      }, { token });
      expectStatus(res, 200);
      assert.equal(res.data.enabled, true);
    });

    after(async () => {
      await api('PUT', '/ai-settings', { enabled: false, publicEnabled: false }, { token });
      await restoreAiSettings();
    });

    /** The settings cache is per server module instance (30s TTL); wait until chat sees the new config. */
    async function chatOnceConfigured(path: string, body: unknown, t?: string) {
      const deadline = Date.now() + 45_000;
      for (;;) {
        const res = await postRaw(path, body, t);
        if (res.status !== 503 || Date.now() > deadline) return res;
        await new Promise((r) => setTimeout(r, 2000));
      }
    }

    test('staff chat streams an SSE error event when the upstream call fails', async () => {
      const res = await chatOnceConfigured('/ai-assistant/chat', { message: `Hello ${TAG}` }, recruiter.token);
      assert.equal(res.status, 200, res.text);
      assert.match(res.type, /text\/event-stream/);
      const events = sseEvents(res.text);
      const last = events[events.length - 1];
      assert.equal(last.event, 'error');
      assert.deepEqual(last.data, { error: 'AI assistant error' });
    });

    test('conversations: list, get, and owner-only access', async () => {
      const list = await api('GET', '/ai-assistant/conversations?page=1&limit=5', undefined, { token: recruiter.token });
      expectStatus(list, 200);
      assert.equal(list.data.total, 1);
      assert.equal(list.data.limit, 5);
      conversationId = list.data.data[0].id;
      assert.equal(list.data.data[0].title, `Hello ${TAG}`);

      const junk = await api('GET', '/ai-assistant/conversations?page=x&limit=y', undefined, { token: recruiter.token });
      expectStatus(junk, 200);
      assert.equal(junk.data.page, 1);
      assert.equal(junk.data.limit, 30);

      const get = await api('GET', `/ai-assistant/conversations/${conversationId}`, undefined, { token: recruiter.token });
      expectStatus(get, 200);
      assert.equal(get.data.messages[0].role, 'USER');
      assert.equal(get.data.messages[0].content, `Hello ${TAG}`);

      expectStatus(await api('GET', `/ai-assistant/conversations/${conversationId}`, undefined, { token: admin.token }), 403);
      expectStatus(await api('DELETE', `/ai-assistant/conversations/${conversationId}`, undefined, { token: admin.token }), 403);
      expectStatus(await api('GET', '/ai-assistant/conversations/does-not-exist', undefined, { token: recruiter.token }), 403);

      // Another user can't continue someone else's conversation.
      const hijack = await api('POST', '/ai-assistant/chat', { conversationId, message: 'hi' }, { token: admin.token });
      expectStatus(hijack, 403);
    });

    test('audit lists staff conversations for SUPER_ADMIN, filterable by user', async () => {
      const res = await api('GET', `/ai-assistant/audit/conversations?userId=${recruiter.user.id}&limit=10`, undefined, { token });
      expectStatus(res, 200);
      assert.equal(res.data.total, 1);
      assert.equal(res.data.data[0].id, conversationId);
      assert.equal(res.data.data[0].user.email, recruiter.user.email);
      const junk = await api('GET', '/ai-assistant/audit/conversations?page=-2&limit=0', undefined, { token });
      expectStatus(junk, 200);
      assert.equal(junk.data.page, 1);
    });

    test('hourly limit is enforced and race-safe (limit 2, one already used)', async () => {
      const results = await Promise.all([1, 2, 3, 4].map((i) =>
        postRaw('/ai-assistant/chat', { conversationId, message: `burst ${i}` }, recruiter.token)));
      const statuses = results.map((r) => r.status);
      assert.ok(statuses.every((s) => s === 200 || s === 429), JSON.stringify(statuses));
      assert.ok(statuses.filter((s) => s === 200).length <= 1, JSON.stringify(statuses));
      const used = await prisma.chatMessage.count({ where: { role: 'USER', conversation: { userId: recruiter.user.id } } });
      assert.ok(used <= 2, `USER messages recorded: ${used}`);
      const more = await api('POST', '/ai-assistant/chat', { message: 'one more' }, { token: recruiter.token });
      expectStatus(more, 429);
      // A rejected new conversation leaves nothing behind.
      assert.equal(await prisma.chatConversation.count({ where: { userId: recruiter.user.id } }), 1);
    });

    test('deleting a conversation', async () => {
      expectStatus(await api('DELETE', `/ai-assistant/conversations/${conversationId}`, undefined, { token: recruiter.token }), 200);
      expectStatus(await api('GET', `/ai-assistant/conversations/${conversationId}`, undefined, { token: recruiter.token }), 403);
      expectStatus(await api('DELETE', `/ai-assistant/conversations/${conversationId}`, undefined, { token: recruiter.token }), 403);
    });

    test('public chat streams an SSE error event; conversations are session-bound', async () => {
      const res = await chatOnceConfigured('/ai-public/chat', { sessionId, message: 'What services do you offer?' });
      assert.equal(res.status, 200, res.text);
      const events = sseEvents(res.text);
      assert.equal(events[events.length - 1].event, 'error');

      const conv = await prisma.chatConversation.findFirst({ where: { sessionId } });
      assert.ok(conv);
      assert.equal(conv!.surface, 'PUBLIC');
      const other = await api('POST', '/ai-public/chat', { sessionId: `other-${TAG}`, conversationId: conv!.id, message: 'hi' });
      expectStatus(other, 403);
    });
  });
});
