// Ported from api/src/routes/budgets.js
import { prisma } from '@/lib/prisma';
import { ExpenseCategory } from '@/generated/prisma/client';
import { requirePermission } from '../permissions';
import { body, handler, HttpError, json, query } from '../http';
import { toNumber } from '../validate';

/* ─── helpers ─────────────────────────────────────────────── */
const CATEGORIES = Object.values(ExpenseCategory) as string[];
const PERIODS = ['MONTHLY', 'QUARTERLY', 'YEARLY'];

const isBlank = (v: any) => v === undefined || v === null || v === '';

/** Integer param in [min, max]; undefined when blank, 400 when invalid. */
function intParam(value: any, field: string, min: number, max: number) {
  if (isBlank(value)) return undefined;
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) throw new HttpError(400, `${field} must be an integer between ${min} and ${max}`);
  return n;
}

/** Validates the period filters shared by GET / and GET /vs-actual. */
function periodFilters(q: Record<string, any>) {
  if (q.period && !PERIODS.includes(q.period)) throw new HttpError(400, `period must be one of ${PERIODS.join(', ')}`);
  return {
    year: intParam(q.year, 'year', 1900, 9999),
    period: q.period || undefined,
    month: intParam(q.month, 'month', 1, 12),
    quarter: intParam(q.quarter, 'quarter', 1, 4),
  };
}

/**
 * Validates a budget's category/period/year/month/quarter/amount and returns the
 * normalised values: MONTHLY keeps only month, QUARTERLY only quarter, YEARLY neither.
 */
function budgetFields(v: { category: any; period: any; year: any; month: any; quarter: any; amount: any }) {
  if (!CATEGORIES.includes(v.category)) throw new HttpError(400, `category must be one of ${CATEGORIES.join(', ')}`);
  if (!PERIODS.includes(v.period)) throw new HttpError(400, `period must be one of ${PERIODS.join(', ')}`);
  const year = intParam(v.year, 'year', 1900, 9999);
  if (year === undefined) throw new HttpError(400, 'year is required');
  const month = v.period === 'MONTHLY' ? intParam(v.month, 'month', 1, 12) ?? null : null;
  const quarter = v.period === 'QUARTERLY' ? intParam(v.quarter, 'quarter', 1, 4) ?? null : null;
  if (v.period === 'MONTHLY' && month === null) throw new HttpError(400, 'month is required for a MONTHLY budget');
  if (v.period === 'QUARTERLY' && quarter === null) throw new HttpError(400, 'quarter is required for a QUARTERLY budget');
  const amount = toNumber(v.amount, 'amount');
  if (amount === undefined) throw new HttpError(400, 'amount is required');
  if (amount < 0) throw new HttpError(400, 'amount cannot be negative');
  return { category: v.category, period: v.period, year, month, quarter, amount };
}

/**
 * Period -> [gte, lt) date range.
 * MONTHLY needs year+month, QUARTERLY needs year+quarter (1-4), YEARLY needs year.
 */
function periodRange(period: string, year: any, month: any, quarter: any) {
  const y = parseInt(year);
  if (period === 'MONTHLY') {
    const m = parseInt(month);
    return { gte: new Date(y, m - 1, 1), lt: new Date(y, m, 1) };
  }
  if (period === 'QUARTERLY') {
    const q = parseInt(quarter);
    return { gte: new Date(y, (q - 1) * 3, 1), lt: new Date(y, (q - 1) * 3 + 3, 1) };
  }
  // YEARLY
  return { gte: new Date(y, 0, 1), lt: new Date(y + 1, 0, 1) };
}

/**
 * Computes budget-vs-actual for every Budget row matching the given filters.
 * Reused directly by GET /vs-actual and by the reports controller for GET /finance.
 */
