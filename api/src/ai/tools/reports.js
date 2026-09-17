/**
 * Cross-module aggregate tools: company-wide and financial KPI summaries.
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const KPI_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'VIEWER'];
const FINANCIAL_KPI_ROLES = ['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT', 'MANAGER'];

/** Mirrors bankAccounts.js's computeBalance(): openingBalance + sum of signed AccountTransaction.amount. */
async function computeBalance(accountId, openingBalance) {
  const agg = await prisma.accountTransaction.aggregate({ where: { accountId }, _sum: { amount: true } });
  return openingBalance + (agg._sum.amount || 0);
}

module.exports = [
  {
    name: 'getCompanyKPISummary',
    description: 'Get operational headline counts across the company: open jobs, active candidates in the pipeline, active employees, and active clients. No financial figures — safe for all roles.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
    allowedRoles: KPI_ROLES,
    handler: async () => {
      const [openJobs, activeCandidates, activeEmployees, activeClients] = await Promise.all([
        prisma.job.count({ where: { status: 'OPEN' } }),
        prisma.candidate.count({ where: { status: { notIn: ['REJECTED'] } } }),
        prisma.employee.count({ where: { status: 'ACTIVE' } }),
        prisma.client.count({ where: { status: 'APPROVED', isActive: true } }),
      ]);
      const table = {
        columns: [
          { key: 'openJobs', label: 'Open Jobs' }, { key: 'activeCandidates', label: 'Active Candidates' },
          { key: 'activeEmployees', label: 'Active Employees' }, { key: 'activeClients', label: 'Active Clients' },
        ],
        rows: [{ openJobs, activeCandidates, activeEmployees, activeClients }],
      };
      return {
        summary: `${openJobs} open job${openJobs === 1 ? '' : 's'}, ${activeCandidates} active candidate${activeCandidates === 1 ? '' : 's'} in the pipeline, ${activeEmployees} active employee${activeEmployees === 1 ? '' : 's'}, and ${activeClients} active client${activeClients === 1 ? '' : 's'}.`,
        table,
      };
    },
  },
  {
    name: 'getFinancialKPISummary',
    description: 'Get headline financial KPIs: total revenue and expenses for the current year, and current total cash position across all bank/cash accounts.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
    allowedRoles: FINANCIAL_KPI_ROLES,
    handler: async () => {
      const now = new Date();
      const yearStart = new Date(now.getFullYear(), 0, 1);
      const yearEnd = new Date(now.getFullYear(), 11, 31, 23, 59, 59);

      const [revenueAgg, expenseAgg, accounts] = await Promise.all([
        prisma.invoice.aggregate({
          where: { docType: 'INVOICE', status: 'PAID', paidDate: { gte: yearStart, lte: yearEnd } },
          _sum: { totalAmount: true },
        }),
        prisma.expense.aggregate({
          where: { date: { gte: yearStart, lte: yearEnd }, status: { notIn: ['DRAFT', 'REJECTED'] } },
          _sum: { totalAmount: true },
        }),
        prisma.bankAccount.findMany({ where: { isActive: true } }),
      ]);

      const balances = await Promise.all(accounts.map((a) => computeBalance(a.id, a.openingBalance)));
      const cashPosition = balances.reduce((s, b) => s + b, 0);
      const revenue = revenueAgg._sum.totalAmount || 0;
      const expenses = expenseAgg._sum.totalAmount || 0;

      const table = {
        columns: [
          { key: 'revenue', label: `Revenue (${now.getFullYear()})` }, { key: 'expenses', label: `Expenses (${now.getFullYear()})` },
          { key: 'cashPosition', label: 'Cash Position' },
        ],
        rows: [{ revenue, expenses, cashPosition }],
      };
      return {
        summary: `Revenue for ${now.getFullYear()}: ${revenue.toLocaleString()} AED. Expenses: ${expenses.toLocaleString()} AED. Current cash position across ${accounts.length} account${accounts.length === 1 ? '' : 's'}: ${cashPosition.toLocaleString()} AED.`,
        table,
      };
    },
  },
];
