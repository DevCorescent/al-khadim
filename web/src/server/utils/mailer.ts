// Ported from api/src/utils/mailer.js
/**
 * Central mailer.
 *
 * Every module of the platform sends mail from its OWN identity (its own
 * "from" name + address) so recipients can tell which department a mail came
 * from and reply to the right inbox. Addresses default to <user>@MAIL_DOMAIN
 * but each can be overridden with an env var, e.g. MAIL_CAREERS=jobs@acme.com.
 *
 * SMTP connection details come from the admin-managed "smtp" SiteConfig row
 * (Settings -> Email in the admin UI) when present and enabled, falling back
 * to the SMTP_* env vars, falling back to a dev jsonTransport that just logs.
 * The resolved config is cached briefly so every send doesn't hit the DB, and
 * the cache is explicitly invalidated whenever the settings are saved.
 *
 * Many SMTP providers (most cPanel/Exim-style shared/business hosting in
 * particular) reject any MAIL FROM that isn't the exact mailbox you
 * authenticated as — e.g. logging in as smtp@example.com but sending "From"
 * careers@example.com bounces with "553 5.7.1 ... not owned by user". Since
 * this platform's whole design sends from many different per-module
 * addresses, `restrictFromToAuthUser` (an SMTP setting, on by default) works
 * around that: the actual envelope/header From becomes the authenticated
 * account, while the module's display name and conceptual address are kept
 * via the friendly name + Reply-To, so branding and reply-routing are mostly
 * preserved. Nothing here is a hardcoded address/domain — it's all derived
 * from whatever the admin has configured (DB settings or SMTP_* env vars).
 */
import nodemailer, { type Transporter } from 'nodemailer';
import { prisma } from '@/lib/prisma';

export const ENV_DOMAIN = process.env.MAIL_DOMAIN || 'alkhadim.ae';

// module key  ->  { name shown to recipient, mailbox user part }
export const IDENTITIES: Record<string, { name: string; user: string }> = {
  system:        { name: 'Al Khadim',             user: 'noreply' },
  otp:           { name: 'Al Khadim Verification', user: 'verify' },
  auth:          { name: 'Al Khadim Accounts',    user: 'accounts' },
  users:         { name: 'Al Khadim Accounts',    user: 'accounts' },
  candidates:    { name: 'Al Khadim Careers',     user: 'careers' },
  candidateAuth: { name: 'Al Khadim Careers',     user: 'careers' },
  registrations: { name: 'Al Khadim Careers',     user: 'careers' },
  jobs:          { name: 'Al Khadim Recruitment', user: 'recruitment' },
  interviews:    { name: 'Al Khadim Recruitment', user: 'recruitment' },
  profileShares: { name: 'Al Khadim Recruitment', user: 'recruitment' },
  clientAuth:    { name: 'Al Khadim Recruitment', user: 'recruitment' },
  clients:       { name: 'Al Khadim Sales',       user: 'sales' },
  enquiries:     { name: 'Al Khadim Enquiries',   user: 'info' },
  followUps:     { name: 'Al Khadim Sales',       user: 'sales' },
  invoices:      { name: 'Al Khadim Billing',     user: 'billing' },
  employees:     { name: 'Al Khadim HR',          user: 'hr' },
  attendance:    { name: 'Al Khadim HR',          user: 'hr' },
  leave:         { name: 'Al Khadim HR',          user: 'hr' },
  payroll:       { name: 'Al Khadim Payroll',     user: 'payroll' },
  outsourcing:   { name: 'Al Khadim Operations',  user: 'operations' },
  documents:     { name: 'Al Khadim HR',          user: 'hr' },
  reports:       { name: 'Al Khadim Reports',     user: 'reports' },
};

export interface MailIdentity {
  module: string;
  name: string;
  address: string;
}

/** Resolve the from-identity for a module. */
export function identityFor(module: string, domain: string = ENV_DOMAIN): MailIdentity {
  const id = IDENTITIES[module] || IDENTITIES.system;
  const envKey = `MAIL_${id.user.toUpperCase()}`;               // e.g. MAIL_CAREERS
  const address = process.env[envKey] || `${id.user}@${domain}`;
  return { module: IDENTITIES[module] ? module : 'system', name: id.name, address };
}

