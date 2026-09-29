/**
 * Onboarding document checklist (SiteConfig key "onboardingDocuments"), kept by
 * the Super Admin. Every item becomes a ClientDocumentRequest when a client is
 * added or approved, or when the checklist is applied to an existing client.
 */
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';
import { escapeHtml } from '../validate';
import { sendMail } from './mailer';

export interface ChecklistItem {
  id: string;
  title: string;
  description: string | null;
  /** Days after the request is created that the document is due; null = no due date. */
  dueInDays: number | null;
}

export interface OnboardingChecklist {
  /** Request the checklist automatically when a client is added or approved. */
  autoApply: boolean;
  items: ChecklistItem[];
}

const KEY = 'onboardingDocuments';
const WEB_URL = process.env.WEB_URL || 'http://localhost:3000';
export const MAX_ITEMS = 50;

export async function getChecklist(): Promise<OnboardingChecklist> {
  const row = await prisma.siteConfig.findUnique({ where: { key: KEY } });
  const v: any = row?.value || {};
  return { autoApply: v.autoApply !== false, items: Array.isArray(v.items) ? v.items : [] };
}

/** Validates and normalises an admin-submitted checklist. Throws a 400-shaped error. */
export function normaliseChecklist(raw: any): OnboardingChecklist {
  const bad = (msg: string) => Object.assign(new Error(msg), { status: 400 });
  if (!raw || !Array.isArray(raw.items)) throw bad('items must be a list');
  if (raw.items.length > MAX_ITEMS) throw bad(`At most ${MAX_ITEMS} documents`);
  const seen = new Set<string>();
  const items = raw.items.map((it: any, i: number) => {
    const title = typeof it?.title === 'string' ? it.title.trim() : '';
    if (!title) throw bad(`Document ${i + 1} needs a name`);
    if (title.length > 200) throw bad(`Document ${i + 1}: name is too long`);
    if (seen.has(title.toLowerCase())) throw bad(`"${title}" is listed twice`);
    seen.add(title.toLowerCase());
    const description = typeof it.description === 'string' && it.description.trim() ? it.description.trim().slice(0, 1000) : null;
    let dueInDays: number | null = null;
    if (it.dueInDays !== undefined && it.dueInDays !== null && it.dueInDays !== '') {
      dueInDays = Number(it.dueInDays);
      if (!Number.isInteger(dueInDays) || dueInDays < 1 || dueInDays > 365) throw bad(`"${title}": due in days must be 1-365`);
    }
    return { id: typeof it.id === 'string' && it.id ? it.id : randomUUID(), title, description, dueInDays };
  });
  return { autoApply: raw.autoApply !== false, items };
}

export async function saveChecklist(checklist: OnboardingChecklist, userId: string) {
  await prisma.siteConfig.upsert({
    where: { key: KEY },
    create: { key: KEY, value: checklist as any, updatedBy: userId },
    update: { value: checklist as any, updatedBy: userId },
  });
}

/**
 * Requests every checklist document the client does not already have a request
 * for (matched by name, case-insensitive), then emails the company's portal
 * users one combined message. Returns the number of requests created.
 */
export async function applyChecklist(clientId: string, requestedById: string | null, { onlyIfAuto = false } = {}): Promise<number> {
  const checklist = await getChecklist();
  if (!checklist.items.length || (onlyIfAuto && !checklist.autoApply)) return 0;

  const existing = await prisma.clientDocumentRequest.findMany({ where: { clientId }, select: { title: true } });
  const have = new Set(existing.map((e) => e.title.trim().toLowerCase()));
  const now = Date.now();
  const toCreate = checklist.items
    .filter((it) => !have.has(it.title.toLowerCase()))
    .map((it) => ({
      clientId, title: it.title, description: it.description, requestedById,
      dueDate: it.dueInDays ? new Date(now + it.dueInDays * 86_400_000) : null,
    }));
  if (!toCreate.length) return 0;
  await prisma.clientDocumentRequest.createMany({ data: toCreate });

  const [client, users] = await Promise.all([
    prisma.client.findUnique({ where: { id: clientId }, select: { companyName: true } }),
    prisma.clientUser.findMany({ where: { clientId, isActive: true }, select: { email: true } }),
  ]);
  if (users.length) {
    const list = toCreate.map((d) =>
      `<li><strong>${escapeHtml(d.title)}</strong>${d.description ? ` (${escapeHtml(d.description)})` : ''}${
        d.dueDate ? ` · due ${escapeHtml(d.dueDate.toLocaleDateString('en-AE', { dateStyle: 'medium' }))}` : ''}</li>`).join('');
    sendMail({
      module: 'clients',
      to: users.map((u) => u.email).join(','),
      subject: `Documents needed to complete your onboarding`,
      html: `<p>Hello,</p>
             <p>To complete ${escapeHtml(client?.companyName || 'your company')}'s onboarding with Al Khadim, please upload:</p>
             <ul>${list}</ul>
             <p><a href="${escapeHtml(`${WEB_URL}/company/documents`)}">Upload them in your company portal</a></p>
             <p>Regards,<br/>Al Khadim</p>`,
    }).catch((e: any) => console.error('[onboardingDocuments] email failed:', e.message));
  }
  return toCreate.length;
}

/** For client-creation paths: never let the checklist break creating/approving the client. */
export async function applyChecklistSafely(clientId: string, requestedById: string | null) {
  try {
    return await applyChecklist(clientId, requestedById, { onlyIfAuto: true });
  } catch (err: any) {
    console.error('[onboardingDocuments] could not apply checklist:', err.message);
    return 0;
  }
}
