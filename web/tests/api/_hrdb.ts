/**
 * Direct database access for cleaning up HR test data that has no DELETE
 * endpoint (attendance, payroll, account transactions). Only ever delete rows
 * the test itself created (filter by ids you own).
 */
import 'dotenv/config';
import { prisma } from '../../src/lib/prisma';

export const db = prisma;

/** Deletes an employee created by a test and every HR row that references it. */
export async function purgeEmployee(employeeId: string) {
  if (!employeeId) return;
  const payrolls = await prisma.payroll.findMany({ where: { employeeId }, select: { id: true } });
  await prisma.accountTransaction.deleteMany({ where: { relatedPayrollId: { in: payrolls.map((p) => p.id) } } });
  await prisma.payroll.deleteMany({ where: { employeeId } });
  await prisma.attendance.deleteMany({ where: { employeeId } });
  await prisma.leave.deleteMany({ where: { employeeId } });
  await prisma.outsourcing.deleteMany({ where: { employeeId } });
  await prisma.document.deleteMany({ where: { employeeId } });
  await prisma.employee.deleteMany({ where: { id: employeeId } });
}

let seq = 0;

/** Creates an employee through the API (clean up with purgeEmployee). */
export async function createEmployee(token: string, overrides: Record<string, unknown> = {}) {
  const { TAG, api, expectStatus, testEmail } = await import('./_client');
  const n = ++seq;
  const res = await api('POST', '/employees', {
    employeeId: `EMP-${TAG}-${n}`, firstName: 'Test', lastName: `Employee${n}`, email: testEmail(`emp${n}`),
    phone: '+971500000000', designation: 'QA', joiningDate: '2026-01-01', basicSalary: 4800,
    ...overrides,
  }, { token });
  expectStatus(res, 201);
  return res.data;
}