/** Every module + its resolved sender address (for the admin UI). */
export function listIdentities(domain: string = ENV_DOMAIN): MailIdentity[] {
  return Object.keys(IDENTITIES).map((m) => ({ module: m, ...identityFor(m, domain) }));
}

/** Shape of the "smtp" SiteConfig value, as saved by the admin UI. */
export interface SmtpSettings {
  enabled?: boolean;
  host?: string;
  port?: number | string;
  secure?: boolean;
  user?: string;
  pass?: string;
  fromDomain?: string;
  restrictFromToAuthUser?: boolean;
  [key: string]: any;
}

const SETTINGS_CACHE_MS = 30_000;
let _settingsCache: SmtpSettings | null | undefined; // undefined = not loaded yet, null = loaded, no DB row
let _settingsCachedAt = 0;

/** Read the admin-managed SMTP config (SiteConfig key "smtp"), cached briefly. */
export async function loadSmtpSettings(): Promise<SmtpSettings | null> {
  if (_settingsCache !== undefined && Date.now() - _settingsCachedAt < SETTINGS_CACHE_MS) {
    return _settingsCache;
  }
  try {
    const row = await prisma.siteConfig.findUnique({ where: { key: 'smtp' } });
    _settingsCache = (row?.value as SmtpSettings) || null;
  } catch (err: any) {
    console.error('[mailer] failed to load SMTP settings from DB, falling back to env:', err.message);
    _settingsCache = null;
  }
  _settingsCachedAt = Date.now();
  return _settingsCache;
}

/** Call after the SMTP settings are saved so the next send picks them up immediately. */
export function invalidateSmtpSettingsCache(): void {
  _settingsCache = undefined;
  _settingsCachedAt = 0;
  _transport = null;
  _transportKey = null;
}

interface ResolvedSmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
  domain: string;
  restrictFromToAuthUser: boolean;
}

/** DB settings (if enabled+configured) win; otherwise fall back to SMTP_* env vars. */
function resolveConfig(settings: SmtpSettings | null): ResolvedSmtpConfig | null {
  if (settings && settings.enabled && settings.host) {
    return {
      host: settings.host,
      port: Number(settings.port) || 587,
      secure: !!settings.secure,
      user: settings.user || undefined,
      pass: settings.pass || undefined,
      domain: settings.fromDomain || ENV_DOMAIN,
      // Explicit `false` opts out; anything else (unset included) defaults on,
      // since that's the setting that works for the widest range of providers.
      restrictFromToAuthUser: settings.restrictFromToAuthUser !== false,
    };
  }
  if (process.env.SMTP_HOST) {
    return {
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      user: process.env.SMTP_USER || undefined,
      pass: process.env.SMTP_PASS || undefined,
      domain: ENV_DOMAIN,
      restrictFromToAuthUser: process.env.SMTP_RESTRICT_FROM !== 'false',
    };
  }
  return null;
}

let _transport: Transporter | null = null;
let _transportKey: string | null = null;

export interface ResolvedTransport {
  transport: Transporter;
  domain: string;
  configured: boolean;
  authUser: string | null;
  restrictFromToAuthUser: boolean;
}

/** Resolve the current transport (rebuilding it if the effective config changed). */
export async function getTransport(): Promise<ResolvedTransport> {
  const settings = await loadSmtpSettings();
  const config = resolveConfig(settings);
  const key = config ? `${config.host}:${config.port}:${config.secure}:${config.user}:${config.domain}:${config.restrictFromToAuthUser}` : 'json';
  const resolved = {
    domain: config?.domain || ENV_DOMAIN,
    configured: !!config,
    authUser: config?.user || null,
    restrictFromToAuthUser: config ? config.restrictFromToAuthUser : false,
  };

  if (_transport && _transportKey === key) {
    return { transport: _transport, ...resolved };
  }

  if (config) {
    _transport = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.user ? { user: config.user, pass: config.pass } : undefined,
    });
    // Nodemailer can emit a stray async 'error' event on the underlying
    // connection (e.g. extra server data after an AUTH failure) even after
    // the sendMail() promise has already resolved/rejected. Without a
    // listener here, that unhandled EventEmitter error crashes the whole
    // process — this guards the entire app, not just a single send.
    _transport.on('error', (err) => console.error('[mailer] transport error:', err.message));
  } else {
    // No SMTP configured (dev, or disabled in settings): log the message
    // instead of delivering it so nothing crashes and developers can still
    // see what would have been sent.
    _transport = nodemailer.createTransport({ jsonTransport: true });
    console.warn('[mailer] SMTP not configured — emails are logged, not delivered.');
  }
  _transportKey = key;
  return { transport: _transport, ...resolved };
}

