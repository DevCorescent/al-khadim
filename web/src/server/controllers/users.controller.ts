// Ported from api/src/routes/users.js
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@/generated/prisma/client';
import { requirePermission } from '../permissions';
import { HttpError, body, handler, json, query } from '../http';
import { FieldError, charLength, fieldError, isEmail, normalizeEmail, str } from './auth.controller';

const USER_SELECT = {
  id: true, name: true, email: true, role: true, customRole: true,
  permissions: true, phone: true, department: true, avatar: true,
  isActive: true, lastLogin: true, createdAt: true,
};

const ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'RECRUITER', 'HR', 'ACCOUNTANT', 'VIEWER'];

/** `permissions` as sent by the admin UI (object or JSON string); null/'' clear it (SQL NULL). */
function parsePermissions(v: any) {
  if (v === null || v === '') return Prisma.DbNull;
  if (typeof v === 'string') {
    try { return JSON.parse(v); } catch { throw new HttpError(400, 'permissions must be valid JSON'); }
  }
  if (typeof v !== 'object') throw new HttpError(400, 'permissions must be an object');
  return v;
}

/** Real boolean parsing (the old `Boolean("false")` was true). */
function parseBool(v: any, field: string): boolean {
  if (v === true || v === 'true') return true;
  if (v === false || v === 'false') return false;
  throw new HttpError(400, `${field} must be true or false`);
}

/** Loads the target user or throws 404; only a SUPER_ADMIN may manage SUPER_ADMIN accounts. */
async function loadManageableUser(id: string, me: { role: string }) {
  const target = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true, isActive: true } });
  if (!target) throw new HttpError(404, 'User not found');
  if (target.role === 'SUPER_ADMIN' && me.role !== 'SUPER_ADMIN') {
    throw new HttpError(403, 'Only Super Admin can manage Super Admin accounts');
  }
  return target;
}

/** Throws when the change would leave no active SUPER_ADMIN. */
async function assertNotLastSuperAdmin(
  target: { id: string; role: string; isActive: boolean },
  staysActiveSuperAdmin: boolean,
) {
  if (target.role !== 'SUPER_ADMIN' || !target.isActive || staysActiveSuperAdmin) return;
  const others = await prisma.user.count({ where: { role: 'SUPER_ADMIN', isActive: true, id: { not: target.id } } });
  if (others === 0) throw new HttpError(400, 'Cannot remove the last active Super Admin');
}

/* ── List all users ── */
export const list = handler(async (req) => {
  await requirePermission(req, 'users', 'view');
  const { search, role, isActive } = query(req);
  const where: any = {};
  if (search) {
    where.OR = [
      { name:  { contains: String(search), mode: 'insensitive' } },
      { email: { contains: String(search), mode: 'insensitive' } },
    ];
  }
  if (role) {
    if (!ROLES.includes(String(role))) return json({ error: 'Invalid role' }, 400);
    where.role = role;
  }
  if (isActive !== undefined) where.isActive = isActive === 'true';

  const users = await prisma.user.findMany({
    where, select: USER_SELECT, orderBy: { createdAt: 'desc' },
  });
  return json(users);
});

/* ── Get single user ── */
export const get = handler<{ id: string }>(async (req, { params }) => {
  await requirePermission(req, 'users', 'view');
  const user = await prisma.user.findUnique({ where: { id: params.id }, select: USER_SELECT });
  if (!user) return json({ error: 'User not found' }, 404);
  return json(user);
});