export async function computeVsActual({ year, period, month, quarter }: { year?: any; period?: any; month?: any; quarter?: any }) {
  const where: any = {};
  const int = (v: any) => (isBlank(v) || Number.isNaN(parseInt(v)) ? undefined : parseInt(v));
  if (int(year) !== undefined) where.year = int(year);
  if (period) where.period = period;
  if (int(month) !== undefined) where.month = int(month);
  if (int(quarter) !== undefined) where.quarter = int(quarter);

  const budgets = await prisma.budget.findMany({ where, orderBy: { category: 'asc' } });

  const results = await Promise.all(
    budgets.map(async (b) => {
      const range = periodRange(b.period, b.year, b.month, b.quarter);
      const agg = await prisma.expense.aggregate({
        where: {
          category: b.category,
          status: { notIn: ['DRAFT', 'REJECTED'] },
          date: { gte: range.gte, lt: range.lt },
        },
        _sum: { totalAmount: true },
      });
      const actual = agg._sum.totalAmount || 0;
      return {
        id: b.id,
        category: b.category,
        period: b.period,
        year: b.year,
        month: b.month,
        quarter: b.quarter,
        budgeted: b.amount,
        actual,
        variance: b.amount - actual,
        pctUsed: b.amount ? (actual / b.amount) * 100 : 0,
      };
    }),
  );

  results.sort((a, b) => a.category.localeCompare(b.category));
  return results;
}

/* ─── GET /  list ─────────────────────────────────────────── */
export const list = handler(async (req) => {
  await requirePermission(req, 'finance', 'view');
  const { year, period, month, quarter } = periodFilters(query(req));
  const where: any = {};
  if (year !== undefined) where.year = year;
  if (period) where.period = period;
  if (month !== undefined) where.month = month;
  if (quarter !== undefined) where.quarter = quarter;

  const budgets = await prisma.budget.findMany({ where, orderBy: [{ year: 'desc' }, { category: 'asc' }] });
  return json(budgets);
});

/* ─── GET /vs-actual ──────────────────────────────────────── */
export const vsActual = handler(async (req) => {
  await requirePermission(req, 'finance', 'view');
  const results = await computeVsActual(periodFilters(query(req)));
  return json(results);
});

/* ─── POST /  upsert-like create ─────────────────────────────
 * Avoids duplicate lines for the same category+period since Postgres treats
 * each NULL as distinct in a unique constraint (month/quarter are often NULL). */
export const create = handler(async (req) => {
  const user = await requirePermission(req, 'finance', 'create');
  const { category, period, year, month, quarter, amount, notes } = await body(req);
  if (!category || isBlank(amount)) return json({ error: 'category and amount are required' }, 400);
  if (isBlank(year)) return json({ error: 'year is required' }, 400);
  const { period: p, year: y, month: m, quarter: q, amount: amt } =
    budgetFields({ category, period: period || 'MONTHLY', year, month, quarter, amount });

  try {
    const existing = await prisma.budget.findFirst({
      where: { category, period: p, year: y, month: m, quarter: q },
    });

    if (existing) {
      const updated = await prisma.budget.update({
        where: { id: existing.id },
        data: { amount: amt, notes: notes !== undefined ? notes : existing.notes },
      });
      return json(updated, 200);
    }

    const created = await prisma.budget.create({
      data: {
        category,
        period: p,
        year: y,
        month: m,
        quarter: q,
        amount: amt,
        notes: notes || null,
        createdBy: user.id,
      },
    });
    return json(created, 201);
  } catch (err: any) {
    return json({ error: err.message }, 400);
  }
});

/* ─── PUT /:id  direct update ─────────────────────────────── */
export const update = handler<{ id: string }>(async (req, { params }) => {
  await requirePermission(req, 'finance', 'edit');
  const existing = await prisma.budget.findUnique({ where: { id: params.id } });
  if (!existing) return json({ error: 'Budget not found' }, 404);

  const { category, period, year, month, quarter, amount, notes } = await body(req);
  // Validate the merged result so a partial update can't leave an inconsistent period.
  const merged = budgetFields({
    category: category ?? existing.category,
    period: period ?? existing.period,
    year: year ?? existing.year,
    month: month !== undefined ? month : existing.month,
    quarter: quarter !== undefined ? quarter : existing.quarter,
    amount: amount ?? existing.amount,
  });
  const data: any = { ...merged };
  if (notes !== undefined) data.notes = notes || null;

  try {
    const budget = await prisma.budget.update({ where: { id: params.id }, data });
    return json(budget);
  } catch (err: any) {
    if (err?.code === 'P2025') return json({ error: 'Budget not found' }, 404);
    return json({ error: err.message }, 400);
  }
});

/* ─── DELETE /:id ─────────────────────────────────────────── */
export const remove = handler<{ id: string }>(async (req, { params }) => {
  await requirePermission(req, 'finance', 'delete');
  try {
    await prisma.budget.delete({ where: { id: params.id } });
    return json({ message: 'Budget deleted' });
  } catch {
    return json({ error: 'Budget not found' }, 404);
  }
});
