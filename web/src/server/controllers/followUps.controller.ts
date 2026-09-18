// Ported from api/src/routes/followUps.js
import { prisma } from '@/lib/prisma';
import { requirePermission } from '../permissions';
import { body, handler, HttpError, json, query } from '../http';
import { pickFields, toDate } from '../validate';

const TYPES = ['CALL', 'EMAIL', 'MEETING', 'WHATSAPP', 'OTHER'];
/** Columns a caller may set; completedAt is derived from isCompleted. */
const FIELDS = ['type', 'subject', 'notes', 'dueDate', 'isCompleted', 'clientId', 'candidateId', 'assignedTo'];

/** Whitelists and normalises a create/update payload. */
function followUpData(raw: any, partial: boolean) {
  const data: any = pickFields(raw, FIELDS);
  if ((!partial || 'subject' in data) && (!data.subject || !String(data.subject).trim())) {
    throw new HttpError(400, 'subject is required');
  }
  if (!partial || 'dueDate' in data) {
    const due = toDate(data.dueDate, 'dueDate');
    if (!due) throw new HttpError(400, 'dueDate is required');
    data.dueDate = due;
  }
  if (data.type === '') delete data.type;
  if (data.type !== undefined && !TYPES.includes(data.type)) {
    throw new HttpError(400, `type must be one of ${TYPES.join(', ')}`);
  }
  // Empty selects in the form mean "none".
  for (const k of ['clientId', 'candidateId', 'assignedTo']) if (data[k] === '') data[k] = null;
  if (data.notes === '') data.notes = null;
  if (data.isCompleted !== undefined) {
    data.isCompleted = data.isCompleted === true || data.isCompleted === 'true';
    data.completedAt = data.isCompleted ? new Date() : null;
  }
  return data;
}

export const list = handler(async (req) => {
  await requirePermission(req, 'clients', 'view');
  const { isCompleted, assignedTo, clientId, candidateId } = query(req);
  const where: any = {};
  if (isCompleted !== undefined) where.isCompleted = isCompleted === 'true';
  if (assignedTo) where.assignedTo = assignedTo;
  if (clientId) where.clientId = clientId;
  if (candidateId) where.candidateId = candidateId;

  const followUps = await prisma.followUp.findMany({
    where,
    orderBy: { dueDate: 'asc' },
    include: {
      client: { select: { id: true, companyName: true } },
      candidate: { select: { id: true, firstName: true, lastName: true } },
      user: { select: { id: true, name: true } },
    },
  });
  return json(followUps);
});

export const create = handler(async (req) => {
  const user = await requirePermission(req, 'clients', 'create');
  const data = followUpData(await body(req), false);
  try {
    if (!data.assignedTo) data.assignedTo = user.id;
    const followUp = await prisma.followUp.create({ data });
    return json(followUp, 201);
  } catch (err: any) {
    return json({ error: err.message }, 400);
  }
});

export const update = handler<{ id: string }>(async (req, { params }) => {
  await requirePermission(req, 'clients', 'edit');
  const data = followUpData(await body(req), true);
  try {
    const followUp = await prisma.followUp.update({ where: { id: params.id }, data });
    return json(followUp);
  } catch (err: any) {
    if (err?.code === 'P2025') return json({ error: 'Follow-up not found' }, 404);
    return json({ error: err.message }, 400);
  }
});

export const remove = handler<{ id: string }>(async (req, { params }) => {
  await requirePermission(req, 'clients', 'delete');
  try {
    await prisma.followUp.delete({ where: { id: params.id } });
    return json({ message: 'Follow-up deleted' });
  } catch {
    return json({ error: 'Follow-up not found' }, 404);
  }
});
