// Ported from api/src/routes/roles.js
import { prisma } from '@/lib/prisma';
import { requireStaff } from '../auth';
import { requirePermission } from '../permissions';
import { body, handler, json } from '../http';

function invalidPermissions(p: any) {
  return p !== undefined && (p === null || typeof p !== 'object');
}

/* ── List all custom roles ── */
export const list = handler(async (req) => {
  await requirePermission(req, 'users', 'view');
  const roles = await prisma.customRole.findMany({ orderBy: { createdAt: 'desc' } });
  return json(roles);
});

/* ── Create custom role ── */
export const create = handler(async (req) => {
  await requireStaff(req, 'SUPER_ADMIN');
  const { name, description, color, permissions } = await body(req);
  if (!name || typeof name !== 'string' || !name.trim()) return json({ error: 'Role name is required' }, 400);
  if (invalidPermissions(permissions)) return json({ error: 'permissions must be an object' }, 400);
  try {
    const role = await prisma.customRole.create({
      data: {
        name: name.trim(),
        description: description ? String(description) : null,
        color: color ? String(color) : '#6366f1',
        permissions: permissions || {},
      },
    });
    return json(role, 201);
  } catch (err: any) {
    if (err.code === 'P2002') return json({ error: 'Role name already exists' }, 409);
    return json({ error: err.message }, 400);
  }
});

/* ── Update custom role ── */
export const update = handler<{ id: string }>(async (req, { params }) => {
  await requireStaff(req, 'SUPER_ADMIN');
  const { name, description, color, permissions } = await body(req);
  if (name !== undefined && (typeof name !== 'string' || !name.trim())) {
    return json({ error: 'Role name is required' }, 400);
  }
  if (invalidPermissions(permissions)) return json({ error: 'permissions must be an object' }, 400);

  const existing = await prisma.customRole.findUnique({ where: { id: params.id } });
  if (!existing) return json({ error: 'Role not found' }, 404);

  const data: any = {};
  if (name !== undefined) data.name = name.trim();
  if (description !== undefined) data.description = description ? String(description) : null;
  if (color !== undefined && color !== null && color !== '') data.color = String(color);
  if (permissions !== undefined) data.permissions = permissions;
  try {
    const role = await prisma.customRole.update({ where: { id: params.id }, data });
    return json(role);
  } catch (err: any) {
    if (err.code === 'P2002') return json({ error: 'Role name already exists' }, 409);
    if (err.code === 'P2025') return json({ error: 'Role not found' }, 404);
    throw err;
  }
});

/* ── Delete custom role ── */
export const remove = handler<{ id: string }>(async (req, { params }) => {
  await requireStaff(req, 'SUPER_ADMIN');
  try {
    await prisma.customRole.delete({ where: { id: params.id } });
    return json({ message: 'Role deleted' });
  } catch {
    return json({ error: 'Role not found' }, 404);
  }
});
