// Ported from api/src/routes/bankAccounts.js
import { prisma } from '@/lib/prisma';
import { requirePermission } from '../permissions';
import { body, handler, HttpError, json, query } from '../http';
import { pagination, toDate, toNumber } from '../validate';

const ACCOUNT_TYPES = ['BANK', 'CASH', 'PETTY_CASH'];

function checkType(type: any) {
  if (!ACCOUNT_TYPES.includes(type)) throw new HttpError(400, `type must be one of ${ACCOUNT_TYPES.join(', ')}`);
}

const toBool = (v: any) => v === true || v === 'true' || v === 'on' || v === 1 || v === '1';

/** Sum of an account's transactions + its opening balance. */
async function computeBalance(accountId: string, openingBalance: number) {
  const agg = await prisma.accountTransaction.aggregate({
    where: { accountId },
    _sum: { amount: true },
  });
  return openingBalance + (agg._sum.amount || 0);
}

/* ─── GET /  list (with computed balances) ───────────────────── */
export const list = handler(async (req) => {
  await requirePermission(req, 'finance', 'view');
  const accounts = await prisma.bankAccount.findMany({ orderBy: { createdAt: 'asc' } });
  const withBalances = await Promise.all(
    accounts.map(async (a) => ({ ...a, currentBalance: await computeBalance(a.id, a.openingBalance) })),
  );
  return json(withBalances);
});

/* ─── GET /:id  (detail + paginated transactions) ────────────── */
export const get = handler<{ id: string }>(async (req, { params }) => {
  await requirePermission(req, 'finance', 'view');
  const account = await prisma.bankAccount.findUnique({ where: { id: params.id } });
  if (!account) return json({ error: 'Account not found' }, 404);

  const { page, limit, skip } = pagination(query(req), { defaultLimit: 50 });
  const [transactions, total, currentBalance] = await Promise.all([
    prisma.accountTransaction.findMany({
      where: { accountId: account.id },
      orderBy: { date: 'desc' },
      skip,
      take: limit,
      include: {
        relatedInvoice: { select: { id: true, invoiceNo: true } },
        relatedExpense: { select: { id: true, expenseNo: true } },
        relatedPayroll: { select: { id: true, month: true, year: true, employee: { select: { firstName: true, lastName: true } } } },
      },
    }),
    prisma.accountTransaction.count({ where: { accountId: account.id } }),
    computeBalance(account.id, account.openingBalance),
  ]);

  return json({ ...account, currentBalance, transactions: { data: transactions, total, page, limit } });
});

/* ─── POST /  create account ──────────────────────────────────── */
export const create = handler(async (req) => {
  await requirePermission(req, 'finance', 'create');
  const { name, type, bankName, accountNumber, iban, currency, openingBalance } = await body(req);
  if (!name || !String(name).trim()) return json({ error: 'name is required' }, 400);
  if (type) checkType(type);
  const opening = toNumber(openingBalance, 'openingBalance') ?? 0;
  try {
    const account = await prisma.bankAccount.create({
      data: {
        name,
        type: type || 'BANK',
        bankName: bankName || null,
        accountNumber: accountNumber || null,
        iban: iban || null,
        currency: currency || 'AED',
        openingBalance: opening,
      },
    });
    return json({ ...account, currentBalance: account.openingBalance }, 201);
  } catch (err: any) {
    return json({ error: err.message }, 400);
  }
});

/* ─── PUT /:id  update ─────────────────────────────────────────── */
export const update = handler<{ id: string }>(async (req, { params }) => {
  await requirePermission(req, 'finance', 'edit');
  const { name, type, bankName, accountNumber, iban, currency, openingBalance, isActive } = await body(req);
  const data: any = {};
  if (name !== undefined) {
    if (!name || !String(name).trim()) return json({ error: 'name cannot be empty' }, 400);
    data.name = name;
  }
  if (type !== undefined) {
    checkType(type);
    data.type = type;
  }
  if (bankName !== undefined) data.bankName = bankName || null;
  if (accountNumber !== undefined) data.accountNumber = accountNumber || null;
  if (iban !== undefined) data.iban = iban || null;
  if (currency !== undefined) data.currency = currency || 'AED';
  if (openingBalance !== undefined) data.openingBalance = toNumber(openingBalance, 'openingBalance') ?? 0;
  if (isActive !== undefined) data.isActive = toBool(isActive);

  try {
    const account = await prisma.bankAccount.update({ where: { id: params.id }, data });
    return json({ ...account, currentBalance: await computeBalance(account.id, account.openingBalance) });
  } catch (err: any) {
    if (err?.code === 'P2025') return json({ error: 'Account not found' }, 404);
    return json({ error: err.message }, 400);
  }
});

