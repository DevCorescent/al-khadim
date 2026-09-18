/**
 * Direct database access for cleaning up CRM/finance test data that the API
 * refuses to delete (bank accounts with transactions, clients with linked
 * records). Only ever delete rows the test itself created (filter by ids you own).
 */
import 'dotenv/config';
import { prisma } from '../../src/lib/prisma';
import { adminAuth, api, expectStatus, TAG, testEmail } from './_client';

export const db = prisma;

/** Creates a client through the API (tagged with TAG). */
export async function createClient(token: string, name = 'Client') {
  const res = await api('POST', '/clients', {
    companyName: `${name} ${TAG}`, contactPerson: 'Test Person', email: testEmail(name.toLowerCase().replace(/\W+/g, '')),
    phone: '+971500000000',
  }, { token });
  expectStatus(res, 201);
  return res.data as { id: string; companyName: string };
}

/** Deletes a test client and everything that references it. */
export async function purgeClient(clientId: string) {
  if (!clientId) return;
  const invoices = await prisma.invoice.findMany({ where: { clientId }, select: { id: true } });
  await prisma.accountTransaction.deleteMany({ where: { relatedInvoiceId: { in: invoices.map((i) => i.id) } } });
  await prisma.invoice.deleteMany({ where: { clientId } });
  await prisma.activity.deleteMany({ where: { clientId } });
  await prisma.deal.deleteMany({ where: { clientId } });
  await prisma.followUp.deleteMany({ where: { clientId } });
  await prisma.client.deleteMany({ where: { id: clientId } });
}

/** Deletes a test bank account with its transactions (and unlinks test expenses). */
export async function purgeAccount(accountId: string) {
  if (!accountId) return;
  await prisma.accountTransaction.deleteMany({ where: { accountId } });
  await prisma.expense.updateMany({ where: { accountId }, data: { accountId: null } });
  await prisma.bankAccount.deleteMany({ where: { id: accountId } });
}

/** Deletes a test expense and its payment transactions. */
export async function purgeExpense(expenseId: string) {
  if (!expenseId) return;
  await prisma.accountTransaction.deleteMany({ where: { relatedExpenseId: expenseId } });
  const token = await adminAuth();
  const res = await api('DELETE', `/expenses/${expenseId}`, undefined, { token });
  if (res.status !== 200) await prisma.expense.deleteMany({ where: { id: expenseId } });
}
