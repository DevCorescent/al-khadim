// Ported from api/src/routes/attendance.js
import { prisma } from '@/lib/prisma';
import { requirePermission } from '../permissions';
import { HttpError, body, handler, json, query } from '../http';
import { pickFields, toDate, toNumber } from '../validate';

const CREATE_FIELDS = ['employeeId', 'date', 'checkIn', 'checkOut', 'hoursWorked', 'overtime', 'status', 'notes'];
const UPDATE_FIELDS = ['date', 'checkIn', 'checkOut', 'hoursWorked', 'overtime', 'status', 'notes'];
const MAX_BULK = 1000;

/** `YYYY-MM-DD` of a stored attendance date. */
function dayOf(date: Date) {
  return date.toISOString().slice(0, 10);
}

/**
 * checkIn/checkOut arrive either as full timestamps or, from the admin form's
 * <input type="time">, as "HH:MM" — the latter is taken as a time on `day`.
 */
function toTime(value: unknown, field: string, day: Date | null | undefined) {
  if (typeof value === 'string' && /^\d{1,2}:\d{2}(:\d{2})?$/.test(value.trim())) {
    if (!day) throw new HttpError(400, `${field} needs a date`);
    return toDate(`${dayOf(day)}T${value.trim().padStart(5, '0')}`, field);
  }
  return toDate(value, field);
}

function nonNegative(value: unknown, field: string) {
  const n = toNumber(value, field);
  if (n !== undefined && n < 0) throw new HttpError(400, `${field} must not be negative`);
  return n === undefined ? null : n;
}

/** Whitelisted, converted attendance fields. `day` is the record's date (for "HH:MM" times). */
function attendanceData(input: any, allowed: string[], day?: Date | null) {
  const data: any = pickFields(input, allowed);
  if (data.date !== undefined) {
    data.date = toDate(data.date, 'date');
    if (!data.date) throw new HttpError(400, 'date is required');
    day = data.date;
  }
  if (data.checkIn !== undefined) data.checkIn = toTime(data.checkIn, 'checkIn', day);
  if (data.checkOut !== undefined) data.checkOut = toTime(data.checkOut, 'checkOut', day);
  if (data.hoursWorked !== undefined) data.hoursWorked = nonNegative(data.hoursWorked, 'hoursWorked');
  if (data.overtime !== undefined) data.overtime = nonNegative(data.overtime, 'overtime');
  if (data.status !== undefined && !String(data.status).trim()) delete data.status;
  return data;
}

/** Validates an attendance row for create/upsert: employeeId and a valid date are required. */
function newRecord(input: any, label = '') {
  if (!input || typeof input !== 'object') throw new HttpError(400, `${label}record must be an object`);
  if (!input.employeeId) throw new HttpError(400, `${label}employeeId is required`);
  if (input.date === undefined || input.date === null || input.date === '') throw new HttpError(400, `${label}date is required`);
  try {
    return attendanceData(input, CREATE_FIELDS);
  } catch (err: any) {
    if (err instanceof HttpError && label) throw new HttpError(err.status, `${label}${err.message}`);
    throw err;
  }
}

async function assertEmployeesExist(ids: string[]) {
  const unique = Array.from(new Set(ids));
  const found = await prisma.employee.findMany({ where: { id: { in: unique } }, select: { id: true } });
  if (found.length !== unique.length) {
    const known = new Set(found.map((e) => e.id));
    throw new HttpError(400, `Employee not found: ${unique.filter((id) => !known.has(id)).join(', ')}`);
  }
}

export const list = handler(async (req) => {
  await requirePermission(req, 'attendance', 'view');
  const { employeeId, month, year } = query(req);
  const where: any = {};
  if (employeeId) where.employeeId = employeeId;
  if (month && year) {
    const m = parseInt(month, 10);
    const y = parseInt(year, 10);
    if (!(m >= 1 && m <= 12)) return json({ error: 'month must be between 1 and 12' }, 400);
    if (!(y >= 1900 && y <= 9999)) return json({ error: 'year is invalid' }, 400);
    where.date = { gte: new Date(y, m - 1, 1), lt: new Date(y, m, 1) };
  }
  const records = await prisma.attendance.findMany({
    where,
    orderBy: { date: 'desc' },
    include: { employee: { select: { id: true, firstName: true, lastName: true, employeeId: true } } },
  });
  return json(records);
});

export const create = handler(async (req) => {
  await requirePermission(req, 'attendance', 'create');
  const data = newRecord(await body(req));
  await assertEmployeesExist([data.employeeId]);
  try {
    const { employeeId, date, ...rest } = data;
    const record = await prisma.attendance.upsert({
      where: { employeeId_date: { employeeId, date } },
      update: rest,
      create: data,
    });
    return json(record, 201);
  } catch (err: any) {
    return json({ error: err.message }, 400);
  }
});

export const update = handler<{ id: string }>(async (req, { params }) => {
  await requirePermission(req, 'attendance', 'edit');
  const existing = await prisma.attendance.findUnique({ where: { id: params.id } });
  if (!existing) return json({ error: 'Record not found' }, 404);
  const data = attendanceData(await body(req), UPDATE_FIELDS, existing.date);
  try {
    const record = await prisma.attendance.update({ where: { id: params.id }, data });
    return json(record);
  } catch (err: any) {
    if (err?.code === 'P2002') return json({ error: 'Attendance for this employee and date already exists' }, 409);
    throw err;
  }
});

// Bulk import
export const bulk = handler(async (req) => {
  await requirePermission(req, 'attendance', 'create');
  const { records } = (await body(req)) || {};
  if (!Array.isArray(records)) return json({ error: 'records must be an array' }, 400);
  if (!records.length) return json({ error: 'records must not be empty' }, 400);
  if (records.length > MAX_BULK) return json({ error: `At most ${MAX_BULK} records per import` }, 400);

  const rows = records.map((r: any, i: number) => newRecord(r, `records[${i}]: `));
  await assertEmployeesExist(rows.map((r) => r.employeeId));
  try {
    const result = await prisma.$transaction(
      rows.map((r) => {
        const { employeeId, date, ...rest } = r;
        return prisma.attendance.upsert({
          where: { employeeId_date: { employeeId, date } },
          update: rest,
          create: r,
        });
      }),
    );
    return json({ imported: result.length });
  } catch (err: any) {
    return json({ error: err.message }, 400);
  }
});
