// Ported from api/src/routes/employees.js
import { existsSync, unlinkSync } from 'fs';
import { prisma } from '@/lib/prisma';
import { EmployeeStatus, Prisma } from '@/generated/prisma/client';
import { requirePermission } from '../permissions';
import { HttpError, handler, json, query } from '../http';
import { absoluteUploadPath, parseUpload } from '../upload';
import { pagination, pickFields, scalarFields, toDate, toNumber } from '../validate';

const STATUSES = Object.values(EmployeeStatus) as string[];

// Everything except the photo, which is only set from an uploaded file.
const EMPLOYEE_FIELDS = scalarFields(Prisma.EmployeeScalarFieldEnum, ['photo']);
const REQUIRED = ['employeeId', 'firstName', 'lastName', 'email', 'phone', 'designation', 'joiningDate', 'basicSalary'];
const DATE_FIELDS = ['joiningDate', 'terminationDate', 'passportExpiry', 'visaExpiry', 'emiratesExpiry'];

/** Deletes a stored upload (a failed request's file, or a replaced/removed photo). */
function discardUpload(stored?: string) {
  if (!stored) return;
  try {
    const abs = absoluteUploadPath(stored);
    if (existsSync(abs)) unlinkSync(abs);
  } catch { /* best effort */ }
}

export const list = handler(async (req) => {
  await requirePermission(req, 'employees', 'view');
  const q = query(req);
  const { search, status, department } = q;
  const { page, limit, skip } = pagination(q, { defaultLimit: 20, maxLimit: 500 });
  const where: any = {};
  if (search) {
    where.OR = [
      { firstName: { contains: search, mode: 'insensitive' } },
      { lastName: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { employeeId: { contains: search, mode: 'insensitive' } },
    ];
  }
  if (status) {
    if (!STATUSES.includes(status)) return json({ error: 'Invalid status' }, 400);
    where.status = status;
  }
  if (department) where.department = { contains: department, mode: 'insensitive' };

  const [employees, total] = await Promise.all([
    prisma.employee.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.employee.count({ where }),
  ]);
  return json({ data: employees, total, page, limit });
});

export const get = handler<{ id: string }>(async (req, { params }) => {
  await requirePermission(req, 'employees', 'view');
  const employee = await prisma.employee.findUnique({
    where: { id: params.id },
    include: {
      attendances: { orderBy: { date: 'desc' }, take: 30 },
      leaves: { orderBy: { startDate: 'desc' }, take: 10 },
      payrolls: { orderBy: { year: 'desc' }, take: 12 },
      documents: true,
    },
  });
  if (!employee) return json({ error: 'Employee not found' }, 404);
  return json(employee);
});

/**
 * Whitelists and converts the submitted fields (form posts send everything as
 * strings). Blank optional fields become null; blank required ones are rejected.
 */
function employeeData(body: any, isCreate: boolean) {
  const data: any = pickFields(body, EMPLOYEE_FIELDS);
  if (isCreate) {
    const missing = REQUIRED.filter((f) => data[f] === undefined || data[f] === null || String(data[f]).trim() === '');
    if (missing.length) throw new HttpError(400, `Missing required fields: ${missing.join(', ')}`);
  }
  if (data.basicSalary !== undefined) {
    const salary = toNumber(data.basicSalary, 'basicSalary');
    if (salary === undefined) throw new HttpError(400, 'basicSalary is required');
    if (salary < 0) throw new HttpError(400, 'basicSalary must not be negative');
    data.basicSalary = salary;
  }
  for (const f of DATE_FIELDS) {
    if (data[f] === undefined) continue;
    data[f] = toDate(data[f], f);
    if (f === 'joiningDate' && data[f] === null) throw new HttpError(400, 'joiningDate is required');
  }
  if (data.status !== undefined && !STATUSES.includes(data.status)) throw new HttpError(400, 'Invalid status');
  for (const f of ['employeeId', 'firstName', 'lastName', 'email', 'phone', 'designation']) {
    if (data[f] !== undefined && String(data[f]).trim() === '') throw new HttpError(400, `${f} is required`);
  }
  return data;
}

function uniqueError(err: any) {
  if (err?.code === 'P2002') return new HttpError(409, 'An employee with this employee ID or email already exists');
  return err;
}

export const create = handler(async (req) => {
  await requirePermission(req, 'employees', 'create');
  const { body, file } = await parseUpload(req, ['photo']);
  try {
    const data = employeeData(body, true);
    if (file) data.photo = file.path;

    const employee = await prisma.employee.create({ data });
    return json(employee, 201);
  } catch (err: any) {
    discardUpload(file?.path);
    const e = uniqueError(err);
    if (e instanceof HttpError) throw e;
    return json({ error: err.message }, 400);
  }
});

export const update = handler<{ id: string }>(async (req, { params }) => {
  await requirePermission(req, 'employees', 'edit');
  const { body, file } = await parseUpload(req, ['photo']);
  try {
    const existing = await prisma.employee.findUnique({ where: { id: params.id }, select: { id: true, photo: true } });
    if (!existing) throw new HttpError(404, 'Employee not found');
    const data = employeeData(body, false);
    if (file) data.photo = file.path;

    const employee = await prisma.employee.update({ where: { id: params.id }, data });
    if (file && existing.photo && existing.photo !== file.path) discardUpload(existing.photo);
    return json(employee);
  } catch (err: any) {
    discardUpload(file?.path);
    throw uniqueError(err);
  }
});

export const remove = handler<{ id: string }>(async (req, { params }) => {
  await requirePermission(req, 'employees', 'delete');
  const existing = await prisma.employee.findUnique({ where: { id: params.id }, select: { id: true, photo: true } });
  if (!existing) return json({ error: 'Employee not found' }, 404);
  try {
    await prisma.employee.delete({ where: { id: params.id } });
    discardUpload(existing.photo);
    return json({ message: 'Employee deleted' });
  } catch (err: any) {
    // Attendance, leave, payroll, documents and assignments reference the employee.
    if (err?.code === 'P2003') {
      return json({ error: 'Employee has related records (attendance, leave, payroll, documents or assignments); remove them first' }, 409);
    }
    throw err;
  }
});
