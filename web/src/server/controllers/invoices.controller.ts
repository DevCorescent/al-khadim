// Ported from api/src/routes/invoices.js
import { prisma } from '@/lib/prisma';
import { requirePermission } from '../permissions';
import { body, handler, HttpError, json, query } from '../http';
import { pagination, toDate, toNumber } from '../validate';

/* ─── helpers ─────────────────────────────────────────────── */
/** Interactive transactions do several round-trips; allow for a slow database. */
const TX_OPTIONS = { maxWait: 10_000, timeout: 30_000 };
const PREFIX: Record<string, string> = { INVOICE: 'INV', PROFORMA_INVOICE: 'PI', QUOTATION: 'QT' };
const DOC_TYPES = Object.keys(PREFIX);
const STATUSES = ['DRAFT', 'SENT', 'PAID', 'OVERDUE', 'CANCELLED', 'ACCEPTED', 'REJECTED'];
const DISCOUNT_TYPES = ['FIXED', 'PERCENT'];
/** Invoices that have been issued but not yet paid. */
const OUTSTANDING_STATUSES = ['SENT', 'OVERDUE'];

/**
 * Next free number for a doc type ("latest + 1"). `attempt` skips ahead when a
 * concurrent request grabbed the same number (see withUniqueRetry).
 */
async function nextNumber(docType: string, attempt = 0) {
  const prefix = PREFIX[docType] || 'INV';
  const yr     = new Date().getFullYear();
  const last   = await prisma.invoice.findFirst({
    where: { invoiceNo: { startsWith: `${prefix}-${yr}-` } },
    orderBy: { createdAt: 'desc' },
  });
  const seq = (last ? parseInt(last.invoiceNo.split('-').pop() || '0') || 0 : 0) + 1 + attempt;
  return `${prefix}-${yr}-${String(seq).padStart(4, '0')}`;
}

/** Retries `fn` when it hits a unique-constraint violation (two requests generated the same number). */
async function withUniqueRetry<T>(fn: (attempt: number) => Promise<T>, attempts = 5): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn(attempt);
    } catch (err: any) {
      if (err?.code !== 'P2002' || attempt >= attempts - 1) throw err;
    }
  }
}

function calcTotals(items: any[] = [], discountVal: any, discountType: any, taxRate: any) {
  const subtotal  = items.reduce((s, i) => s + (parseFloat(i.qty) * parseFloat(i.unitPrice)), 0);
  const discAmt   = discountType === 'PERCENT'
    ? subtotal * (parseFloat(discountVal || 0) / 100)
    : parseFloat(discountVal || 0);
  const taxable   = Math.max(0, subtotal - discAmt);
  const taxAmt    = taxable * (parseFloat(taxRate || 0) / 100);
  const total     = taxable + taxAmt;
  return { subtotal, discount: discAmt, tax: taxAmt, totalAmount: total, amount: subtotal };
}

/** Validates line items and normalises qty/unitPrice/total. */
function normaliseItems(items: any): { description: string; qty: number; unit: string | null; unitPrice: number; total: number; sortOrder: number }[] {
  if (!Array.isArray(items)) throw new HttpError(400, 'items must be an array');
  return items.map((it: any, idx: number) => {
    if (!it || typeof it !== 'object') throw new HttpError(400, `items[${idx}] is invalid`);
    if (!it.description || !String(it.description).trim()) throw new HttpError(400, `items[${idx}].description is required`);
    const qty       = toNumber(it.qty, `items[${idx}].qty`) ?? 1;
    const unitPrice = toNumber(it.unitPrice, `items[${idx}].unitPrice`) ?? 0;
    return {
      description: String(it.description),
      qty,
      unit:        it.unit || null,
      unitPrice,
      total:       qty * unitPrice,
      sortOrder:   idx,
    };
  });
}

