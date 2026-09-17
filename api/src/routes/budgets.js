const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');

const prisma = new PrismaClient();

/* ─── helpers ─────────────────────────────────────────────── */
/**
 * Period -> [gte, lt) date range.
 * MONTHLY needs year+month, QUARTERLY needs year+quarter (1-4), YEARLY needs year.
 */
function periodRange(period, year, month, quarter) {
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
 * Reused directly by GET /vs-actual and importable by reports.js for GET /finance.
 */
async function computeVsActual({ year, period, month, quarter }) {
  const where = {};
  if (year !== undefined && year !== null && year !== '') where.year = parseInt(year);
  if (period) where.period = period;
  if (month !== undefined && month !== null && month !== '') where.month = parseInt(month);
  if (quarter !== undefined && quarter !== null && quarter !== '') where.quarter = parseInt(quarter);

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
    })
  );

  results.sort((a, b) => a.category.localeCompare(b.category));
  return results;
}

/* ─── GET /  list ─────────────────────────────────────────── */
router.get('/', authenticate, async (req, res) => {
  try {
    const { year, period, month, quarter } = req.query;
    const where = {};
    if (year !== undefined && year !== '') where.year = parseInt(year);
    if (period) where.period = period;
    if (month !== undefined && month !== '') where.month = parseInt(month);
    if (quarter !== undefined && quarter !== '') where.quarter = parseInt(quarter);

    const budgets = await prisma.budget.findMany({ where, orderBy: [{ year: 'desc' }, { category: 'asc' }] });
    res.json(budgets);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ─── GET /vs-actual ──────────────────────────────────────── */
router.get('/vs-actual', authenticate, async (req, res) => {
  try {
    const { year, period, month, quarter } = req.query;
    const results = await computeVsActual({ year, period, month, quarter });
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ─── POST /  upsert-like create ─────────────────────────────
 * Avoids duplicate lines for the same category+period since Postgres treats
 * each NULL as distinct in a unique constraint (month/quarter are often NULL). */
router.post('/', authenticate, async (req, res) => {
  try {
    const { category, period, year, month, quarter, amount, notes } = req.body || {};
    if (!category || amount == null) return res.status(400).json({ error: 'category and amount are required' });
    if (year === undefined || year === null || year === '') return res.status(400).json({ error: 'year is required' });

    const p = period || 'MONTHLY';
    const y = parseInt(year);
    const m = month !== undefined && month !== null && month !== '' ? parseInt(month) : null;
    const q = quarter !== undefined && quarter !== null && quarter !== '' ? parseInt(quarter) : null;
    const amt = parseFloat(amount);

    const existing = await prisma.budget.findFirst({
      where: { category, period: p, year: y, month: m, quarter: q },
    });

    if (existing) {
      const updated = await prisma.budget.update({
        where: { id: existing.id },
        data: { amount: amt, notes: notes !== undefined ? notes : existing.notes },
      });
      return res.status(200).json(updated);
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
        createdBy: req.user.id,
      },
    });
    res.status(201).json(created);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/* ─── PUT /:id  direct update ─────────────────────────────── */
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { category, period, year, month, quarter, amount, notes } = req.body || {};
    const data = {};
    if (category !== undefined) data.category = category;
    if (period !== undefined) data.period = period;
    if (year !== undefined) data.year = parseInt(year);
    if (month !== undefined) data.month = month === null || month === '' ? null : parseInt(month);
    if (quarter !== undefined) data.quarter = quarter === null || quarter === '' ? null : parseInt(quarter);
    if (amount !== undefined) data.amount = parseFloat(amount);
    if (notes !== undefined) data.notes = notes;

    const budget = await prisma.budget.update({ where: { id: req.params.id }, data });
    res.json(budget);
  } catch {
    res.status(404).json({ error: 'Budget not found' });
  }
});

/* ─── DELETE /:id ─────────────────────────────────────────── */
router.delete('/:id', authenticate, async (req, res) => {
  try {
    await prisma.budget.delete({ where: { id: req.params.id } });
    res.json({ message: 'Budget deleted' });
  } catch {
    res.status(404).json({ error: 'Budget not found' });
  }
});

module.exports = router;
// Non-breaking named export for reuse by reports.js (router itself remains the default/only export shape index.js expects).
module.exports.computeVsActual = computeVsActual;
