// Ported from api/src/routes/expenses.js
import { unlink } from 'fs/promises';
import { prisma } from '@/lib/prisma';
import { ExpenseCategory } from '@/generated/prisma/client';
import { hasPermission, requirePermission } from '../permissions';
import { body, handler, HttpError, json, query } from '../http';
import { absoluteUploadPath, parseUpload } from '../upload';
import { pagination, toDate, toNumber } from '../validate';

/* ─── helpers ─────────────────────────────────────────────── */
/** Interactive transactions do several round-trips; allow for a slow database. */
const TX_OPTIONS = { maxWait: 10_000, timeout: 30_000 };
const CATEGORIES = Object.values(ExpenseCategory) as string[];

/**
 * Next expense number ("latest + 1"). `attempt` skips ahead when a concurrent
 * request grabbed the same number (see create's retry loop).
 */
async function nextExpenseNo(attempt = 0) {
  const yr = new Date().getFullYear();
  const last = await prisma.expense.findFirst({
    where: { expenseNo: { startsWith: `EXP-${yr}-` } },
    orderBy: { createdAt: 'desc' },
  });
  const seq = (last ? parseInt(last.expenseNo.split('-').pop() || '0') || 0 : 0) + 1 + attempt;
  return `EXP-${yr}-${String(seq).padStart(4, '0')}`;
}

function checkCategory(category: any) {
  if (!CATEGORIES.includes(category)) throw new HttpError(400, `category must be one of ${CATEGORIES.join(', ')}`);
}

function nonNegative(value: any, field: string) {
  const n = toNumber(value, field);
  if (n !== undefined && n < 0) throw new HttpError(400, `${field} cannot be negative`);
  return n;
}

/** Best-effort removal of a stored receipt file. */
async function removeReceipt(receiptPath: string | null) {
  if (!receiptPath) return;
  try { await unlink(absoluteUploadPath(receiptPath)); } catch { /* already gone */ }
}

const includeAll = {
  account: { select: { id: true, name: true, type: true } },
  approvedBy: { select: { id: true, name: true } },
};

/* ─── GET /  list ─────────────────────────────────────────── */
export const list = handler(async (req) => {
  await requirePermission(req, 'finance', 'view');
  const q = query(req);
  const { category, status, vendor, dateFrom, dateTo, search } = q;
  const where: any = {};
  if (category) where.category = category;
  if (status) where.status = status;
  if (vendor) where.vendor = { contains: vendor, mode: 'insensitive' };
  if (dateFrom || dateTo) {
    where.date = {};
    if (dateFrom) where.date.gte = toDate(dateFrom, 'dateFrom');
    if (dateTo) where.date.lte = toDate(dateTo, 'dateTo');
  }
  if (search) {
    where.OR = [
      { expenseNo: { contains: search, mode: 'insensitive' } },
      { vendor: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ];
  }
  const { page, limit, skip } = pagination(q, { defaultLimit: 50 });

  const [data, total] = await Promise.all([
    prisma.expense.findMany({ where, skip, take: limit, orderBy: { date: 'desc' }, include: includeAll }),
    prisma.expense.count({ where }),
  ]);
  return json({ data, total, page, limit });
});

/* ─── GET /stats  (year-scoped KPIs) ─────────────────────────── */
export const stats = handler(async (req) => {
  await requirePermission(req, 'finance', 'view');
  const year = parseInt(query(req).year) || new Date().getFullYear();
  const expenses = await prisma.expense.findMany({
    where: { date: { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) } },
  });

  const total = expenses.reduce((s, e) => s + e.totalAmount, 0);
  const paid = expenses.filter((e) => e.status === 'PAID').reduce((s, e) => s + e.totalAmount, 0);
  const pending = expenses.filter((e) => ['PENDING_APPROVAL', 'APPROVED'].includes(e.status)).reduce((s, e) => s + e.totalAmount, 0);

  const byCategory = Object.values(
    expenses.reduce((acc: Record<string, any>, e) => {
      acc[e.category] = acc[e.category] || { category: e.category, amount: 0, count: 0 };
      acc[e.category].amount += e.totalAmount;
      acc[e.category].count += 1;
      return acc;
    }, {}),
  );

  const byStatus = Object.values(
    expenses.reduce((acc: Record<string, any>, e) => {
      acc[e.status] = acc[e.status] || { status: e.status, amount: 0, count: 0 };
      acc[e.status].amount += e.totalAmount;
      acc[e.status].count += 1;
      return acc;
    }, {}),
  );

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthly = months.map((m, idx) => ({
    month: m,
    amount: expenses.filter((e) => new Date(e.date).getMonth() === idx).reduce((s, e) => s + e.totalAmount, 0),
  }));

  return json({ total, paid, pending, count: expenses.length, byCategory, byStatus, monthly });
});

