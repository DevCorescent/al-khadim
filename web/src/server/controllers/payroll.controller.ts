// Ported from api/src/routes/payroll.js
import { prisma } from '@/lib/prisma';
import { PayrollStatus } from '@/generated/prisma/client';
import { requirePermission } from '../permissions';
import { HttpError, body, handler, json, query } from '../http';
import { pickFields, toNumber } from '../validate';

const STATUSES = Object.values(PayrollStatus) as string[];
const AMOUNT_FIELDS = ['basicSalary', 'allowances', 'overtime', 'deductions'] as const;
const UPDATE_FIELDS = [...AMOUNT_FIELDS, 'currency', 'paymentMethod', 'notes'];

function parseMonth(value: unknown) {
  const m = Number(value);
  if (!Number.isInteger(m) || m < 1 || m > 12) throw new HttpError(400, 'month must be a whole number between 1 and 12');
  return m;
}

function parseYear(value: unknown) {
  const y = Number(value);
  if (!Number.isInteger(y) || y < 2000 || y > 2100) throw new HttpError(400, 'year must be a whole number between 2000 and 2100');
  return y;
}

export const list = handler(async (req) => {
  await requirePermission(req, 'payroll', 'view');
  const { employeeId, month, year, status } = query(req);
  const where: any = {};
  if (employeeId) where.employeeId = employeeId;
  if (month) where.month = parseMonth(month);
  if (year) where.year = parseYear(year);
  if (status) {
    if (!STATUSES.includes(status)) return json({ error: 'Invalid status' }, 400);
    where.status = status;
  }

  const payrolls = await prisma.payroll.findMany({
    where,
    orderBy: [{ year: 'desc' }, { month: 'desc' }],
    include: { employee: { select: { id: true, firstName: true, lastName: true, employeeId: true, designation: true } } },
  });
  return json(payrolls);
});

export const processPayroll = handler(async (req) => {
  await requirePermission(req, 'payroll', 'create');
  const { month: rawMonth, year: rawYear, employeeIds } = (await body(req)) || {};
  const month = parseMonth(rawMonth);
  const year = parseYear(rawYear);
  if (employeeIds !== undefined && (!Array.isArray(employeeIds) || employeeIds.some((id) => typeof id !== 'string'))) {
    return json({ error: 'employeeIds must be an array of ids' }, 400);
  }

  const employees = await prisma.employee.findMany({
    where: employeeIds ? { id: { in: employeeIds } } : { status: 'ACTIVE' },
  });
  const ids = employees.map((e) => e.id);

  // Whole month: [1st of month, 1st of next month).
  const [attendances, existing] = await Promise.all([
    prisma.attendance.findMany({
      where: { employeeId: { in: ids }, date: { gte: new Date(year, month - 1, 1), lt: new Date(year, month, 1) } },
      select: { employeeId: true, overtime: true },
    }),
    prisma.payroll.findMany({ where: { employeeId: { in: ids }, month, year } }),
  ]);
  const overtimeHours: Record<string, number> = {};
  attendances.forEach((a) => { overtimeHours[a.employeeId] = (overtimeHours[a.employeeId] || 0) + (a.overtime || 0); });
  const existingByEmployee = new Map(existing.map((p) => [p.employeeId, p]));

  // Payroll that has already been paid is never recalculated.
  const toProcess = employees.filter((emp) => existingByEmployee.get(emp.id)?.status !== 'PAID');

  try {
    const payrolls = await prisma.$transaction(toProcess.map((emp) => {
      const overtimePay = (emp.basicSalary / 30 / 8) * 1.5 * (overtimeHours[emp.id] || 0);
      const prev = existingByEmployee.get(emp.id);
      // Keep allowances/deductions already entered on an existing record.
      const allowances = prev?.allowances || 0;
      const deductions = prev?.deductions || 0;
      const grossSalary = emp.basicSalary + allowances + overtimePay;
      const netSalary = grossSalary - deductions;

      return prisma.payroll.upsert({
        where: { employeeId_month_year: { employeeId: emp.id, month, year } },
        update: { basicSalary: emp.basicSalary, overtime: overtimePay, grossSalary, netSalary, status: 'PROCESSED' },
        create: {
          employeeId: emp.id,
          month,
          year,
          basicSalary: emp.basicSalary,
          allowances: 0,
          overtime: overtimePay,
          deductions: 0,
          grossSalary,
          netSalary,
          currency: emp.currency,
          status: 'PROCESSED',
        },
      });
    }));

    return json({ processed: payrolls.length, payrolls });
  } catch (err: any) {
    return json({ error: err.message }, 400);
  }
});

