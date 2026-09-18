// Ported from api/src/routes/emails.js
import nodemailer from 'nodemailer';
import { prisma } from '@/lib/prisma';
import { requireStaff } from '../auth';
import { requirePermission } from '../permissions';
import { body, handler, json, query } from '../http';
import { pagination, toDate } from '../validate';
import {
  sendMail, listIdentities, IDENTITIES, ENV_DOMAIN,
  getTransport, invalidateSmtpSettingsCache,
} from '../utils/mailer';
import { processDue } from '../scheduler/emailScheduler';

const SCHEDULED_STATUSES = ['PENDING', 'SENT', 'FAILED', 'CANCELLED'];

/** Subjects are a single header line — collapse any CR/LF a client sent. */
function oneLine(s: string): string {
  return s.replace(/[\r\n]+/g, ' ');
}

function optionalString(v: unknown): string | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  return typeof v === 'string' ? v : String(v);
}

/* Module -> sender-identity map (for the admin UI dropdowns) */
export const identities = handler(async (req) => {
  await requireStaff(req);
  const { domain } = await getTransport();
  return json(listIdentities(domain));
});

/* ── SMTP settings: admin-managed mail server config (SiteConfig key "smtp") ── */

/* Get current settings — password is NEVER returned, only whether one is set */
export const getSettings = handler(async (req) => {
  await requirePermission(req, 'settings', 'edit');
  const row = await prisma.siteConfig.findUnique({ where: { key: 'smtp' } });
  const v: any = row?.value || {};
  return json({
    enabled: !!v.enabled,
    host: v.host || '',
    port: v.port || 587,
    secure: !!v.secure,
    user: v.user || '',
    hasPassword: !!v.pass,
    fromDomain: v.fromDomain || '',
    // Default on — most providers (esp. shared/business hosting) reject a
    // From address other than the exact authenticated mailbox.
    restrictFromToAuthUser: v.restrictFromToAuthUser !== false,
    updatedAt: row?.updatedAt || null,
    envConfigured: !!process.env.SMTP_HOST,
  });
});

/* Save settings — merge semantics: a blank password keeps the existing one */
export const saveSettings = handler(async (req) => {
  const currentUser = await requirePermission(req, 'settings', 'edit');
  try {
    const { enabled, host, port, secure, user, pass, fromDomain, restrictFromToAuthUser } = await body(req);
    if (enabled && !host) return json({ error: 'Host is required to enable SMTP' }, 400);
    if (port && (!Number.isInteger(Number(port)) || Number(port) < 1 || Number(port) > 65535)) {
      return json({ error: 'port must be a number between 1 and 65535' }, 400);
    }
    for (const [k, v] of Object.entries({ host, user, pass, fromDomain })) {
      if (v !== undefined && v !== null && typeof v !== 'string') return json({ error: `${k} must be a string` }, 400);
    }

    const existing = await prisma.siteConfig.findUnique({ where: { key: 'smtp' } });
    const prevPass = (existing?.value as any)?.pass || '';
    const value = {
      enabled: !!enabled,
      host: (host || '').trim(),
      port: port ? Number(port) : 587,
      secure: !!secure,
      user: (user || '').trim(),
      pass: pass ? pass : prevPass,
      fromDomain: (fromDomain || '').trim(),
      restrictFromToAuthUser: restrictFromToAuthUser !== false,
    };

    await prisma.siteConfig.upsert({
      where: { key: 'smtp' },
      create: { key: 'smtp', value, updatedBy: currentUser?.id },
      update: { value, updatedBy: currentUser?.id },
    });
    invalidateSmtpSettingsCache();

    return json({
      message: 'SMTP settings saved', enabled: value.enabled, host: value.host,
      hasPassword: !!value.pass,
    });
  } catch (err: any) {
    return json({ error: err.message }, 400);
  }
});

/* Send a test email — tests the saved config, or an unsaved draft if provided */
export const testSettings = handler(async (req) => {
  await requirePermission(req, 'settings', 'edit');
  const { to, host, port, secure, user, pass, fromDomain, restrictFromToAuthUser } = await body(req);
  if (!to) return json({ error: 'A recipient email ("to") is required' }, 400);

  try {
    let transport: any;
    let fromAddress: string;

    if (host) {
      // Testing a not-yet-saved draft: build a one-off transport directly,
      // mirroring the exact same From-address logic sendMail() uses so a
      // passing test here means real sends will actually work too.
      let effectivePass = pass;
      if (!effectivePass) {
        const existing = await prisma.siteConfig.findUnique({ where: { key: 'smtp' } });
        effectivePass = (existing?.value as any)?.pass || undefined;
      }
      transport = nodemailer.createTransport({
        host, port: Number(port) || 587, secure: !!secure,
        auth: user ? { user, pass: effectivePass } : undefined,
      });
      transport.on('error', (err: any) => console.error('[mailer] test transport error:', err.message));
      const restrict = restrictFromToAuthUser !== false;
      const address = (restrict && user) ? user : `noreply@${fromDomain || ENV_DOMAIN}`;
      fromAddress = `"Al Khadim (Test)" <${address}>`;
    } else {
      const active = await getTransport();
      transport = active.transport;
      if (!active.configured) {
        return json({ error: 'No SMTP settings are saved and enabled yet — enter and save settings first, or fill the form and test before saving.' }, 400);
      }
      const address = (active.restrictFromToAuthUser && active.authUser) ? active.authUser : `noreply@${active.domain}`;
      fromAddress = `"Al Khadim (Test)" <${address}>`;
    }

    await transport.sendMail({
      from: fromAddress,
      to,
      subject: 'Al Khadim — SMTP Test Email',
      html: `<p>This is a test email confirming your SMTP settings are working correctly.</p><p>Sent ${new Date().toLocaleString('en-AE')}.</p>`,
    });
    return json({ message: `Test email sent to ${to}` });
  } catch (err: any) {
    return json({ error: err.message }, 400);
  }
});

