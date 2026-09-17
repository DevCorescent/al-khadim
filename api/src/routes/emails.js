const router = require('express').Router();
const nodemailer = require('nodemailer');
const { PrismaClient } = require('@prisma/client');
const { authenticate, authorize } = require('../middleware/auth');
const {
  sendMail, listIdentities, IDENTITIES, ENV_DOMAIN,
  getTransport, invalidateSmtpSettingsCache,
} = require('../utils/mailer');
const { processDue } = require('../scheduler/emailScheduler');

const prisma = new PrismaClient();

/* Module -> sender-identity map (for the admin UI dropdowns) */
router.get('/identities', authenticate, async (req, res) => {
  const { domain } = await getTransport();
  res.json(listIdentities(domain));
});

/* ── SMTP settings: admin-managed mail server config (SiteConfig key "smtp") ── */

/* Get current settings — password is NEVER returned, only whether one is set */
router.get('/settings', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  const row = await prisma.siteConfig.findUnique({ where: { key: 'smtp' } });
  const v = row?.value || {};
  res.json({
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
router.put('/settings', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  try {
    const { enabled, host, port, secure, user, pass, fromDomain, restrictFromToAuthUser } = req.body;
    if (enabled && !host) return res.status(400).json({ error: 'Host is required to enable SMTP' });

    const existing = await prisma.siteConfig.findUnique({ where: { key: 'smtp' } });
    const prevPass = existing?.value?.pass || '';
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
      create: { key: 'smtp', value, updatedBy: req.user?.id },
      update: { value, updatedBy: req.user?.id },
    });
    invalidateSmtpSettingsCache();

    res.json({
      message: 'SMTP settings saved', enabled: value.enabled, host: value.host,
      hasPassword: !!value.pass,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/* Send a test email — tests the saved config, or an unsaved draft if provided */
router.post('/settings/test', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  const { to, host, port, secure, user, pass, fromDomain, restrictFromToAuthUser } = req.body;
  if (!to) return res.status(400).json({ error: 'A recipient email ("to") is required' });

  try {
    let transport;
    let fromAddress;

    if (host) {
      // Testing a not-yet-saved draft: build a one-off transport directly,
      // mirroring the exact same From-address logic sendMail() uses so a
      // passing test here means real sends will actually work too.
      let effectivePass = pass;
      if (!effectivePass) {
        const existing = await prisma.siteConfig.findUnique({ where: { key: 'smtp' } });
        effectivePass = existing?.value?.pass || undefined;
      }
      transport = nodemailer.createTransport({
        host, port: Number(port) || 587, secure: !!secure,
        auth: user ? { user, pass: effectivePass } : undefined,
      });
      transport.on('error', (err) => console.error('[mailer] test transport error:', err.message));
      const restrict = restrictFromToAuthUser !== false;
      const address = (restrict && user) ? user : `noreply@${fromDomain || ENV_DOMAIN}`;
      fromAddress = `"Al Khadim (Test)" <${address}>`;
    } else {
      const active = await getTransport();
      transport = active.transport;
      if (!active.configured) {
        return res.status(400).json({ error: 'No SMTP settings are saved and enabled yet — enter and save settings first, or fill the form and test before saving.' });
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
    res.json({ message: `Test email sent to ${to}` });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/* Send an email immediately from a module identity */
router.post('/send', authenticate, async (req, res) => {
  try {
    const { module = 'system', to, cc, bcc, subject, html, text } = req.body;
    if (!to || !subject) return res.status(400).json({ error: 'to and subject are required' });
    if (!IDENTITIES[module]) return res.status(400).json({ error: `Unknown module "${module}"` });
    await sendMail({ module, to, cc, bcc, subject, html, text, createdBy: req.user.id });
    res.json({ message: 'Email sent', module });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/* Schedule an email for later delivery */
router.post('/schedule', authenticate, async (req, res) => {
  try {
    const { module = 'system', to, cc, bcc, subject, html, text, sendAt } = req.body;
    if (!to || !subject || !sendAt) return res.status(400).json({ error: 'to, subject and sendAt are required' });
    if (!IDENTITIES[module]) return res.status(400).json({ error: `Unknown module "${module}"` });
    const when = new Date(sendAt);
    if (isNaN(when.getTime())) return res.status(400).json({ error: 'Invalid sendAt date' });

    const scheduled = await prisma.scheduledEmail.create({
      data: {
        module, to, cc: cc || null, bcc: bcc || null,
        subject, html: html || null, text: text || null,
        sendAt: when, createdBy: req.user?.id || null,
      },
    });
    res.status(201).json(scheduled);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/* List scheduled / sent emails — paginated, filterable send history */
router.get('/scheduled', authenticate, async (req, res) => {
  const {
    status, module, source = 'all', campaignId, from, to, search,
    page = 1, limit = 50,
  } = req.query;

  const and = [];
  if (status) and.push({ status });
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
    const sendAt = {};
    if (from) sendAt.gte = new Date(from);
    if (to) sendAt.lte = new Date(to);
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
  const skip = (Number(page) - 1) * Number(limit);

  const [data, total] = await Promise.all([
    prisma.scheduledEmail.findMany({
      where,
      orderBy: { sendAt: 'desc' },
      skip,
      take: Number(limit),
      include: { campaign: { select: { id: true, name: true } } },
    }),
    prisma.scheduledEmail.count({ where }),
  ]);

  res.json({ data, total, page: Number(page), limit: Number(limit) });
});

/* Cancel a still-pending scheduled email */
router.delete('/scheduled/:id', authenticate, async (req, res) => {
  try {
    const existing = await prisma.scheduledEmail.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    if (existing.status !== 'PENDING') return res.status(400).json({ error: `Cannot cancel a ${existing.status} email` });
    const updated = await prisma.scheduledEmail.update({
      where: { id: req.params.id }, data: { status: 'CANCELLED' },
    });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/* Manually flush the scheduler queue (admin / testing) */
router.post('/run-scheduler', authenticate, async (req, res) => {
  const processed = await processDue();
  res.json({ processed });
});

module.exports = router;