export const update = handler<{ id: string }>(async (req, { params }) => {
  await requirePermission(req, 'payroll', 'create');
  const existing = await prisma.payroll.findUnique({ where: { id: params.id } });
  if (!existing) return json({ error: 'Payroll not found' }, 404);
  if (existing.status === 'PAID') return json({ error: 'Paid payroll cannot be edited' }, 400);

  const data: any = pickFields((await body(req)) || {}, UPDATE_FIELDS);
  for (const f of AMOUNT_FIELDS) {
    if (data[f] === undefined) continue;
    const n = toNumber(data[f], f);
    if (n === undefined || n < 0) throw new HttpError(400, `${f} must be a non-negative number`);
    data[f] = n;
  }
  // Amounts that weren't sent keep their stored values.
  const merged = { ...existing, ...data };
  data.grossSalary = merged.basicSalary + merged.allowances + merged.overtime;
  data.netSalary = data.grossSalary - merged.deductions;

  const payroll = await prisma.payroll.update({ where: { id: params.id }, data });
  return json(payroll);
});

export const approve = handler<{ id: string }>(async (req, { params }) => {
  await requirePermission(req, 'payroll', 'approve');
  const existing = await prisma.payroll.findUnique({ where: { id: params.id }, select: { status: true } });
  if (!existing) return json({ error: 'Payroll not found' }, 404);
  if (existing.status === 'PAID') return json({ error: 'Already marked paid' }, 400);
  const payroll = await prisma.payroll.update({
    where: { id: params.id },
    data: { status: 'APPROVED' },
  });
  return json(payroll);
});

/* PATCH /:id/pay  (optionally posts an AccountTransaction) */
export const pay = handler<{ id: string }>(async (req, { params }) => {
  const user = await requirePermission(req, 'payroll', 'approve', ['finance', 'approve']);
  const existing = await prisma.payroll.findUnique({ where: { id: params.id } });
  if (!existing) return json({ error: 'Payroll record not found' }, 404);
  if (existing.status === 'PAID') return json({ error: 'Already marked paid' }, 400);
  if (existing.status !== 'APPROVED') return json({ error: 'Only approved payroll can be paid' }, 400);

  const { accountId, paymentMethod } = (await body(req)) || {};
  if (accountId) {
    const account = await prisma.bankAccount.findUnique({ where: { id: String(accountId) }, select: { id: true } });
    if (!account) return json({ error: 'Bank account not found' }, 400);
  }

  try {
    // The status guard is re-checked inside the transaction so two concurrent
    // requests can't both pay (and post two account transactions).
    const payroll = await prisma.$transaction(async (tx) => {
      const { count } = await tx.payroll.updateMany({
        where: { id: params.id, status: 'APPROVED' },
        data: {
          status: 'PAID',
          paymentDate: new Date(),
          paymentMethod: paymentMethod ? String(paymentMethod) : existing.paymentMethod,
        },
      });
      if (!count) throw new HttpError(400, 'Already marked paid');
      if (accountId) {
        await tx.accountTransaction.create({
          data: {
            accountId: String(accountId),
            type: 'PAYROLL_PAYMENT',
            amount: -Math.abs(existing.netSalary),
            description: `Payroll ${existing.month}/${existing.year}`,
            relatedPayrollId: existing.id,
            createdBy: user.id,
          },
        });
      }
      return tx.payroll.findUnique({ where: { id: params.id } });
    });
    return json(payroll);
  } catch (err: any) {
    if (err instanceof HttpError) throw err;
    return json({ error: err.message }, 400);
  }
});