/* Send an email immediately from a module identity */
export const send = handler(async (req) => {
  const currentUser = await requirePermission(req, 'emails', 'send');
  try {
    const { module = 'system', to, cc, bcc, subject, html, text } = await body(req);
    if (!to || !subject || typeof to !== 'string' || typeof subject !== 'string') {
      return json({ error: 'to and subject are required' }, 400);
    }
    if (!IDENTITIES[module]) return json({ error: `Unknown module "${module}"` }, 400);
    await sendMail({
      module, to, cc: optionalString(cc), bcc: optionalString(bcc),
      subject: oneLine(subject), html: optionalString(html), text: optionalString(text),
      createdBy: currentUser.id,
    });
    return json({ message: 'Email sent', module });
  } catch (err: any) {
    return json({ error: err.message }, 400);
  }
});

/* Schedule an email for later delivery */
export const schedule = handler(async (req) => {
  const currentUser = await requirePermission(req, 'emails', 'send');
  try {
    const { module = 'system', to, cc, bcc, subject, html, text, sendAt } = await body(req);
    if (!to || !subject || !sendAt || typeof to !== 'string' || typeof subject !== 'string') {
      return json({ error: 'to, subject and sendAt are required' }, 400);
    }
    if (!IDENTITIES[module]) return json({ error: `Unknown module "${module}"` }, 400);
    const when = new Date(sendAt);
    if (isNaN(when.getTime())) return json({ error: 'Invalid sendAt date' }, 400);

    const scheduled = await prisma.scheduledEmail.create({
      data: {
        module, to, cc: optionalString(cc) || null, bcc: optionalString(bcc) || null,
        subject: oneLine(subject), html: optionalString(html) || null, text: optionalString(text) || null,
        sendAt: when, createdBy: currentUser?.id || null,
      },
    });
    return json(scheduled, 201);
  } catch (err: any) {
    return json({ error: err.message }, 400);
  }
});

/* List scheduled / sent emails — paginated, filterable send history */
export const listScheduled = handler(async (req) => {
  await requirePermission(req, 'emails', 'view');
  const q = query(req);
  const { status, module, source = 'all', campaignId, search } = q;
  const { page, limit, skip } = pagination(q, { defaultLimit: 50 });
  const from = toDate(q.from, 'from');
  const to = toDate(q.to, 'to');

  const and: any[] = [];
  if (status) {
    if (!SCHEDULED_STATUSES.includes(status)) {
      return json({ error: `status must be one of ${SCHEDULED_STATUSES.join(', ')}` }, 400);
    }
    and.push({ status });
  }
  if (module) and.push({ module });

  switch (source) {
    case 'transactional':
      and.push({ campaignId: null, createdBy: null });
      break;
    case 'compose':
      and.push({ campaignId: null, createdBy: { not: null } });
      break;
    case 'campaign':
      and.push({ campaignId: { not: null } });
      break;
    default:
      // 'all' (or anything unrecognized) — no additional constraint
      break;
  }

  if (campaignId) and.push({ campaignId });

  if (from || to) {
    const sendAt: any = {};
    if (from) sendAt.gte = from;
    if (to) sendAt.lte = to;
    and.push({ sendAt });
  }

  if (search) {
    and.push({
      OR: [
        { to: { contains: search, mode: 'insensitive' } },
        { subject: { contains: search, mode: 'insensitive' } },
        { recipientName: { contains: search, mode: 'insensitive' } },
      ],
    });
  }

  const where = and.length ? { AND: and } : {};

  const [data, total] = await Promise.all([
    prisma.scheduledEmail.findMany({
      where,
      orderBy: { sendAt: 'desc' },
      skip,
      take: limit,
      include: { campaign: { select: { id: true, name: true } } },
    }),
    prisma.scheduledEmail.count({ where }),
  ]);

  return json({ data, total, page, limit });
});

/* Cancel a still-pending scheduled email */
export const cancelScheduled = handler<{ id: string }>(async (req, { params }) => {
  await requirePermission(req, 'emails', 'send');
  try {
    const existing = await prisma.scheduledEmail.findUnique({ where: { id: params.id } });
    if (!existing) return json({ error: 'Not found' }, 404);
    if (existing.status !== 'PENDING') return json({ error: `Cannot cancel a ${existing.status} email` }, 400);
    const updated = await prisma.scheduledEmail.update({
      where: { id: params.id }, data: { status: 'CANCELLED' },
    });
    return json(updated);
  } catch (err: any) {
    return json({ error: err.message }, 400);
  }
});

/* Manually flush the scheduler queue (admin / testing) */
export const runScheduler = handler(async (req) => {
  await requirePermission(req, 'emails', 'send');
  const processed = await processDue();
  return json({ processed });
});
