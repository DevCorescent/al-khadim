// Ported from api/src/routes/leave.js
import { prisma } from '@/lib/prisma';
import { LeaveStatus } from '@/generated/prisma/client';
import { requirePermission } from '../permissions';
import { HttpError, body, handler, json, query } from '../http';
import { pickFields, toDate, toNumber } from '../validate';

const STATUSES = Object.values(LeaveStatus) as string[];
const CREATE_FIELDS = ['employeeId', 'leaveType', 'startDate', 'endDate', 'days', 'reason', 'notes'];
const UPDATE_FIELDS = ['leaveType', 'startDate', 'endDate', 'days', 'reason', 'notes', 'status'];

/** Whitelisted, converted leave fields; `existing` supplies the dates a partial update didn't send. */
function leaveData(input: any, allowed: string[], existing?: { startDate: Date; endDate: Date }) {
  const data: any = pickFields(input, allowed);
  for (const f of ['startDate', 'endDate']) {
    if (data[f] === undefined) continue;
    data[f] = toDate(data[f], f);
    if (!data[f]) throw new HttpError(400, `${f} is required`);
  }
  if (data.days !== undefined) {
    const days = toNumber(data.days, 'days');
    if (days === undefined || !Number.isInteger(days) || days < 1) throw new HttpError(400, 'days must be a whole number of at least 1');
    data.days = days;
  }
  if (data.leaveType !== undefined && !String(data.leaveType).trim()) throw new HttpError(400, 'leaveType is required');
  if (data.status !== undefined && !STATUSES.includes(data.status)) throw new HttpError(400, 'Invalid status');
  const start = data.startDate ?? existing?.startDate;
  const end = data.endDate ?? existing?.endDate;
  if (start && end && end < start) throw new HttpError(400, 'endDate must not be before startDate');
  return data;
}

export const list = handler(async (req) => {
  await requirePermission(req, 'leave', 'view');
  const { employeeId, status } = query(req);
  const where: any = {};
  if (employeeId) where.employeeId = employeeId;
  if (status) {
    if (!STATUSES.includes(status)) return json({ error: 'Invalid status' }, 400);
    where.status = status;
  }
  const leaves = await prisma.leave.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: { employee: { select: { id: true, firstName: true, lastName: true, employeeId: true } } },
  });
  return json(leaves);
});

export const create = handler(async (req) => {
  await requirePermission(req, 'leave', 'approve', ['employees', 'edit']);
  const input = (await body(req)) || {};
  const missing = ['employeeId', 'leaveType', 'startDate', 'endDate', 'days'].filter((f) => input[f] === undefined || input[f] === null || input[f] === '');
  if (missing.length) return json({ error: `Missing required fields: ${missing.join(', ')}` }, 400);
  const data = leaveData(input, CREATE_FIELDS);
  const employee = await prisma.employee.findUnique({ where: { id: data.employeeId }, select: { id: true } });
  if (!employee) return json({ error: 'Employee not found' }, 400);
  try {
    const leave = await prisma.leave.create({ data: data as any, include: { employee: true } });
    return json(leave, 201);
  } catch (err: any) {
    return json({ error: err.message }, 400);
  }
});

export const update = handler<{ id: string }>(async (req, { params }) => {
  const input = (await body(req)) || {};
  // Rejecting needs leave:reject; approving and any other edit need leave:approve.
  const user = await requirePermission(req, 'leave', input.status === 'REJECTED' ? 'reject' : 'approve');
  const existing = await prisma.leave.findUnique({ where: { id: params.id } });
  if (!existing) return json({ error: 'Leave not found' }, 404);
  const data = leaveData(input, UPDATE_FIELDS, existing);
  if (data.status === 'APPROVED') {
    data.approvedBy = user.name;
    data.approvedAt = new Date();
  }
  const leave = await prisma.leave.update({ where: { id: params.id }, data });
  return json(leave);
});

export const remove = handler<{ id: string }>(async (req, { params }) => {
  await requirePermission(req, 'leave', 'approve');
  try {
    await prisma.leave.delete({ where: { id: params.id } });
    return json({ message: 'Leave deleted' });
  } catch {
    return json({ error: 'Leave not found' }, 404);
  }
});
