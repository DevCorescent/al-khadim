/**
 * Saved invoice templates: sender and bank details, terms, tax and design
 * (optionally line items) that new invoices can start from. A template never
 * holds a client, dates, status or an invoice number, so every invoice made
 * from one still gets its own unique number.
 */
import { prisma } from '@/lib/prisma';
import { requirePermission } from '../permissions';
import { body, handler, json } from '../http';
import { LOGO_PATH } from './invoices.controller';

const TEXT_KEYS = [
  'docType', 'currency', 'dateFormat', 'subject', 'description',
  'fromName', 'fromAddress', 'fromEmail', 'fromPhone', 'fromTaxNo', 'fromRegNo',
  'discountType', 'taxLabel', 'paymentMethod',
  'bankName', 'bankAccount', 'bankIBAN', 'bankSwift', 'bankRoutingNo', 'bankSortCode',
  'terms', 'notes',
  'template', 'primaryColor', 'accentColor', 'fontFamily', 'logoText', 'logoUrl', 'logoShape', 'tableStyle',
  'watermark', 'footerText',
];
const NUMBER_KEYS = ['discount', 'taxRate', 'watermarkOpacity'];
const BOOL_KEYS = ['showHeader', 'showFooter', 'showSignature'];
const MAX_ITEMS = 100;

const badRequest = (msg: string) => Object.assign(new Error(msg), { status: 400 });

/** Keeps only template-able fields, with basic type checks. */
function cleanData(raw: any) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw badRequest('data must be an object');
  const out: Record<string, any> = {};
  for (const k of TEXT_KEYS) {
    if (raw[k] === undefined || raw[k] === null) continue;
    if (typeof raw[k] !== 'string') throw badRequest(`${k} must be text`);
    out[k] = raw[k].slice(0, 5000);
  }
  for (const k of NUMBER_KEYS) {
    if (raw[k] === undefined || raw[k] === null || raw[k] === '') continue;
    const n = Number(raw[k]);
    if (!Number.isFinite(n) || n < 0) throw badRequest(`${k} must be a positive number`);
    out[k] = n;
  }
  for (const k of BOOL_KEYS) if (raw[k] !== undefined) out[k] = !!raw[k];
  if (out.logoUrl && !LOGO_PATH.test(out.logoUrl)) throw badRequest('Invalid logo image');
  if (raw.items !== undefined && raw.items !== null) {
    if (!Array.isArray(raw.items) || raw.items.length > MAX_ITEMS) throw badRequest(`items must be a list of up to ${MAX_ITEMS}`);
    out.items = raw.items
      .filter((it: any) => it && typeof it.description === 'string' && it.description.trim())
      .map((it: any) => ({
        description: it.description.trim().slice(0, 1000),
        qty: Number.isFinite(Number(it.qty)) && Number(it.qty) > 0 ? Number(it.qty) : 1,
        unit: typeof it.unit === 'string' ? it.unit.slice(0, 50) : '',
        unitPrice: Number.isFinite(Number(it.unitPrice)) && Number(it.unitPrice) >= 0 ? Number(it.unitPrice) : 0,
      }));
  }
  return out;
}

function cleanName(raw: any): string {
  const name = typeof raw === 'string' ? raw.trim() : '';
  if (!name) throw badRequest('Template name is required');
  if (name.length > 100) throw badRequest('Template name is too long');
  return name;
}

function cleanDescription(raw: any): string | null {
  if (raw === undefined || raw === null || raw === '') return null;
  if (typeof raw !== 'string') throw badRequest('description must be text');
  return raw.trim().slice(0, 500) || null;
}

/** Runs a write, turning a duplicate name into a friendly 409. */
async function guarded(fn: () => Promise<Response>) {
  try {
    return await fn();
  } catch (err: any) {
    if (err?.code === 'P2002') return json({ error: 'A template with this name already exists' }, 409);
    if (err?.code === 'P2025') return json({ error: 'Template not found' }, 404);
    return json({ error: err.message }, err.status || 400);
  }
}

const SELECT = {
  id: true, name: true, description: true, data: true, isDefault: true, createdAt: true, updatedAt: true,
  createdBy: { select: { id: true, name: true } },
};

/* GET /api/invoice-templates */
export const list = handler(async (req) => {
  await requirePermission(req, 'invoices', 'view');
  const templates = await prisma.invoiceTemplate.findMany({ select: SELECT, orderBy: [{ isDefault: 'desc' }, { name: 'asc' }] });
  return json(templates);
});

/* POST /api/invoice-templates  { name, description?, data, isDefault? } */
export const create = handler(async (req) => {
  const user = await requirePermission(req, 'invoices', 'create', ['invoices', 'edit']);
  return guarded(async () => {
    const raw = (await body(req)) || {};
    const name = cleanName(raw.name);
    const data = cleanData(raw.data);
    const isDefault = raw.isDefault === true;
    const tpl = await prisma.$transaction(async (tx) => {
      if (isDefault) await tx.invoiceTemplate.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
      return tx.invoiceTemplate.create({
        data: { name, description: cleanDescription(raw.description), data, isDefault, createdById: user.id },
        select: SELECT,
      });
    });
    return json(tpl, 201);
  });
});

/* PUT /api/invoice-templates/:id  { name?, description?, data?, isDefault? } */
export const update = handler<{ id: string }>(async (req, { params }) => {
  await requirePermission(req, 'invoices', 'edit');
  return guarded(async () => {
    const raw = (await body(req)) || {};
    const patch: any = {};
    if (raw.name !== undefined) patch.name = cleanName(raw.name);
    if (raw.description !== undefined) patch.description = cleanDescription(raw.description);
    if (raw.data !== undefined) patch.data = cleanData(raw.data);
    if (raw.isDefault !== undefined) patch.isDefault = raw.isDefault === true;
    const tpl = await prisma.$transaction(async (tx) => {
      if (patch.isDefault) await tx.invoiceTemplate.updateMany({ where: { isDefault: true, NOT: { id: params.id } }, data: { isDefault: false } });
      return tx.invoiceTemplate.update({ where: { id: params.id }, data: patch, select: SELECT });
    });
    return json(tpl);
  });
});

/* POST /api/invoice-templates/:id/duplicate — copy with a free "(copy)" name, never the default */
export const duplicate = handler<{ id: string }>(async (req, { params }) => {
  const user = await requirePermission(req, 'invoices', 'create', ['invoices', 'edit']);
  return guarded(async () => {
    const src = await prisma.invoiceTemplate.findUnique({ where: { id: params.id } });
    if (!src) return json({ error: 'Template not found' }, 404);
    const taken = new Set((await prisma.invoiceTemplate.findMany({
      where: { name: { startsWith: `${src.name} (copy` } }, select: { name: true },
    })).map((t) => t.name));
    let name = `${src.name} (copy)`;
    for (let n = 2; taken.has(name); n++) name = `${src.name} (copy ${n})`;
    const tpl = await prisma.invoiceTemplate.create({
      data: { name: name.slice(0, 100), description: src.description, data: src.data as any, isDefault: false, createdById: user.id },
      select: SELECT,
    });
    return json(tpl, 201);
  });
});

/* DELETE /api/invoice-templates/:id */
export const remove = handler<{ id: string }>(async (req, { params }) => {
  await requirePermission(req, 'invoices', 'delete', ['invoices', 'edit']);
  return guarded(async () => {
    await prisma.invoiceTemplate.delete({ where: { id: params.id } });
    return json({ message: 'Template deleted' });
  });
});