function checkEnum(value: any, allowed: string[], field: string) {
  if (value !== undefined && !allowed.includes(value)) {
    throw new HttpError(400, `${field} must be one of ${allowed.join(', ')}`);
  }
}

/** [Jan 1, Jan 1 next year) of the given year, validated. */
function yearRange(year: any) {
  const y = parseInt(year, 10);
  if (!Number.isInteger(y) || y < 1900 || y > 9999) throw new HttpError(400, 'year must be a valid year');
  return { gte: new Date(Date.UTC(y, 0, 1)), lt: new Date(Date.UTC(y + 1, 0, 1)) };
}

const includeAll = {
  client: { select: { id: true, companyName: true, contactPerson: true, email: true, phone: true, address: true, city: true, country: true } },
  items: { orderBy: { sortOrder: 'asc' as const } },
};

/* ─── GET /  list ─────────────────────────────────────────── */
export const list = handler(async (req) => {
  await requirePermission(req, 'invoices', 'view');
  const q = query(req);
  const { clientId, status, docType, search, year } = q;
  const where: any = {};
  if (clientId) where.clientId = clientId;
  if (status)   where.status   = status;
  if (docType)  where.docType  = docType;
  if (year)     where.issueDate = yearRange(year);
  if (search) {
    where.OR = [
      { invoiceNo: { contains: search, mode: 'insensitive' } },
      { client: { companyName: { contains: search, mode: 'insensitive' } } },
      { subject: { contains: search, mode: 'insensitive' } },
    ];
  }
  const { skip, limit } = pagination(q, { defaultLimit: 50 });
  const [docs, total] = await Promise.all([
    prisma.invoice.findMany({ where, include: includeAll, orderBy: { createdAt: 'desc' }, skip, take: limit }),
    prisma.invoice.count({ where }),
  ]);
  return json({ data: docs, total });
});

/* ─── GET /stats  financial summary (everything scoped to ?year) ── */
export const stats = handler(async (req) => {
  await requirePermission(req, 'invoices', 'view');
  const { year = new Date().getFullYear() } = query(req);
  const where = { issueDate: yearRange(year) };

  const [all, byClient, byStatus, byType] = await Promise.all([
    prisma.invoice.findMany({ where }),
    prisma.invoice.groupBy({ by: ['clientId'], where: { ...where, docType: 'INVOICE' }, _sum: { totalAmount: true }, orderBy: { _sum: { totalAmount: 'desc' } }, take: 10 }),
    prisma.invoice.groupBy({ by: ['status'], where: { ...where, docType: 'INVOICE' }, _sum: { totalAmount: true }, _count: true }),
    prisma.invoice.groupBy({ by: ['docType'], where, _sum: { totalAmount: true }, _count: true }),
  ]);

  const invoices = all.filter((i) => i.docType === 'INVOICE');
  const totalInvoiced   = invoices.reduce((s, i) => s + i.totalAmount, 0);
  const totalPaid       = invoices.filter((i) => i.status === 'PAID').reduce((s, i) => s + i.totalAmount, 0);
  const totalOverdue    = invoices.filter((i) => i.status === 'OVERDUE').reduce((s, i) => s + i.totalAmount, 0);
  const totalDraft      = invoices.filter((i) => i.status === 'DRAFT').reduce((s, i) => s + i.totalAmount, 0);
  const totalOutstanding = invoices.filter((i) => OUTSTANDING_STATUSES.includes(i.status)).reduce((s, i) => s + i.totalAmount, 0);

  // Monthly aggregation
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const monthly = months.map((m, idx) => {
    const monthDocs = invoices.filter((i) => new Date(i.issueDate).getUTCMonth() === idx);
    return {
      month: m,
      invoiced: monthDocs.reduce((s, i) => s + i.totalAmount, 0),
      paid:     monthDocs.filter((i) => i.status === 'PAID').reduce((s, i) => s + i.totalAmount, 0),
      overdue:  monthDocs.filter((i) => i.status === 'OVERDUE').reduce((s, i) => s + i.totalAmount, 0),
    };
  });

  // Top clients with names
  const clientIds = byClient.map((c) => c.clientId);
  const clientNames = await prisma.client.findMany({ where: { id: { in: clientIds } }, select: { id: true, companyName: true } });
  const nameMap = Object.fromEntries(clientNames.map((c) => [c.id, c.companyName]));
  const topClients = byClient.map((c) => ({ name: nameMap[c.clientId] || c.clientId, value: c._sum.totalAmount || 0 }));

  return json({
    kpis: { totalInvoiced, totalPaid, totalOverdue, totalDraft, totalOutstanding,
             collectionRate: totalInvoiced ? ((totalPaid / totalInvoiced) * 100).toFixed(1) : '0.0',
             totalDocuments: all.length, invoiceCount: invoices.length },
    monthly,
    topClients,
    byStatus: byStatus.map((s: any) => ({ name: s.status, value: s._sum.totalAmount || 0, count: s._count })),
    byType:   byType.map((t: any) => ({ name: t.docType.replace('_', ' '), value: t._sum.totalAmount || 0, count: t._count })),
  });
});

