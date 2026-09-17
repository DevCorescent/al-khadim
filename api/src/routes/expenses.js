const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const { authenticate, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');

const prisma = new PrismaClient();

/* ─── helpers ─────────────────────────────────────────────── */
async function nextExpenseNo() {
  const yr = new Date().getFullYear();
  const last = await prisma.expense.findFirst({
    where: { expenseNo: { startsWith: `EXP-${yr}-` } },
    orderBy: { createdAt: 'desc' },
  });
  const seq = last ? parseInt(last.expenseNo.split('-').pop() || '0') + 1 : 1;
  return `EXP-${yr}-${String(seq).padStart(4, '0')}`;
}

const includeAll = {
  account: { select: { id: true, name: true, type: true } },
  approvedBy: { select: { id: true, name: true } },
};

/* ─── GET /  list ─────────────────────────────────────────── */
router.get('/', authenticate, async (req, res) => {
  const { category, status, vendor, dateFrom, dateTo, search, page = 1, limit = 50 } = req.query;
  const where = {};
  if (category) where.category = category;
  if (status) where.status = status;
  if (vendor) where.vendor = { contains: vendor, mode: 'insensitive' };
  if (dateFrom || dateTo) {
    where.date = {};
    if (dateFrom) where.date.gte = new Date(dateFrom);
    if (dateTo) where.date.lte = new Date(dateTo);
  }
  if (search) {
    where.OR = [
      { expenseNo: { contains: search, mode: 'insensitive' } },
      { vendor: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ];
  }
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [data, total] = await Promise.all([
    prisma.expense.findMany({ where, skip, take: parseInt(limit), orderBy: { date: 'desc' }, include: includeAll }),
    prisma.expense.count({ where }),
  ]);
  res.json({ data, total, page: parseInt(page), limit: parseInt(limit) });
});

/* ─── GET /stats  (year-scoped KPIs) ─────────────────────────── */
router.get('/stats', authenticate, async (req, res) => {
  const year = parseInt(req.query.year) || new Date().getFullYear();
  const expenses = await prisma.expense.findMany({
    where: { date: { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) } },
  });

  const total = expenses.reduce((s, e) => s + e.totalAmount, 0);
  const paid = expenses.filter((e) => e.status === 'PAID').reduce((s, e) => s + e.totalAmount, 0);
  const pending = expenses.filter((e) => ['PENDING_APPROVAL', 'APPROVED'].includes(e.status)).reduce((s, e) => s + e.totalAmount, 0);

  const byCategory = Object.values(
    expenses.reduce((acc, e) => {
      acc[e.category] = acc[e.category] || { category: e.category, amount: 0, count: 0 };
      acc[e.category].amount += e.totalAmount;
      acc[e.category].count += 1;
      return acc;
    }, {})
  );

  const byStatus = Object.values(
    expenses.reduce((acc, e) => {
      acc[e.status] = acc[e.status] || { status: e.status, amount: 0, count: 0 };
      acc[e.status].amount += e.totalAmount;
      acc[e.status].count += 1;
      return acc;
    }, {})
  );

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthly = months.map((m, idx) => ({
    month: m,
    amount: expenses.filter((e) => new Date(e.date).getMonth() === idx).reduce((s, e) => s + e.totalAmount, 0),
  }));

  res.json({ total, paid, pending, count: expenses.length, byCategory, byStatus, monthly });
});

/* ─── GET /:id ────────────────────────────────────────────── */
router.get('/:id', authenticate, async (req, res) => {
  const expense = await prisma.expense.findUnique({ where: { id: req.params.id }, include: includeAll });
  if (!expense) return res.status(404).json({ error: 'Expense not found' });
  res.json(expense);
});

/* ─── POST /  create ──────────────────────────────────────── */
router.post('/', authenticate, async (req, res) => {
  try {
    const { category, vendor, description, amount, taxAmount, date, dueDate, notes, isRecurring, recurrenceInterval } = req.body || {};
    if (!category || !description || amount == null || !date) {
      return res.status(400).json({ error: 'category, description, amount and date are required' });
    }
    const amt = parseFloat(amount);
    const tax = parseFloat(taxAmount || 0);
    const expenseNo = await nextExpenseNo();

    const expense = await prisma.expense.create({
      data: {
        expenseNo,
        category,
        vendor: vendor || null,
        description,
        amount: amt,
        taxAmount: tax,
        totalAmount: amt + tax,
        date: new Date(date),
        dueDate: dueDate ? new Date(dueDate) : null,
        notes: notes || null,
        isRecurring: !!isRecurring,
        recurrenceInterval: recurrenceInterval || null,
        status: 'DRAFT',
        createdBy: req.user.id,
      },
      include: includeAll,
    });
    res.status(201).json(expense);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/* ─── PUT /:id  update ────────────────────────────────────── */
router.put('/:id', authenticate, async (req, res) => {
  try {
    const existing = await prisma.expense.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Expense not found' });

    const { category, vendor, description, amount, taxAmount, date, dueDate, notes, isRecurring, recurrenceInterval, status } = req.body || {};
    const data = {};
    if (category !== undefined) data.category = category;
    if (vendor !== undefined) data.vendor = vendor || null;
    if (description !== undefined) data.description = description;
    if (date !== undefined) data.date = new Date(date);
    if (dueDate !== undefined) data.dueDate = dueDate ? new Date(dueDate) : null;
    if (notes !== undefined) data.notes = notes;
    if (isRecurring !== undefined) data.isRecurring = !!isRecurring;
    if (recurrenceInterval !== undefined) data.recurrenceInterval = recurrenceInterval || null;
    if (status !== undefined) data.status = status;

    const effAmount = amount !== undefined ? parseFloat(amount) : existing.amount;
    const effTax = taxAmount !== undefined ? parseFloat(taxAmount) : existing.taxAmount;
    if (amount !== undefined) data.amount = effAmount;
    if (taxAmount !== undefined) data.taxAmount = effTax;
    if (amount !== undefined || taxAmount !== undefined) data.totalAmount = effAmount + effTax;

    const expense = await prisma.expense.update({ where: { id: req.params.id }, data, include: includeAll });
    res.json(expense);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/* ─── PATCH /:id/approve ──────────────────────────────────── */
router.patch('/:id/approve', authenticate, authorize('SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT'), async (req, res) => {
  try {
    const expense = await prisma.expense.update({
      where: { id: req.params.id },
      data: { status: 'APPROVED', approvedByUserId: req.user.id },
      include: includeAll,
    });
    res.json(expense);
  } catch {
    res.status(404).json({ error: 'Expense not found' });
  }
});

/* ─── PATCH /:id/pay  (optionally posts an AccountTransaction) ── */
router.patch('/:id/pay', authenticate, authorize('SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT'), async (req, res) => {
  const existing = await prisma.expense.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: 'Expense not found' });
  if (existing.status === 'PAID') return res.status(400).json({ error: 'Expense is already marked paid' });

  const { accountId, paymentMethod, paymentRef } = req.body || {};

  try {
    const [expense] = await prisma.$transaction([
      prisma.expense.update({
        where: { id: req.params.id },
        data: {
          status: 'PAID',
          paidDate: new Date(),
          accountId: accountId || undefined,
          paymentMethod: paymentMethod || existing.paymentMethod,
          paymentRef: paymentRef || existing.paymentRef,
        },
        include: includeAll,
      }),
      ...(accountId
        ? [
            prisma.accountTransaction.create({
              data: {
                accountId,
                type: 'EXPENSE_PAYMENT',
                amount: -Math.abs(existing.totalAmount),
                description: `Payment for ${existing.expenseNo} — ${existing.description}`,
                relatedExpenseId: existing.id,
                createdBy: req.user.id,
              },
            }),
          ]
        : []),
    ]);
    res.json(expense);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/* ─── POST /:id/receipt  (upload/replace the receipt attachment) ── */
router.post('/:id/receipt', authenticate, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'File is required' });
  try {
    const expense = await prisma.expense.update({
      where: { id: req.params.id },
      data: { receiptPath: req.file.path },
      include: includeAll,
    });
    res.json(expense);
  } catch {
    res.status(404).json({ error: 'Expense not found' });
  }
});

/* ─── DELETE /:id ─────────────────────────────────────────── */
router.delete('/:id', authenticate, async (req, res) => {
  try {
    await prisma.expense.delete({ where: { id: req.params.id } });
    res.json({ message: 'Expense deleted' });
  } catch {
    res.status(404).json({ error: 'Expense not found' });
  }
});

module.exports = router;