/* ── Create user ── */
export const create = handler(async (req) => {
  const me = await requirePermission(req, 'users', 'create');
  const b = await body(req);
  const errors: FieldError[] = [];
  if (!str(b.name)) errors.push(fieldError(b, 'name', 'Name is required'));
  if (!isEmail(str(b.email))) errors.push(fieldError(b, 'email'));
  const email = normalizeEmail(str(b.email));
  if (charLength(str(b.password)) < 8) errors.push(fieldError(b, 'password', 'Password must be at least 8 characters'));
  if (!ROLES.includes(str(b.role))) errors.push(fieldError(b, 'role', 'Invalid role'));
  if (errors.length) return json({ errors }, 400);

  const { name, password, role, phone, department, customRole, permissions } = b;

  // Only SUPER_ADMIN can create other SUPER_ADMINs
  if (role === 'SUPER_ADMIN' && me.role !== 'SUPER_ADMIN') {
    return json({ error: 'Only Super Admin can create Super Admin accounts' }, 403);
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return json({ error: 'Email already registered' }, 409);

  const hashed = await bcrypt.hash(String(password), 12);
  try {
    const user = await prisma.user.create({
      data: {
        name: String(name), email, password: hashed, role,
        phone: phone ? String(phone) : undefined,
        department: department ? String(department) : undefined,
        customRole: customRole ? String(customRole) : null,
        permissions: permissions ? parsePermissions(permissions) : Prisma.DbNull,
      },
      select: USER_SELECT,
    });
    return json(user, 201);
  } catch (err: any) {
    if (err.code === 'P2002') return json({ error: 'Email already registered' }, 409);
    throw err;
  }
});

/* ── Update user ── */
// Partial update: only the fields present in the body are written.
export const update = handler<{ id: string }>(async (req, { params }) => {
  const me = await requirePermission(req, 'users', 'edit');
  const b = await body(req);
  const target = await loadManageableUser(params.id, me);

  const data: any = {};
  if (b.name !== undefined) {
    if (!str(b.name).trim()) return json({ error: 'Name is required' }, 400);
    data.name = String(b.name);
  }
  if (b.phone !== undefined) data.phone = b.phone === null || b.phone === '' ? null : String(b.phone);
  if (b.department !== undefined) data.department = b.department === null || b.department === '' ? null : String(b.department);
  if (b.customRole !== undefined) data.customRole = b.customRole ? String(b.customRole) : null;
  if (b.permissions !== undefined) data.permissions = parsePermissions(b.permissions);
  if (b.role !== undefined) {
    if (!ROLES.includes(str(b.role))) return json({ error: 'Invalid role' }, 400);
    data.role = b.role;
  }
  if (b.isActive !== undefined) data.isActive = parseBool(b.isActive, 'isActive');

  // Prevent ADMIN from promoting to SUPER_ADMIN
  if (data.role === 'SUPER_ADMIN' && me.role !== 'SUPER_ADMIN') {
    return json({ error: 'Only Super Admin can assign Super Admin role' }, 403);
  }
  // Prevent self-deactivation / self-demotion
  if (target.id === me.id) {
    if (data.isActive === false) return json({ error: 'Cannot deactivate your own account' }, 400);
    if (data.role !== undefined && data.role !== me.role) return json({ error: 'Cannot change your own role' }, 400);
    // Custom role and per-user permissions decide access just like the role, so they are
    // protected the same way (unchanged values, as the edit form resends them, are fine).
    if (data.customRole !== undefined && data.customRole !== (me.customRole ?? null)) {
      return json({ error: 'Cannot change your own custom role' }, 400);
    }
    if (data.permissions !== undefined) {
      const next = data.permissions === Prisma.DbNull ? null : data.permissions;
      if (JSON.stringify(next) !== JSON.stringify(me.permissions ?? null)) {
        return json({ error: 'Cannot change your own permissions' }, 400);
      }
    }
  }
  const willBeRole = data.role ?? target.role;
  const willBeActive = data.isActive ?? target.isActive;
  await assertNotLastSuperAdmin(target, willBeRole === 'SUPER_ADMIN' && willBeActive);

  const user = await prisma.user.update({ where: { id: target.id }, data, select: USER_SELECT });
  return json(user);
});

/* ── Reset user password (admin) ── */
export const resetPassword = handler<{ id: string }>(async (req, { params }) => {
  const me = await requirePermission(req, 'users', 'edit');
  const b = await body(req);
  if (charLength(str(b.newPassword)) < 8) return json({ errors: [fieldError(b, 'newPassword')] }, 400);

  const target = await loadManageableUser(params.id, me);
  const hashed = await bcrypt.hash(String(b.newPassword), 12);
  // Revoke the old refresh token so existing sessions can't be extended with it.
  await prisma.user.update({ where: { id: target.id }, data: { password: hashed, refreshToken: null } });
  return json({ message: 'Password reset successfully' });
});

/* ── Toggle active status ── */
export const toggleActive = handler<{ id: string }>(async (req, { params }) => {
  const me = await requirePermission(req, 'users', 'edit');
  if (params.id === me.id) {
    return json({ error: 'Cannot deactivate your own account' }, 400);
  }
  const target = await loadManageableUser(params.id, me);
  await assertNotLastSuperAdmin(target, !target.isActive);
  const updated = await prisma.user.update({
    where: { id: target.id },
    data: { isActive: !target.isActive },
    select: USER_SELECT,
  });
  return json(updated);
});

/* ── Delete user ── */
export const remove = handler<{ id: string }>(async (req, { params }) => {
  const me = await requirePermission(req, 'users', 'delete');
  if (me.role !== 'SUPER_ADMIN') throw new HttpError(403, 'Insufficient permissions');
  if (params.id === me.id) {
    return json({ error: 'Cannot delete your own account' }, 400);
  }
  const target = await loadManageableUser(params.id, me);
  await assertNotLastSuperAdmin(target, false);
  try {
    // Login audit entries reference the user without a cascade; unless they go too,
    // any user who had ever logged in could not be deleted.
    await prisma.$transaction([
      prisma.auditLog.deleteMany({ where: { userId: target.id } }),
      prisma.user.delete({ where: { id: target.id } }),
    ]);
    return json({ message: 'User deleted' });
  } catch (err: any) {
    if (err.code === 'P2003') {
      return json({ error: 'This user still owns records (deals, documents, clients…). Deactivate the account instead.' }, 409);
    }
    throw err;
  }
});