/* ─── GET /:id ────────────────────────────────────────────── */
export const get = handler<{ id: string }>(async (req, { params }) => {
  await requirePermission(req, 'invoices', 'view');
  const doc = await prisma.invoice.findUnique({ where: { id: params.id }, include: includeAll });
  if (!doc) return json({ error: 'Document not found' }, 404);
  return json(doc);
});

/* ─── scalar fields helper ────────────────────────────────── */
/** Optional text columns: '' / null clear them. */
const NULLABLE_TEXT = [
  'subject', 'description', 'terms', 'notes',
  'fromName', 'fromAddress', 'fromEmail', 'fromPhone', 'fromTaxNo', 'fromRegNo',
  'billingName', 'billingAddress', 'billingEmail', 'billingPhone',
  'logoText', 'watermark', 'footerText',
  'paymentRef', 'bankName', 'bankAccount', 'bankIBAN', 'bankSwift', 'bankRoutingNo', 'bankSortCode',
];
/** Text columns with a default: '' / null fall back to it. */
const DEFAULTED_TEXT: Record<string, string> = {
  status: 'DRAFT', currency: 'USD', taxLabel: 'VAT',
  template: 'classic', primaryColor: '#6366f1', accentColor: '#ffffff', fontFamily: 'helvetica',
  logoShape: 'rounded', tableStyle: 'striped', paymentMethod: 'BANK_TRANSFER',
};
const BOOLEANS: Record<string, boolean> = { showHeader: true, showFooter: true, showSignature: false };

const toBool = (v: any) => v === true || v === 'true' || v === 1 || v === '1' || v === 'on';

/**
 * Invoice header columns from the request body. With `partial`, only the keys
 * that were actually sent are returned (so a status-only update touches only
 * status); otherwise missing keys get their defaults (create).
 */
function scalarFields(rest: any, partial = false) {
  const has = (k: string) => rest[k] !== undefined;
  const out: any = {};
  if (!partial || has('clientId')) out.clientId = rest.clientId;
  for (const k of NULLABLE_TEXT) if (!partial || has(k)) out[k] = rest[k] || null;
  for (const [k, def] of Object.entries(DEFAULTED_TEXT)) if (!partial || has(k)) out[k] = rest[k] || def;
  for (const [k, def] of Object.entries(BOOLEANS)) if (!partial || has(k)) out[k] = has(k) && rest[k] !== null ? toBool(rest[k]) : def;
  if (!partial || has('watermarkOpacity')) {
    const n = toNumber(rest.watermarkOpacity, 'watermarkOpacity');
    out.watermarkOpacity = n !== undefined ? Math.round(n) : 12;
  }
  checkEnum(out.status, STATUSES, 'status');
  return out;
}