/* ─── GET /:id ────────────────────────────────────────────── */
export const get = handler<{ id: string }>(async (req, { params }) => {
  await requirePermission(req, 'finance', 'view');
  const expense = await prisma.expense.findUnique({ where: { id: params.id }, include: includeAll });
  if (!expense) return json({ error: 'Expense not found' }, 404);
  return json(expense);
});

/* ─── POST /  create ──────────────────────────────────────── */
export const create = handler(async (req) => {
  const user = await requirePermission(req, 'finance', 'create');
  const { category, vendor, description, amount, taxAmount, date, dueDate, notes, isRecurring, recurrenceInterval } = await body(req);
  if (!category || !description || amount == null || amount === '' || !date) {
    return json({ error: 'category, description, amount and date are required' }, 400);
  }
  checkCategory(category);
  const amt = nonNegative(amount, 'amount')!;
  const tax = nonNegative(taxAmount, 'taxAmount') ?? 0;
  const expenseDate = toDate(date, 'date')!;
  const due = toDate(dueDate, 'dueDate') ?? null;

  try {
    // expenseNo is "latest + 1": retry on a unique clash with a concurrent create.
    for (let attempt = 0; ; attempt++) {
      try {
        const expense = await prisma.expense.create({
          data: {
            expenseNo: await nextExpenseNo(attempt),
            category,
            vendor: vendor || null,
            description,
            amount: amt,
            taxAmount: tax,
            totalAmount: amt + tax,
            date: expenseDate,
            dueDate: due,
            notes: notes || null,
            isRecurring: isRecurring === true || isRecurring === 'true',
            recurrenceInterval: recurrenceInterval || null,
            status: 'DRAFT',
            createdBy: user.id,
          },
          include: includeAll,
        });
        return json(expense, 201);
      } catch (err: any) {
        if (err?.code !== 'P2002' || attempt >= 4) throw err;
      }
    }
  } catch (err: any) {
    return json({ error: err.message }, 400);
  }
});

/* ─── PUT /:id  update ────────────────────────────────────── */
export const update = handler<{ id: string }>(async (req, { params }) => {
  const user = await requirePermission(req, 'finance', 'edit');
  const existing = await prisma.expense.findUnique({ where: { id: params.id } });
  if (!existing) return json({ error: 'Expense not found' }, 404);

  const { category, vendor, description, amount, taxAmount, date, dueDate, notes, isRecurring, recurrenceInterval, status } = await body(req);
  const data: any = {};
  if (category !== undefined) {
    checkCategory(category);
    data.category = category;
  }
  if (vendor !== undefined) data.vendor = vendor || null;
  if (description !== undefined) {
    if (!description) return json({ error: 'description cannot be empty' }, 400);
    data.description = description;
  }
  if (date !== undefined) {
    const d = toDate(date, 'date');
    if (!d) return json({ error: 'date cannot be empty' }, 400);
    data.date = d;
  }
  if (dueDate !== undefined) data.dueDate = toDate(dueDate, 'dueDate');
  if (notes !== undefined) data.notes = notes || null;
  if (isRecurring !== undefined) data.isRecurring = isRecurring === true || isRecurring === 'true';
  if (recurrenceInterval !== undefined) data.recurrenceInterval = recurrenceInterval || null;
  if (status !== undefined && status !== existing.status) {
    // Approval and payment go through the role-restricted /approve and /pay endpoints.
    if (status === 'REJECTED') {
      if (!(await hasPermission(user, 'finance', 'approve'))) return json({ error: 'Insufficient permissions' }, 403);
    } else if (status !== 'DRAFT' && status !== 'PENDING_APPROVAL') {
      return json({ error: 'status can only be set to DRAFT, PENDING_APPROVAL or REJECTED here; use /approve or /pay' }, 400);
    }
    if (existing.status === 'PAID') return json({ error: 'A paid expense cannot change status' }, 400);
    data.status = status;
  }

  const effAmount = amount !== undefined ? nonNegative(amount, 'amount') ?? existing.amount : existing.amount;
  const effTax = taxAmount !== undefined ? nonNegative(taxAmount, 'taxAmount') ?? 0 : existing.taxAmount;
  if (amount !== undefined) data.amount = effAmount;
  if (taxAmount !== undefined) data.taxAmount = effTax;
  if (amount !== undefined || taxAmount !== undefined) data.totalAmount = effAmount + effTax;
  if (existing.status === 'PAID' && data.totalAmount !== undefined && data.totalAmount !== existing.totalAmount) {
    return json({ error: 'The amount of a paid expense cannot be changed' }, 400);
  }

  try {
    const expense = await prisma.expense.update({ where: { id: params.id }, data, include: includeAll });
    return json(expense);
  } catch (err: any) {
    return json({ error: err.message }, 400);
  }
});

