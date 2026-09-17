/**
 * Finance domain tools: Invoice, Expense, Payroll, BankAccount, AccountTransaction, Budget.
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const FINANCE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT'];
const FINANCE_SUMMARY_ROLES = ['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT', 'MANAGER', 'VIEWER'];
const BUDGET_ROLES = ['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT', 'MANAGER'];

const INVOICE_DOC_TYPES = ['INVOICE', 'PROFORMA_INVOICE', 'QUOTATION'];
const INVOICE_STATUSES = ['DRAFT', 'SENT', 'PAID', 'OVERDUE', 'CANCELLED', 'ACCEPTED', 'REJECTED'];
const EXPENSE_CATEGORIES = ['RENT', 'UTILITIES', 'OFFICE_SUPPLIES', 'MARKETING', 'TRAVEL', 'PROFESSIONAL_FEES', 'MAINTENANCE', 'INSURANCE', 'IT_SOFTWARE', 'BANK_CHARGES', 'TAXES', 'OTHER'];
const EXPENSE_STATUSES = ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'PAID', 'REJECTED'];
const PAYROLL_STATUSES = ['DRAFT', 'PROCESSED', 'APPROVED', 'PAID'];
const BUDGET_PERIODS = ['MONTHLY', 'QUARTERLY', 'YEARLY'];

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const MAX_ROWS = 100;

/** Mirrors bankAccounts.js's computeBalance(): openingBalance + sum of signed AccountTransaction.amount. */
async function computeBalance(accountId, openingBalance) {
  const agg = await prisma.accountTransaction.aggregate({ where: { accountId }, _sum: { amount: true } });
  return openingBalance + (agg._sum.amount || 0);
}

/** Mirrors budgets.js's periodRange(): the [gte,lt) date window a Budget row covers. */
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
  return { gte: new Date(y, 0, 1), lt: new Date(y + 1, 0, 1) };
}

