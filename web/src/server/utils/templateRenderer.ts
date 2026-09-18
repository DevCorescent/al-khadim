// Ported from api/src/utils/templateRenderer.js
/**
 * Renders DB-backed EmailTemplate rows with {{mergeTag}} substitution and
 * sends them via the existing mailer. This is the templated replacement for
 * building HTML inline at each call site.
 *
 * Deliberately NOT a full templating language — no conditionals/loops.
 *
 * Escaping rules (HTML bodies):
 *   - `{{key}}` values are HTML-escaped, so a merge value such as a candidate
 *     name containing `<script>` is rendered as text, never as markup.
 *   - `{{{key}}}` (triple braces) inserts the value as raw, trusted HTML.
 *   - A value wrapped with `rawHtml(...)` is inserted raw in either form.
 *   - Backward compatibility: keys ending in `Block` or `Html` (e.g.
 *     `accountBlock`, `messageHtml`) are pre-built HTML fragments by
 *     convention — the seeded templates reference them as `{{accountBlock}}` —
 *     so they are inserted raw too. Call sites building such a fragment MUST
 *     escape any user-supplied text inside it (use `escapeHtml` from
 *     `server/validate`).
 * Subjects are plain text: nothing is escaped there, but CR/LF are collapsed
 * so a merge value can't inject extra mail headers or break the subject line.
 */
import { prisma } from '@/lib/prisma';
import { escapeHtml } from '../validate';
import { sendMail } from './mailer';

/** Marks a string as trusted HTML that `render` must not escape. */
export class SafeHtml {
  constructor(public readonly html: string) {}
  toString() {
    return this.html;
  }
}

export function rawHtml(html: string): SafeHtml {
  return new SafeHtml(html ?? '');
}

/** Merge keys treated as pre-built HTML fragments (see header). */
const TRUSTED_KEY = /(Block|Html)$/;

export interface RenderOptions {
  /**
   * 'html' (default): escape merge values (except trusted fragments).
   * 'text': insert values as-is (plain-text bodies).
   * 'subject': insert values as-is but collapse newlines.
   */
  mode?: 'html' | 'text' | 'subject';
}

function lookup(data: Record<string, any>, key: string) {
  return key.split('.').reduce<any>((o, k) => (o == null ? undefined : o[k]), data);
}

/**
 * Replace {{key}} / {{a.b}} / {{{rawKey}}} tokens with values from data.
 * Unmatched tokens resolve to ''.
 */
export function render(str: string, data: Record<string, any> = {}, { mode = 'html' }: RenderOptions = {}): string {
  if (!str) return str;
  const out = str.replace(/\{\{(\{?)\s*([a-zA-Z0-9_.]+)\s*(\}?)\}\}/g, (_m, open: string, key: string, close: string) => {
    const value = lookup(data || {}, key);
    if (value === undefined || value === null) return '';
    if (mode !== 'html') return String(value);
    const raw = (open === '{' && close === '}') || value instanceof SafeHtml || TRUSTED_KEY.test(key);
    return raw ? String(value) : escapeHtml(value);
  });
  return mode === 'subject' ? out.replace(/[\r\n]+/g, ' ') : out;
}

/** Render a subject line: plain text, no escaping, single line. */
export function renderSubject(str: string, data: Record<string, any> = {}): string {
  return render(str, data, { mode: 'subject' });
}

export async function getTemplateBySlug(slug: string) {
  const template = await prisma.emailTemplate.findUnique({ where: { slug } });
  if (!template) throw new Error(`Email template "${slug}" not found`);
  if (!template.isActive) throw new Error(`Email template "${slug}" is inactive`);
  return template;
}

export interface SendTemplatedMailOptions {
  templateSlug: string;
  to: string;
  data?: Record<string, any>;
  module?: string;
  cc?: string;
  bcc?: string;
  replyTo?: string;
  attachments?: any[];
  subjectOverride?: string;
}

/**
 * Render a DB template with merge-tag data and send it immediately via the
 * existing mailer. Merge values are HTML-escaped in the body (see header).
 */
export async function sendTemplatedMail({ templateSlug, to, data = {}, module, cc, bcc, replyTo, attachments, subjectOverride }: SendTemplatedMailOptions) {
  const template = await getTemplateBySlug(templateSlug);
  const subject = subjectOverride
    ? String(subjectOverride).replace(/[\r\n]+/g, ' ')
    : renderSubject(template.subject, data);
  const html = render(template.html, data);
  return sendMail({ module: module || template.module, to, cc, bcc, subject, html, replyTo, attachments });
}
