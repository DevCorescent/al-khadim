/**
 * Renders DB-backed EmailTemplate rows with {{mergeTag}} substitution and
 * sends them via the existing mailer. This is the templated replacement for
 * building HTML inline at each call site.
 *
 * Deliberately NOT a full templating language — no conditionals/loops.
 * Call sites that need conditional content precompute the HTML fragment in
 * JS (e.g. `data.accountBlock = isNewAccount ? '<p>...</p>' : '<p>...</p>'`)
 * and reference it as a plain `{{accountBlock}}` token in the template body.
 */
const { PrismaClient } = require('@prisma/client');
const { sendMail } = require('./mailer');
const prisma = new PrismaClient();

/** Replace {{key}} / {{a.b}} tokens with values from data. Unmatched tokens resolve to ''. */
function render(str, data = {}) {
  if (!str) return str;
  return str.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_m, key) => {
    const value = key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), data);
    return value === undefined || value === null ? '' : String(value);
  });
}

async function getTemplateBySlug(slug) {
  const template = await prisma.emailTemplate.findUnique({ where: { slug } });
  if (!template) throw new Error(`Email template "${slug}" not found`);
  if (!template.isActive) throw new Error(`Email template "${slug}" is inactive`);
  return template;
}

/**
 * Render a DB template with merge-tag data and send it immediately via the
 * existing mailer.
 * @param {{templateSlug:string, to:string, data?:object, module?:string,
 *          cc?:string, bcc?:string, replyTo?:string, attachments?:any[],
 *          subjectOverride?:string}} opts
 */
async function sendTemplatedMail({ templateSlug, to, data = {}, module, cc, bcc, replyTo, attachments, subjectOverride }) {
  const template = await getTemplateBySlug(templateSlug);
  const subject = subjectOverride || render(template.subject, data);
  const html = render(template.html, data);
  return sendMail({ module: module || template.module, to, cc, bcc, subject, html, replyTo, attachments });
}

module.exports = { render, getTemplateBySlug, sendTemplatedMail };