module.exports = [
  {
    name: 'searchInvoices',
    description: 'Search invoices/proforma invoices/quotations by status, document type, or issue date range. Defaults to real invoices only. Returns up to 100 rows.',
    parameters: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: INVOICE_STATUSES, description: 'Filter by invoice status' },
        docType: { type: 'string', enum: INVOICE_DOC_TYPES, description: "Document type, defaults to 'INVOICE'" },
        fromDate: { type: 'string', description: 'ISO date, filters by issue date' },
        toDate: { type: 'string', description: 'ISO date, filters by issue date' },
        limit: { type: 'integer', minimum: 1, maximum: MAX_ROWS },
      },
      additionalProperties: false,
    },
    allowedRoles: FINANCE_ROLES,
    handler: async (args) => {
      const where = { docType: args.docType || 'INVOICE' };
      if (args.status) where.status = args.status;
      if (args.fromDate || args.toDate) {
        where.issueDate = {};
        if (args.fromDate) where.issueDate.gte = new Date(args.fromDate);
        if (args.toDate) where.issueDate.lte = new Date(args.toDate);
      }
      const take = Math.min(args.limit || MAX_ROWS, MAX_ROWS);
      const [rows, total] = await Promise.all([
        prisma.invoice.findMany({ where, take, orderBy: { issueDate: 'desc' }, include: { client: { select: { companyName: true } } } }),
        prisma.invoice.count({ where }),
      ]);
      const table = {
        columns: [
          { key: 'invoiceNo', label: 'Invoice No' }, { key: 'client', label: 'Client' }, { key: 'docType', label: 'Type' },
          { key: 'totalAmount', label: 'Total Amount' }, { key: 'status', label: 'Status' },
          { key: 'issueDate', label: 'Issue Date' }, { key: 'dueDate', label: 'Due Date' }, { key: 'paidDate', label: 'Paid Date' },
        ],
        rows: rows.map((i) => ({
          invoiceNo: i.invoiceNo, client: i.client?.companyName || '—', docType: i.docType, totalAmount: i.totalAmount, status: i.status,
          issueDate: i.issueDate.toISOString().slice(0, 10), dueDate: i.dueDate ? i.dueDate.toISOString().slice(0, 10) : '—',
          paidDate: i.paidDate ? i.paidDate.toISOString().slice(0, 10) : '—',
        })),
      };
      const cappedNote = total > take ? ` (showing ${take} of ${total} — refine your question to narrow this down)` : '';
      return { summary: `Found ${total} ${where.docType.toLowerCase()}${total === 1 ? '' : 's'}${cappedNote}.`, table };
    },
  },
  {
    name: 'getRevenueSummary',
    description: 'Get total paid invoice revenue broken down by month for a date range, defaulting to the current year.',
    parameters: {
      type: 'object',
      properties: {
        fromDate: { type: 'string', description: 'ISO date, defaults to Jan 1 of the current year' },
        toDate: { type: 'string', description: 'ISO date, defaults to Dec 31 of the current year' },
      },
      additionalProperties: false,
    },
    allowedRoles: FINANCE_SUMMARY_ROLES,
    handler: async (args) => {
      const now = new Date();
      const from = args.fromDate ? new Date(args.fromDate) : new Date(now.getFullYear(), 0, 1);
      const to = args.toDate ? new Date(args.toDate) : new Date(now.getFullYear(), 11, 31, 23, 59, 59);
      const invoices = await prisma.invoice.findMany({
        where: { docType: 'INVOICE', status: 'PAID', paidDate: { gte: from, lte: to } },
        select: { totalAmount: true, paidDate: true },
      });
      const byMonth = {};
      for (const inv of invoices) {
        const key = `${inv.paidDate.getFullYear()}-${inv.paidDate.getMonth()}`;
        byMonth[key] = (byMonth[key] || 0) + inv.totalAmount;
      }
      const rows = [];
      const cursor = new Date(from.getFullYear(), from.getMonth(), 1);
      while (cursor <= to) {
        const key = `${cursor.getFullYear()}-${cursor.getMonth()}`;
        rows.push({ month: `${MONTH_LABELS[cursor.getMonth()]} ${cursor.getFullYear()}`, revenue: byMonth[key] || 0 });
        cursor.setMonth(cursor.getMonth() + 1);
      }
      const total = invoices.reduce((s, i) => s + i.totalAmount, 0);
      const table = { columns: [{ key: 'month', label: 'Month' }, { key: 'revenue', label: 'Revenue' }], rows };
      return { summary: `Total paid revenue of ${total.toLocaleString()} AED between ${from.toDateString()} and ${to.toDateString()} across ${invoices.length} invoice${invoices.length === 1 ? '' : 's'}.`, table };
    },
  },
  {
    name: 'searchExpenses',
    description: 'Search expenses by category, status, or date range. Returns up to 100 rows.',
    parameters: {
      type: 'object',
      properties: {
        category: { type: 'string', enum: EXPENSE_CATEGORIES, description: 'Filter by expense category' },
        status: { type: 'string', enum: EXPENSE_STATUSES, description: 'Filter by expense status' },
        fromDate: { type: 'string', description: 'ISO date, filters by expense date' },
        toDate: { type: 'string', description: 'ISO date, filters by expense date' },
        limit: { type: 'integer', minimum: 1, maximum: MAX_ROWS },
      },
      additionalProperties: false,
    },
    allowedRoles: FINANCE_ROLES,
    handler: async (args) => {
      const where = {};
      if (args.category) where.category = args.category;
      if (args.status) where.status = args.status;
      if (args.fromDate || args.toDate) {
        where.date = {};
        if (args.fromDate) where.date.gte = new Date(args.fromDate);
        if (args.toDate) where.date.lte = new Date(args.toDate);
      }
      const take = Math.min(args.limit || MAX_ROWS, MAX_ROWS);
      const [rows, total] = await Promise.all([
        prisma.expense.findMany({ where, take, orderBy: { date: 'desc' } }),
        prisma.expense.count({ where }),
      ]);
      const table = {
        columns: [
          { key: 'expenseNo', label: 'Expense No' }, { key: 'category', label: 'Category' }, { key: 'vendor', label: 'Vendor' },
          { key: 'amount', label: 'Amount' }, { key: 'totalAmount', label: 'Total Amount' }, { key: 'status', label: 'Status' }, { key: 'date', label: 'Date' },
        ],
        rows: rows.map((e) => ({
          expenseNo: e.expenseNo, category: e.category, vendor: e.vendor || '—', amount: e.amount,
          totalAmount: e.totalAmount, status: e.status, date: e.date.toISOString().slice(0, 10),
        })),
      };
      const cappedNote = total > take ? ` (showing ${take} of ${total})` : '';
      return { summary: `Found ${total} expense${total === 1 ? '' : 's'}${cappedNote}.`, table };
    },
  },
  {
    name: 'getExpenseBreakdownByCategory',
    description: 'Get total expenses grouped by category (excluding draft and rejected expenses) for a date range, defaulting to the current year.',
    parameters: {
      type: 'object',
      properties: {
        fromDate: { type: 'string', description: 'ISO date, defaults to Jan 1 of the current year' },
        toDate: { type: 'string', description: 'ISO date, defaults to Dec 31 of the current year' },
      },
      additionalProperties: false,
    },
    allowedRoles: FINANCE_SUMMARY_ROLES,
    handler: async (args) => {
      const now = new Date();
      const from = args.fromDate ? new Date(args.fromDate) : new Date(now.getFullYear(), 0, 1);
      const to = args.toDate ? new Date(args.toDate) : new Date(now.getFullYear(), 11, 31, 23, 59, 59);
      const where = { date: { gte: from, lte: to }, status: { notIn: ['DRAFT', 'REJECTED'] } };
      const groups = await prisma.expense.groupBy({ by: ['category'], where, _sum: { totalAmount: true }, _count: { _all: true } });
      const total = groups.reduce((s, g) => s + (g._sum.totalAmount || 0), 0);
      const table = {
        columns: [{ key: 'category', label: 'Category' }, { key: 'amount', label: 'Amount' }, { key: 'count', label: 'Count' }],
        rows: EXPENSE_CATEGORIES.map((c) => {
          const g = groups.find((x) => x.category === c);
          return { category: c, amount: g?._sum.totalAmount || 0, count: g?._count._all || 0 };
        }),
      };
      return { summary: `Total expenses of ${total.toLocaleString()} AED between ${from.toDateString()} and ${to.toDateString()} across ${groups.length} categories.`, table };
    },
  },
  {
    name: 'searchPayrollRecords',
    description: 'Search payroll records by month, year, or status. Returns up to 100 rows.',
    parameters: {
      type: 'object',
      properties: {
        month: { type: 'integer', minimum: 1, maximum: 12 },
        year: { type: 'integer' },
        status: { type: 'string', enum: PAYROLL_STATUSES },
        limit: { type: 'integer', minimum: 1, maximum: MAX_ROWS },
      },
      additionalProperties: false,
    },
    allowedRoles: FINANCE_ROLES,
    handler: async (args) => {
      const where = {};
      if (args.month) where.month = args.month;
      if (args.year) where.year = args.year;
      if (args.status) where.status = args.status;
      const take = Math.min(args.limit || MAX_ROWS, MAX_ROWS);
      const [rows, total] = await Promise.all([
        prisma.payroll.findMany({
          where, take, orderBy: [{ year: 'desc' }, { month: 'desc' }],
          include: { employee: { select: { firstName: true, lastName: true } } },
        }),
        prisma.payroll.count({ where }),
      ]);
      const table = {
        columns: [
          { key: 'employee', label: 'Employee' }, { key: 'month', label: 'Month' }, { key: 'year', label: 'Year' },
          { key: 'grossSalary', label: 'Gross Salary' }, { key: 'netSalary', label: 'Net Salary' },
          { key: 'deductions', label: 'Deductions' }, { key: 'status', label: 'Status' },
        ],
        rows: rows.map((p) => ({
          employee: `${p.employee.firstName} ${p.employee.lastName}`, month: p.month, year: p.year,
          grossSalary: p.grossSalary, netSalary: p.netSalary, deductions: p.deductions, status: p.status,
        })),
      };
      const cappedNote = total > take ? ` (showing ${take} of ${total})` : '';
      return { summary: `Found ${total} payroll record${total === 1 ? '' : 's'}${cappedNote}.`, table };
    },
  },
  {
    name: 'getPayrollSummary',
    description: 'Get aggregate gross salary, net salary, and deductions across all payroll records for a given month/year, defaulting to the current month.',
    parameters: {
      type: 'object',
      properties: {
        month: { type: 'integer', minimum: 1, maximum: 12, description: 'Defaults to the current month' },
        year: { type: 'integer', description: 'Defaults to the current year' },
      },
      additionalProperties: false,
    },
    allowedRoles: FINANCE_SUMMARY_ROLES,
    handler: async (args) => {
      const now = new Date();
      const month = args.month || now.getMonth() + 1;
      const year = args.year || now.getFullYear();
      const agg = await prisma.payroll.aggregate({
        where: { month, year },
        _sum: { grossSalary: true, netSalary: true, deductions: true },
        _count: { _all: true },
      });
      const table = {
        columns: [{ key: 'metric', label: 'Metric' }, { key: 'amount', label: 'Amount' }],
        rows: [
          { metric: 'Gross Salary', amount: agg._sum.grossSalary || 0 },
          { metric: 'Net Salary', amount: agg._sum.netSalary || 0 },
          { metric: 'Deductions', amount: agg._sum.deductions || 0 },
        ],
      };
      return {
        summary: `Payroll for ${MONTH_LABELS[month - 1]} ${year}: ${agg._count._all} record${agg._count._all === 1 ? '' : 's'}, gross ${(agg._sum.grossSalary || 0).toLocaleString()} AED, net ${(agg._sum.netSalary || 0).toLocaleString()} AED, deductions ${(agg._sum.deductions || 0).toLocaleString()} AED.`,
        table,
      };
    },
  },
  {
    name: 'getBankAccountBalances',
    description: 'List all active bank/cash accounts with their computed current balance (opening balance plus all transactions).',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
    allowedRoles: FINANCE_ROLES,
    handler: async () => {
      const accounts = await prisma.bankAccount.findMany({ where: { isActive: true }, orderBy: { createdAt: 'asc' } });
      const withBalances = await Promise.all(
        accounts.map(async (a) => ({ ...a, currentBalance: await computeBalance(a.id, a.openingBalance) }))
      );
      const table = {
        columns: [{ key: 'name', label: 'Account' }, { key: 'type', label: 'Type' }, { key: 'currentBalance', label: 'Current Balance' }],
        rows: withBalances.map((a) => ({ name: a.name, type: a.type, currentBalance: a.currentBalance })),
      };
      const totalBalance = withBalances.reduce((s, a) => s + a.currentBalance, 0);
      return { summary: `${withBalances.length} active account${withBalances.length === 1 ? '' : 's'} totaling ${totalBalance.toLocaleString()} AED.`, table };
    },
  },
  {
    name: 'getBudgetVsActualReport',
    description: 'Compare budgeted amounts against actual spend per category for a given period, defaulting to the current month.',
    parameters: {
      type: 'object',
      properties: {
        year: { type: 'integer', description: 'Defaults to the current year' },
        period: { type: 'string', enum: BUDGET_PERIODS, description: "Defaults to 'MONTHLY'" },
        month: { type: 'integer', minimum: 1, maximum: 12, description: 'Required when period is MONTHLY, defaults to the current month' },
        quarter: { type: 'integer', minimum: 1, maximum: 4, description: 'Required when period is QUARTERLY' },
      },
      additionalProperties: false,
    },
    allowedRoles: BUDGET_ROLES,
    handler: async (args) => {
      const now = new Date();
      const year = args.year || now.getFullYear();
      const period = args.period || 'MONTHLY';
      const month = args.month || (period === 'MONTHLY' ? now.getMonth() + 1 : undefined);
      const quarter = args.quarter;

      const where = { year, period };
      if (period === 'MONTHLY' && month) where.month = month;
      if (period === 'QUARTERLY' && quarter) where.quarter = quarter;

      const budgets = await prisma.budget.findMany({ where, orderBy: { category: 'asc' } });
      const results = await Promise.all(
        budgets.map(async (b) => {
          const range = periodRange(b.period, b.year, b.month, b.quarter);
          const agg = await prisma.expense.aggregate({
            where: { category: b.category, status: { notIn: ['DRAFT', 'REJECTED'] }, date: { gte: range.gte, lt: range.lt } },
            _sum: { totalAmount: true },
          });
          const actual = agg._sum.totalAmount || 0;
          return {
            category: b.category, budgeted: b.amount, actual, variance: b.amount - actual,
            pctUsed: b.amount ? Math.round((actual / b.amount) * 1000) / 10 : 0,
          };
        })
      );
      const table = {
        columns: [
          { key: 'category', label: 'Category' }, { key: 'budgeted', label: 'Budgeted' }, { key: 'actual', label: 'Actual' },
          { key: 'variance', label: 'Variance' }, { key: 'pctUsed', label: '% Used' },
        ],
        rows: results,
      };
      const totalBudgeted = results.reduce((s, r) => s + r.budgeted, 0);
      const totalActual = results.reduce((s, r) => s + r.actual, 0);
      return {
        summary: `${results.length} budget line${results.length === 1 ? '' : 's'} for ${period} ${year}${month ? `/${month}` : ''}${quarter ? ` Q${quarter}` : ''}: budgeted ${totalBudgeted.toLocaleString()} AED vs actual ${totalActual.toLocaleString()} AED.`,
        table,
      };
    },
  },
];