/* ─── DELETE /:id  (only if no transactions) ─────────────────── */
export const remove = handler<{ id: string }>(async (req, { params }) => {
  await requirePermission(req, 'finance', 'delete');
  const [txnCount, expenseCount] = await Promise.all([
    prisma.accountTransaction.count({ where: { accountId: params.id } }),
    prisma.expense.count({ where: { accountId: params.id } }),
  ]);
  if (expenseCount > 0) {
    return json({ error: `This account is linked to ${expenseCount} expense(s) and cannot be deleted.` }, 400);
  }
  if (txnCount > 0) {
    return json({ error: `This account has ${txnCount} transaction(s) and cannot be deleted.` }, 400);
  }
  try {
    await prisma.bankAccount.delete({ where: { id: params.id } });
    return json({ message: 'Account deleted' });
  } catch {
    return json({ error: 'Account not found' }, 404);
  }
});

/* ─── POST /:id/transactions  (direct deposit/withdrawal/adjustment) ── */
export const createTransaction = handler<{ id: string }>(async (req, { params }) => {
  const user = await requirePermission(req, 'finance', 'create');
  const account = await prisma.bankAccount.findUnique({ where: { id: params.id } });
  if (!account) return json({ error: 'Account not found' }, 404);

  const { type, amount, description, date } = await body(req);
  if (!type || amount == null || amount === '') return json({ error: 'type and amount are required' }, 400);
  if (!['DEPOSIT', 'WITHDRAWAL', 'ADJUSTMENT'].includes(type)) {
    return json({ error: 'type must be DEPOSIT, WITHDRAWAL, or ADJUSTMENT' }, 400);
  }
  const parsed = toNumber(amount, 'amount')!;
  if (parsed === 0) return json({ error: 'amount cannot be zero' }, 400);
  const txnDate = toDate(date, 'date');

  // DEPOSIT is always an inflow, WITHDRAWAL always an outflow; ADJUSTMENT keeps
  // whatever sign the caller passed (it's a manual correction either way).
  let signedAmount = parsed;
  if (type === 'DEPOSIT') signedAmount = Math.abs(signedAmount);
  if (type === 'WITHDRAWAL') signedAmount = -Math.abs(signedAmount);

  try {
    const txn = await prisma.accountTransaction.create({
      data: {
        accountId: account.id,
        type,
        amount: signedAmount,
        description: description || null,
        date: txnDate || new Date(),
        createdBy: user.id,
      },
    });
    return json(txn, 201);
  } catch (err: any) {
    return json({ error: err.message }, 400);
  }
});

/* ─── POST /transfer  (paired transfer between two accounts) ──── */
export const transfer = handler(async (req) => {
  const user = await requirePermission(req, 'finance', 'create');
  const { fromAccountId, toAccountId, amount, description } = await body(req);
  if (!fromAccountId || !toAccountId || amount == null || amount === '') {
    return json({ error: 'fromAccountId, toAccountId and amount are required' }, 400);
  }
  if (fromAccountId === toAccountId) {
    return json({ error: 'Cannot transfer an account to itself' }, 400);
  }
  const amt = toNumber(amount, 'amount')!;
  if (amt <= 0) return json({ error: 'amount must be a positive number' }, 400);
  const [fromAccount, toAccount] = await Promise.all([
    prisma.bankAccount.findUnique({ where: { id: String(fromAccountId) } }),
    prisma.bankAccount.findUnique({ where: { id: String(toAccountId) } }),
  ]);
  if (!fromAccount || !toAccount) return json({ error: 'One or both accounts were not found' }, 404);
  if (!fromAccount.isActive || !toAccount.isActive) {
    return json({ error: 'Transfers are only allowed between active accounts' }, 400);
  }

  const desc = description || `Transfer: ${fromAccount.name} → ${toAccount.name}`;
  try {
    const [out, into] = await prisma.$transaction([
      prisma.accountTransaction.create({
        data: { accountId: fromAccountId, type: 'TRANSFER_OUT', amount: -amt, description: desc, createdBy: user.id },
      }),
      prisma.accountTransaction.create({
        data: { accountId: toAccountId, type: 'TRANSFER_IN', amount: amt, description: desc, createdBy: user.id },
      }),
    ]);
    return json({ out, into }, 201);
  } catch (err: any) {
    return json({ error: err.message }, 400);
  }
});
