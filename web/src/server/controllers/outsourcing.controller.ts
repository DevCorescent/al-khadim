// Ported from api/src/routes/outsourcing.js
import { prisma } from '@/lib/prisma';
import { requirePermission } from '../permissions';
import { HttpError, body, handler, json, query } from '../http';
import { pickFields, toDate, toNumber } from '../validate';

const FIELDS = [
  'employeeId', 'clientName', 'startDate', 'endDate', 'designation', 'salary', 'currency',
  'visaStatus', 'accommodation', 'insurance', 'notes', 'isActive',
];
const REQUIRED = ['employeeId', 'clientName', 'startDate', 'designation', 'salary'];

function toBool(value: unknown) {
  return value === true || value === 'true';
}

/** Whitelisted, converted fields (the admin form posts everything as strings). */
function outsourcingData(input: any, existing?: { startDate: Date; endDate: Date | null }) {
  const data: any = pickFields(input || {}, FIELDS);
  for (const f of ['employeeId', 'clientName', 'designation']) {
    if (data[f] !== undefined && !String(data[f]).trim()) throw new HttpError(400, `${f} is required`);
  }
  if (data.startDate !== undefined) {
    data.startDate = toDate(data.startDate, 'startDate');
    if (!data.startDate) throw new HttpError(400, 'startDate is required');
  }
  if (data.endDate !== undefined) data.endDate = toDate(data.endDate, 'endDate');
  if (data.salary !== undefined) {
    const salary = toNumber(data.salary, 'salary');
    if (salary === undefined || salary < 0) throw new HttpError(400, 'salary must be a non-negative number');
    data.salary = salary;
  }
  if (data.insurance !== undefined) data.insurance = toBool(data.insurance);
  if (data.isActive !== undefined) data.isActive = toBool(data.isActive);
  const start = data.startDate ?? existing?.startDate;
  const end = data.endDate !== undefined ? data.endDate : existing?.endDate;
  if (start && end && end < start) throw new HttpError(400, 'endDate must not be before startDate');
  return data;
}

async function assertEmployee(id: string) {
  const employee = await prisma.employee.findUnique({ where: { id }, select: { id: true } });
  if (!employee) throw new HttpError(400, 'Employee not found');
}

export const list = handler(async (req) => {
  await requirePermission(req, 'employees', 'view');
  const { search, isActive } = query(req);
  const where: any = {};
  if (search) where.clientName = { contains: search, mode: 'insensitive' };
  if (isActive !== undefined) where.isActive = isActive === 'true';
  const records = await prisma.outsourcing.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: { employee: { select: { id: true, firstName: true, lastName: true, employeeId: true, designation: true } } },
  });
  return json(records);
});

export const create = handler(async (req) => {
  await requirePermission(req, 'employees', 'create');
  const input = (await body(req)) || {};
  const missing = REQUIRED.filter((f) => input[f] === undefined || input[f] === null || input[f] === '');
  if (missing.length) return json({ error: `Missing required fields: ${missing.join(', ')}` }, 400);
  const data = outsourcingData(input);
  await assertEmployee(data.employeeId);
  try {
    const record = await prisma.outsourcing.create({ data, include: { employee: true } });
    return json(record, 201);
  } catch (err: any) {
    return json({ error: err.message }, 400);
  }
});

export const update = handler<{ id: string }>(async (req, { params }) => {
  await requirePermission(req, 'employees', 'edit');
  const existing = await prisma.outsourcing.findUnique({ where: { id: params.id } });
  if (!existing) return json({ error: 'Record not found' }, 404);
  const data = outsourcingData(await body(req), existing);
  if (data.employeeId && data.employeeId !== existing.employeeId) await assertEmployee(data.employeeId);
  const record = await prisma.outsourcing.update({ where: { id: params.id }, data });
  return json(record);
});

export const remove = handler<{ id: string }>(async (req, { params }) => {
  await requirePermission(req, 'employees', 'delete');
  try {
    await prisma.outsourcing.delete({ where: { id: params.id } });
    return json({ message: 'Record deleted' });
  } catch {
    return json({ error: 'Record not found' }, 404);
  }
});