/* ─── POST /  create ──────────────────────────────────────── */
export const create = handler(async (req) => {
  await requirePermission(req, 'invoices', 'create');
  const { items = [], discountType = 'FIXED', discount = 0, taxRate = 0, docType = 'INVOICE', ...rest } = await body(req);
  if (!rest.clientId) return json({ error: 'clientId is required' }, 400);
  checkEnum(docType, DOC_TYPES, 'docType');
  checkEnum(discountType, DISCOUNT_TYPES, 'discountType');
  const discountNum = toNumber(discount, 'discount') ?? 0;
  const taxRateNum  = toNumber(taxRate, 'taxRate') ?? 0;
  const lines       = normaliseItems(items);
  const header      = scalarFields(rest);
  const issueDate   = toDate(rest.issueDate, 'issueDate');
  const dueDate     = toDate(rest.dueDate, 'dueDate');
  const validUntil  = toDate(rest.validUntil, 'validUntil');
  const totals      = calcTotals(lines, discountNum, discountType, taxRateNum);

  const client = await prisma.client.findUnique({ where: { id: rest.clientId }, select: { id: true } });
  if (!client) return json({ error: 'Client not found' }, 400);

  try {
    const doc = await withUniqueRetry(async (attempt) => prisma.invoice.create({
      data: {
        invoiceNo: await nextNumber(docType, attempt), docType,
        ...header,
        discountType, taxRate: taxRateNum,
        issueDate:  issueDate || new Date(),
        dueDate:    dueDate ?? null,
        validUntil: validUntil ?? null,
        ...(header.status === 'PAID' && { paidDate: new Date() }),
        ...totals,
        items: { create: lines },
      } as any,
      include: includeAll,
    }));
    return json(doc, 201);
  } catch (err: any) {
    return json({ error: err.message }, 400);
  }
});