/* ─── PATCH /:id/approve ──────────────────────────────────── */
export const approve = handler<{ id: string }>(async (req, { params }) => {
  const user = await requirePermission(req, 'finance', 'approve');
  const existing = await prisma.expense.findUnique({ where: { id: params.id } });
  if (!existing) return json({ error: 'Expense not found' }, 404);
  if (existing.status !== 'DRAFT' && existing.status !== 'PENDING_APPROVAL') {
    return json({ error: `Only draft or pending expenses can be approved (this one is ${existing.status})` }, 400);
  }
  const expense = await prisma.expense.update({
    where: { id: params.id },
    data: { status: 'APPROVED', approvedByUserId: user.id },
    include: includeAll,
  });
  return json(expense);
});

/* ─── PATCH /:id/pay  (optionally posts an AccountTransaction) ── */
export const pay = handler<{ id: string }>(async (req, { params }) => {
  const user = await requirePermission(req, 'finance', 'approve');
  const existing = await prisma.expense.findUnique({ where: { id: params.id } });
  if (!existing) return json({ error: 'Expense not found' }, 404);
  if (existing.status === 'PAID') return json({ error: 'Expense is already marked paid' }, 400);
  if (existing.status !== 'APPROVED') {
    return json({ error: `Only approved expenses can be paid (this one is ${existing.status})` }, 400);
  }

  const { accountId, paymentMethod, paymentRef } = await body(req);
  if (accountId) {
    const account = await prisma.bankAccount.findUnique({ where: { id: accountId } });
    if (!account) return json({ error: 'Account not found' }, 400);
    if (!account.isActive) return json({ error: 'Account is inactive' }, 400);
  }

  try {
    const expense = await prisma.$transaction(async (tx) => {
      // Claim the transition so two concurrent pay requests can't both post a payment.
      const claimed = await tx.expense.updateMany({
        where: { id: params.id, status: 'APPROVED' },
        data: { status: 'PAID', paidDate: new Date() },
      });
      if (claimed.count !== 1) throw new HttpError(400, 'Expense is already marked paid');
      const updated = await tx.expense.update({
        where: { id: params.id },
        data: {
          accountId: accountId || undefined,
          paymentMethod: paymentMethod || existing.paymentMethod,
          paymentRef: paymentRef || existing.paymentRef,
        },
        include: includeAll,
      });
      if (accountId) {
        await tx.accountTransaction.create({
          data: {
            accountId,
            type: 'EXPENSE_PAYMENT',
            amount: -Math.abs(existing.totalAmount),
            description: `Payment for ${existing.expenseNo} — ${existing.description}`,
            relatedExpenseId: existing.id,
            createdBy: user.id,
          },
        });
      }
      return updated;
    }, TX_OPTIONS);
    return json(expense);
  } catch (err: any) {
    if (err instanceof HttpError) throw err;
    return json({ error: err.message }, 400);
  }
});

/* ─── POST /:id/receipt  (upload/replace the receipt attachment) ── */
export const uploadReceipt = handler<{ id: string }>(async (req, { params }) => {
  await requirePermission(req, 'finance', 'edit');
  // Check the expense first so a bad id doesn't leave an orphaned file on disk.
  const existing = await prisma.expense.findUnique({ where: { id: params.id }, select: { receiptPath: true } });
  if (!existing) return json({ error: 'Expense not found' }, 404);
  const { file } = await parseUpload(req, ['file']);
  if (!file) return json({ error: 'File is required' }, 400);
  try {
    const expense = await prisma.expense.update({
      where: { id: params.id },
      data: { receiptPath: file.path },
      include: includeAll,
    });
    if (existing.receiptPath && existing.receiptPath !== file.path) await removeReceipt(existing.receiptPath);
    return json(expense);
  } catch {
    await removeReceipt(file.path);
    return json({ error: 'Expense not found' }, 404);
  }
});

/* ─── DELETE /:id ─────────────────────────────────────────── */
export const remove = handler<{ id: string }>(async (req, { params }) => {
  await requirePermission(req, 'finance', 'delete');
  const existing = await prisma.expense.findUnique({ where: { id: params.id } });
  if (!existing) return json({ error: 'Expense not found' }, 404);
  const txnCount = await prisma.accountTransaction.count({ where: { relatedExpenseId: params.id } });
  if (txnCount > 0) {
    return json({ error: 'This expense has a posted payment transaction and cannot be deleted.' }, 400);
  }
  try {
    await prisma.expense.delete({ where: { id: params.id } });
    await removeReceipt(existing.receiptPath);
    return json({ message: 'Expense deleted' });
  } catch {
    return json({ error: 'Expense not found' }, 404);
  }
});
