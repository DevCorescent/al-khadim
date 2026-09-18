// Ported from api/src/ai/tools/hr.js
/**
 * HR domain tools: Employee, Attendance, Leave.
 * Payroll lives in finance.js (mirrors payroll.js's ACCOUNTANT-gated mutation routes).
 */
import { prisma } from '@/lib/prisma';
import type { AiTool } from './_registry';

const HR_ROLES = ['SUPER_ADMIN', 'ADMIN', 'RECRUITER', 'HR'];
const SUMMARY_ROLES = ['SUPER_ADMIN', 'ADMIN', 'RECRUITER', 'HR', 'MANAGER', 'VIEWER'];

const EMPLOYEE_STATUSES = ['ACTIVE', 'INACTIVE', 'ON_LEAVE', 'TERMINATED', 'RESIGNED'];
const LEAVE_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'];

const MAX_ROWS = 100;

const tools: AiTool[] = [
  {
    name: 'searchEmployees',
    description: 'Search the employee roster by status, department, or a free-text match on name/email. Returns up to 100 matching employees.',
    parameters: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: EMPLOYEE_STATUSES, description: 'Filter by employment status' },
        department: { type: 'string', description: 'Filter by department (partial match)' },
        search: { type: 'string', description: 'Free-text match on first name, last name, or email' },
        limit: { type: 'integer', minimum: 1, maximum: MAX_ROWS, description: `Max rows to return (capped at ${MAX_ROWS})` },
      },
      additionalProperties: false,
    },
    allowedRoles: HR_ROLES,
    handler: async (args) => {
      const where: any = {};
      if (args.status) where.status = args.status;
      if (args.department) where.department = { contains: args.department, mode: 'insensitive' };
      if (args.search) {
        where.OR = [
          { firstName: { contains: args.search, mode: 'insensitive' } },
          { lastName: { contains: args.search, mode: 'insensitive' } },
          { email: { contains: args.search, mode: 'insensitive' } },
        ];
      }
      const take = Math.min(args.limit || MAX_ROWS, MAX_ROWS);
      const [rows, total] = await Promise.all([
        prisma.employee.findMany({ where, take, orderBy: { createdAt: 'desc' } }),
        prisma.employee.count({ where }),
      ]);
      const table = {
        columns: [
          { key: 'employeeId', label: 'Employee ID' }, { key: 'name', label: 'Name' }, { key: 'email', label: 'Email' },
          { key: 'designation', label: 'Designation' }, { key: 'department', label: 'Department' },
          { key: 'joiningDate', label: 'Joining Date' }, { key: 'status', label: 'Status' }, { key: 'basicSalary', label: 'Basic Salary' },
        ],
        rows: rows.map((e) => ({
          employeeId: e.employeeId, name: `${e.firstName} ${e.lastName}`, email: e.email,
          designation: e.designation, department: e.department || '—',
          joiningDate: e.joiningDate.toISOString().slice(0, 10), status: e.status, basicSalary: e.basicSalary,
        })),
      };
      const cappedNote = total > take ? ` (showing ${take} of ${total} — refine your question to narrow this down)` : '';
      return { summary: `Found ${total} employee${total === 1 ? '' : 's'}${cappedNote}.`, table };
    },
  },
  {
    name: 'getAttendanceSummary',
    description: 'Get an aggregate attendance report (counts by status, average hours worked/overtime) for a date range, defaulting to the current month.',
    parameters: {
      type: 'object',
      properties: {
        fromDate: { type: 'string', description: 'ISO date, defaults to the 1st of the current month' },
        toDate: { type: 'string', description: 'ISO date, defaults to today' },
      },
      additionalProperties: false,
    },
    allowedRoles: SUMMARY_ROLES,
    handler: async (args) => {
      const now = new Date();
      const from = args.fromDate ? new Date(args.fromDate) : new Date(now.getFullYear(), now.getMonth(), 1);
      const to = args.toDate ? new Date(args.toDate) : now;
      const where: any = { date: { gte: from, lte: to } };
      const [groups, avgAgg] = await Promise.all([
        prisma.attendance.groupBy({ by: ['status'], where, _count: { _all: true } }),
        prisma.attendance.aggregate({ where, _avg: { hoursWorked: true, overtime: true } }),
      ]);
      const total = groups.reduce((s, g) => s + g._count._all, 0);
      const table = {
        columns: [{ key: 'status', label: 'Status' }, { key: 'count', label: 'Count' }],
        rows: groups.map((g) => ({ status: g.status, count: g._count._all })),
      };
      const avgHours = avgAgg._avg.hoursWorked != null ? Math.round(avgAgg._avg.hoursWorked * 10) / 10 : null;
      const avgOvertime = avgAgg._avg.overtime != null ? Math.round(avgAgg._avg.overtime * 10) / 10 : null;
      return {
        summary: `${total} attendance record${total === 1 ? '' : 's'} between ${from.toDateString()} and ${to.toDateString()}.` +
          `${avgHours != null ? ` Average hours worked: ${avgHours}.` : ''}${avgOvertime != null ? ` Average overtime: ${avgOvertime}.` : ''}`,
        table,
      };
    },
  },
  {
    name: 'getLeaveBalanceReport',
    description: 'List leave requests with employee, type, dates, days, and approval status. Returns up to 100 rows.',
    parameters: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: LEAVE_STATUSES, description: 'Filter by leave request status' },
        employeeSearch: { type: 'string', description: 'Free-text match on employee first/last name' },
        limit: { type: 'integer', minimum: 1, maximum: MAX_ROWS },
      },
      additionalProperties: false,
    },
    allowedRoles: HR_ROLES,
    handler: async (args) => {
      const where: any = {};
      if (args.status) where.status = args.status;
      if (args.employeeSearch) {
        where.employee = {
          OR: [
            { firstName: { contains: args.employeeSearch, mode: 'insensitive' } },
            { lastName: { contains: args.employeeSearch, mode: 'insensitive' } },
          ],
        };
      }
      const take = Math.min(args.limit || MAX_ROWS, MAX_ROWS);
      const [rows, total] = await Promise.all([
        prisma.leave.findMany({
          where, take, orderBy: { createdAt: 'desc' },
          include: { employee: { select: { firstName: true, lastName: true } } },
        }),
        prisma.leave.count({ where }),
      ]);
      const table = {
        columns: [
          { key: 'employee', label: 'Employee' }, { key: 'leaveType', label: 'Type' }, { key: 'startDate', label: 'Start' },
          { key: 'endDate', label: 'End' }, { key: 'days', label: 'Days' }, { key: 'status', label: 'Status' },
        ],
        rows: rows.map((l) => ({
          employee: `${l.employee.firstName} ${l.employee.lastName}`, leaveType: l.leaveType,
          startDate: l.startDate.toISOString().slice(0, 10), endDate: l.endDate.toISOString().slice(0, 10),
          days: l.days, status: l.status,
        })),
      };
      const cappedNote = total > take ? ` (showing ${take} of ${total})` : '';
      return { summary: `Found ${total} leave request${total === 1 ? '' : 's'}${cappedNote}.`, table };
    },
  },
  {
    name: 'getExpiringDocumentsReport',
    description: 'List employee passport, visa, and Emirates ID documents expiring within a window of days (default 30). One row per expiring document.',
    parameters: {
      type: 'object',
      properties: {
        withinDays: { type: 'integer', minimum: 1, maximum: 365, description: 'Days ahead to check for expiry (default 30)' },
      },
      additionalProperties: false,
    },
    allowedRoles: HR_ROLES,
    handler: async (args) => {
      const withinDays = args.withinDays || 30;
      const now = new Date();
      const until = new Date(now.getTime() + withinDays * 24 * 60 * 60 * 1000);
      const range = { gte: now, lte: until };
      const employees = await prisma.employee.findMany({
        where: {
          OR: [
            { passportExpiry: range },
            { visaExpiry: range },
            { emiratesExpiry: range },
          ],
        },
        select: { firstName: true, lastName: true, passportExpiry: true, visaExpiry: true, emiratesExpiry: true },
      });
      const rows: any[] = [];
      for (const e of employees) {
        const name = `${e.firstName} ${e.lastName}`;
        if (e.passportExpiry && e.passportExpiry >= now && e.passportExpiry <= until) {
          rows.push({ employee: name, document: 'Passport', expiryDate: e.passportExpiry.toISOString().slice(0, 10) });
        }
        if (e.visaExpiry && e.visaExpiry >= now && e.visaExpiry <= until) {
          rows.push({ employee: name, document: 'Visa', expiryDate: e.visaExpiry.toISOString().slice(0, 10) });
        }
        if (e.emiratesExpiry && e.emiratesExpiry >= now && e.emiratesExpiry <= until) {
          rows.push({ employee: name, document: 'Emirates ID', expiryDate: e.emiratesExpiry.toISOString().slice(0, 10) });
        }
      }
      rows.sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
      const total = rows.length;
      const take = Math.min(total, MAX_ROWS);
      const capped = rows.slice(0, take);
      const table = {
        columns: [{ key: 'employee', label: 'Employee' }, { key: 'document', label: 'Document' }, { key: 'expiryDate', label: 'Expiry Date' }],
        rows: capped,
      };
      const cappedNote = total > take ? ` (showing ${take} of ${total})` : '';
      return { summary: `${total} document${total === 1 ? '' : 's'} expiring within ${withinDays} days${cappedNote}.`, table };
    },
  },
];

export default tools;