/* ─── PUT /:id  update ────────────────────────────────────── */
export const update = handler<{ id: string }>(async (req, { params }) => {
  const user = await requirePermission(req, 'invoices', 'edit');
  const { items, discountType, discount, taxRate, accountId, ...rest } = await body(req);
  const existing = await prisma.invoice.findUnique({ where: { id: params.id } });
  if (!existing) return json({ error: 'Not found' }, 404);

  // Only the fields that were sent are updated (status-only saves from the list/detail pages).
  const update: any = scalarFields(rest, true);
  if (rest.clientId !== undefined && !rest.clientId) return json({ error: 'clientId cannot be empty' }, 400);
  if (rest.docType !== undefined) {
    checkEnum(rest.docType, DOC_TYPES, 'docType');
    update.docType = rest.docType;
  }
  const issueDate = toDate(rest.issueDate, 'issueDate');
  if (issueDate) update.issueDate = issueDate;
  if (rest.dueDate    !== undefined) update.dueDate    = toDate(rest.dueDate, 'dueDate');
  if (rest.validUntil !== undefined) update.validUntil = toDate(rest.validUntil, 'validUntil');
  checkEnum(discountType, DISCOUNT_TYPES, 'discountType');
  const discountNum = toNumber(discount, 'discount');
  const taxRateNum  = toNumber(taxRate, 'taxRate');
  const lines = items !== undefined ? normaliseItems(items) : undefined;

  const becomesPaid = update.status === 'PAID' && !existing.paidDate;
  if (becomesPaid && accountId) {
    const account = await prisma.bankAccount.findUnique({ where: { id: accountId } });
    if (!account) return json({ error: 'Account not found' }, 400);
    if (!account.isActive) return json({ error: 'Account is inactive' }, 400);
  }
  if (update.clientId) {
    const client = await prisma.client.findUnique({ where: { id: update.clientId }, select: { id: true } });
    if (!client) return json({ error: 'Client not found' }, 400);
  }

  try {
    const doc = await prisma.$transaction(async (tx) => {
      // Totals are recomputed whenever something they depend on changes.
      if (lines !== undefined || discountNum !== undefined || taxRateNum !== undefined || discountType !== undefined) {
        const effDiscount     = discountNum  ?? existing.discount;
        const effDiscountType = discountType ?? existing.discountType;
        const effTaxRate      = taxRateNum   ?? existing.taxRate;
        // A stored PERCENT discount is kept as an amount, so re-derive the percentage
        // only when the caller didn't send a new one and the type stays PERCENT.
        const baseItems = lines ?? await tx.invoiceItem.findMany({ where: { invoiceId: params.id } });
        let discountArg: number = effDiscount;
        if (discountNum === undefined && effDiscountType === 'PERCENT' && existing.discountType === 'PERCENT' && existing.subtotal) {
          discountArg = (existing.discount / existing.subtotal) * 100;
        }
        const totals = calcTotals(baseItems, discountArg, effDiscountType, effTaxRate);
        Object.assign(update, totals, { discountType: effDiscountType, taxRate: effTaxRate });
      }

      if (lines !== undefined) {
        // Replace items
        await tx.invoiceItem.deleteMany({ where: { invoiceId: params.id } });
        await tx.invoiceItem.createMany({ data: lines.map((it) => ({ ...it, invoiceId: params.id })) });
      }

      // Claim the DRAFT/SENT/... -> PAID transition atomically so a concurrent
      // re-save can't post the payment twice.
      let claimedPayment = false;
      if (becomesPaid) {
        const claimed = await tx.invoice.updateMany({ where: { id: params.id, paidDate: null }, data: { paidDate: new Date() } });
        claimedPayment = claimed.count === 1;
      }

      const saved = await tx.invoice.update({ where: { id: params.id }, data: update, include: includeAll });

      // Only post a cash-in transaction on the actual transition to PAID (not a
      // no-op re-save of an already-paid invoice), and only when the caller
      // opted in with an accountId.
      if (claimedPayment && accountId) {
        await tx.accountTransaction.create({
          data: {
            accountId,
            type: 'INVOICE_PAYMENT',
            amount: saved.totalAmount,
            description: `Payment received for ${saved.invoiceNo}`,
            relatedInvoiceId: saved.id,
            createdBy: user.id,
          },
        });
      }
      return saved;
    }, TX_OPTIONS);

    return json(doc);
  } catch (err: any) {
    if (err?.code === 'P2025') return json({ error: 'Not found' }, 404);
    return json({ error: err.message }, 400);
  }
});

/* ─── DELETE /:id ─────────────────────────────────────────── */
export const remove = handler<{ id: string }>(async (req, { params }) => {
  await requirePermission(req, 'invoices', 'delete');
  try {
    await prisma.invoice.delete({ where: { id: params.id } });
    return json({ message: 'Deleted' });
  } catch {
    return json({ error: 'Not found' }, 404);
  }
});

/* ─── POST /:id/duplicate ─────────────────────────────────── */
export const duplicate = handler<{ id: string }>(async (req, { params }) => {
  await requirePermission(req, 'invoices', 'create');
  const src   = await prisma.invoice.findUnique({ where: { id: params.id }, include: { items: true } });
  if (!src) return json({ error: 'Not found' }, 404);
  try {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, createdAt, updatedAt, paidDate, invoiceNo: _no, items: srcItems, ...srcData } = src;
    const doc = await withUniqueRetry(async (attempt) => prisma.invoice.create({
      data: {
        ...srcData,
        invoiceNo: await nextNumber(src.docType, attempt),
        status: 'DRAFT',
        issueDate: new Date(),
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        items: { create: srcItems.map(({ id: _id, invoiceId: _iv, createdAt: _c, ...item }: any) => item) },
      } as any,
      include: includeAll,
    }));
    return json(doc, 201);
  } catch (err: any) {
    return json({ error: err.message }, 400);
  }
});