interface DirectSendLog {
  module: string;
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  html?: string;
  text?: string;
  status: 'SENT' | 'FAILED';
  error?: string;
  campaignId?: string;
  recipientId?: string;
  recipientName?: string;
  createdBy?: string;
}

/**
 * Write a completed (SENT or FAILED) row straight into scheduled_emails so
 * every direct send — transactional, ad-hoc Compose, campaign test-sends —
 * shows up in the history/tracking view without anything having queued it
 * first. Calls that already own a row (the scheduler, processing a PENDING
 * entry it created) pass `scheduledEmailId` and skip this entirely, so a
 * scheduled/campaign send is never logged twice.
 */
async function logDirectSend({ module, to, cc, bcc, subject, html, text, status, error, campaignId, recipientId, recipientName, createdBy }: DirectSendLog) {
  try {
    await prisma.scheduledEmail.create({
      data: {
        module, to, cc: cc || null, bcc: bcc || null, subject,
        html: html || null, text: text || null,
        sendAt: new Date(), status, sentAt: status === 'SENT' ? new Date() : null,
        error: error || null,
        campaignId: campaignId || null,
        recipientId: recipientId || null,
        recipientName: recipientName || null,
        createdBy: createdBy || null,
      },
    });
  } catch (err: any) {
    // History logging must never take down a real send/failure path.
    console.error('[mailer] failed to write history log:', err.message);
  }
}

export interface SendMailOptions {
  module?: string;
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
  attachments?: any[];
  scheduledEmailId?: string;
  campaignId?: string;
  recipientId?: string;
  recipientName?: string;
  createdBy?: string;
}

/** Send an email from a module's identity. */
export async function sendMail(opts: SendMailOptions = {} as SendMailOptions): Promise<any> {
  const {
    module = 'system', to, cc, bcc, subject, html, text, replyTo, attachments,
    scheduledEmailId, campaignId, recipientId, recipientName, createdBy,
  } = opts;
  if (!to) throw new Error('sendMail: "to" is required');
  if (!subject) throw new Error('sendMail: "subject" is required');

  const { transport, domain, authUser, restrictFromToAuthUser } = await getTransport();
  const identity = identityFor(module, domain);
  // When the provider only allows sending as the authenticated account, send
  // as that address but keep the module's name + route replies to its usual
  // conceptual address, so branding/reply-routing survive as much as possible.
  const useAuthUser = restrictFromToAuthUser && !!authUser;
  const fromAddress = useAuthUser ? authUser : identity.address;

  let info: any;
  try {
    info = await transport.sendMail({
      from: `"${identity.name}" <${fromAddress}>`,
      to, cc, bcc, subject,
      html,
      text: text || (html ? undefined : subject),
      replyTo: replyTo || identity.address,
      attachments,
    });
  } catch (err: any) {
    if (!scheduledEmailId) {
      await logDirectSend({
        module, to, cc, bcc, subject, html, text, status: 'FAILED',
        error: String(err?.message || err).slice(0, 500),
        campaignId, recipientId, recipientName, createdBy,
      });
    }
    throw err;
  }

  if (!scheduledEmailId) {
    await logDirectSend({
      module, to, cc, bcc, subject, html, text, status: 'SENT',
      campaignId, recipientId, recipientName, createdBy,
    });
  }

  if ((transport as any).options?.jsonTransport) {
    console.log(`[mailer:${module}] (dev) ${fromAddress} -> ${to} | ${subject}`);
  }
  return info;
}
