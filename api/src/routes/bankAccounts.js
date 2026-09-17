const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');

const prisma = new PrismaClient();

/** Sum of an account's transactions + its opening balance. */
async function computeBalance(accountId, openingBalance) {
  const agg = await prisma.accountTransaction.aggregate({
    where: { accountId },
    _sum: { amount: true },
  });
  return openingBalance + (agg._sum.amount || 0);
}

/* ─── GET /  list (with computed balances) ───────────────────── */
router.get('/', authenticate, async (req, res) => {
  const accounts = await prisma.bankAccount.findMany({ orderBy: { createdAt: 'asc' } });
  const withBalances = await Promise.all(
    accounts.map(async (a) => ({ ...a, currentBalance: await computeBalance(a.id, a.openingBalance) }))
  );
  res.json(withBalances);
});

/* ─── GET /:id  (detail + paginated transactions) ────────────── */
router.get('/:id', authenticate, async (req, res) => {
  const account = await prisma.bankAccount.findUnique({ where: { id: req.params.id } });
  if (!account) return res.status(404).json({ error: 'Account not found' });

  const { page = 1, limit = 50 } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const [transactions, total, currentBalance] = await Promise.all([
    prisma.accountTransaction.findMany({
      where: { accountId: account.id },
      orderBy: { date: 'desc' },
      skip,
      take: parseInt(limit),
      include: {
        relatedInvoice: { select: { id: true, invoiceNo: true } },
        relatedExpense: { select: { id: true, expenseNo: true } },
        relatedPayroll: { select: { id: true, month: true, year: true, employee: { select: { firstName: true, lastName: true } } } },
      },
    }),
    prisma.accountTransaction.count({ where: { accountId: account.id } }),
    computeBalance(account.id, account.openingBalance),
  ]);

  res.json({ ...account, currentBalance, transactions: { data: transactions, total, page: parseInt(page), limit: parseInt(limit) } });
});

/* ─── POST /  create account ──────────────────────────────────── */
router.post('/', authenticate, async (req, res) => {
  try {
    const { name, type, bankName, accountNumber, iban, currency, openingBalance } = req.body || {};
    if (!name) return res.status(400).json({ error: 'name is required' });
    const account = await prisma.bankAccount.create({
      data: {
        name,
        type: type || 'BANK',
        bankName: bankName || null,
        accountNumber: accountNumber || null,
        iban: iban || null,
        currency: currency || 'AED',
        openingBalance: openingBalance != null ? parseFloat(openingBalance) : 0,
      },
    });
    res.status(201).json({ ...account, currentBalance: account.openingBalance });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/* ─── PUT /:id  update ─────────────────────────────────────────── */
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { name, type, bankName, accountNumber, iban, currency, openingBalance, isActive } = req.body || {};
    const data = {};
    if (name !== undefined) data.name = name;
    if (type !== undefined) data.type = type;
    if (bankName !== undefined) data.bankName = bankName;
    if (accountNumber !== undefined) data.accountNumber = accountNumber;
    if (iban !== undefined) data.iban = iban;
    if (currency !== undefined) data.currency = currency;
    if (openingBalance !== undefined) data.openingBalance = parseFloat(openingBalance);
    if (isActive !== undefined) data.isActive = !!isActive;

    const account = await prisma.bankAccount.update({ where: { id: req.params.id }, data });
    res.json({ ...account, currentBalance: await computeBalance(account.id, account.openingBalance) });
  } catch {
    res.status(404).json({ error: 'Account not found' });
  }
});

/* ─── DELETE /:id  (only if no transactions) ─────────────────── */
router.delete('/:id', authenticate, async (req, res) => {
  const txnCount = await prisma.accountTransaction.count({ where: { accountId: req.params.id } });
  if (txnCount > 0) {
    return res.status(400).json({ error: `This account has ${txnCount} transaction(s) and cannot be deleted.` });
  }
  try {
    await prisma.bankAccount.delete({ where: { id: req.params.id } });
    res.json({ message: 'Account deleted' });
  } catch {
    res.status(404).json({ error: 'Account not found' });
  }
});

/* ─── POST /:id/transactions  (direct deposit/withdrawal/adjustment) ── */
router.post('/:id/transactions', authenticate, async (req, res) => {
  const account = await prisma.bankAccount.findUnique({ where: { id: req.params.id } });
  if (!account) return res.status(404).json({ error: 'Account not found' });

  const { type, amount, description, date } = req.body || {};
  if (!type || amount == null) return res.status(400).json({ error: 'type and amount are required' });
  if (!['DEPOSIT', 'WITHDRAWAL', 'ADJUSTMENT'].includes(type)) {
    return res.status(400).json({ error: 'type must be DEPOSIT, WITHDRAWAL, or ADJUSTMENT' });
  }

  // DEPOSIT is always an inflow, WITHDRAWAL always an outflow; ADJUSTMENT keeps
  // whatever sign the caller passed (it's a manual correction either way).
  let signedAmount = parseFloat(amount);
  if (type === 'DEPOSIT') signedAmount = Math.abs(signedAmount);
  if (type === 'WITHDRAWAL') signedAmount = -Math.abs(signedAmount);

  try {
    const txn = await prisma.accountTransaction.create({
      data: {
        accountId: account.id,
        type,
        amount: signedAmount,
        description: description || null,
        date: date ? new Date(date) : new Date(),
        createdBy: req.user.id,
      },
    });
    res.status(201).json(txn);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/* ─── POST /transfer  (paired transfer between two accounts) ──── */
router.post('/transfer', authenticate, async (req, res) => {
  const { fromAccountId, toAccountId, amount, description } = req.body || {};
  if (!fromAccountId || !toAccountId || amount == null) {
    return res.status(400).json({ error: 'fromAccountId, toAccountId and amount are required' });
  }
  if (fromAccountId === toAccountId) {
    return res.status(400).json({ error: 'Cannot transfer an account to itself' });
  }
  const amt = Math.abs(parseFloat(amount));
  const [fromAccount, toAccount] = await Promise.all([
    prisma.bankAccount.findUnique({ where: { id: fromAccountId } }),
    prisma.bankAccount.findUnique({ where: { id: toAccountId } }),
  ]);
  if (!fromAccount || !toAccount) return res.status(404).json({ error: 'One or both accounts were not found' });

  const desc = description || `Transfer: ${fromAccount.name} → ${toAccount.name}`;
  try {
    const [out, into] = await prisma.$transaction([
      prisma.accountTransaction.create({
        data: { accountId: fromAccountId, type: 'TRANSFER_OUT', amount: -amt, description: desc, createdBy: req.user.id },
      }),
      prisma.accountTransaction.create({
        data: { accountId: toAccountId, type: 'TRANSFER_IN', amount: amt, description: desc, createdBy: req.user.id },
      }),
    ]);
    res.status(201).json({ out, into });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
