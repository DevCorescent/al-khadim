/**
 * Role-based access control for staff users.
 *
 * Permissions are `{ [module]: action[] }`, the same shape the Roles & Permissions
 * page (src/app/admin/users/roles/page.tsx) edits. A user's effective permissions are,
 * in order of precedence:
 *   1. SUPER_ADMIN → everything
 *   2. the user's own `permissions` JSON (set per user)
 *   3. the permissions of their custom role (`customRole` = CustomRole.name)
 *   4. the preset for their system role (ROLE_PRESETS, src/lib/permissionMatrix.ts)
 */
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { User } from '@/generated/prisma/client';
import { requireStaff } from './auth';
import { HttpError } from './http';
import { MODULES, ROLE_PRESETS, allPermissions, type Permissions } from '@/lib/permissionMatrix';

// The module/action matrix and role presets live in src/lib/permissionMatrix.ts so the
// Roles & Permissions page and the admin nav use exactly the same data.
export { MODULES, ROLE_PRESETS };
export type { Permissions };

const all = allPermissions;

function isPermissions(value: unknown): value is Permissions {
  return !!value && typeof value === 'object' && !Array.isArray(value)
    && Object.values(value as object).every((v) => Array.isArray(v));
}

/** Effective permissions for a staff user (see precedence at the top of the file). */
export async function effectivePermissions(user: Pick<User, 'role' | 'customRole' | 'permissions'>): Promise<Permissions> {
  if (user.role === 'SUPER_ADMIN') return all();
  if (isPermissions(user.permissions) && Object.keys(user.permissions).length) return user.permissions;
  if (user.customRole) {
    const role = await prisma.customRole.findUnique({ where: { name: user.customRole } });
    if (role && isPermissions(role.permissions)) return role.permissions;
  }
  return ROLE_PRESETS[user.role] || {};
}

export async function hasPermission(
  user: Pick<User, 'role' | 'customRole' | 'permissions'>,
  module: string,
  action: string,
): Promise<boolean> {
  if (user.role === 'SUPER_ADMIN') return true;
  const perms = await effectivePermissions(user);
  return !!perms[module]?.includes(action);
}

/**
 * Staff guard with a permission check: authenticates like `requireStaff` and then
 * requires `action` on `module` (403 "Insufficient permissions" otherwise).
 * Pass several [module, action] pairs to allow access when ANY of them is granted.
 */
export async function requirePermission(
  req: NextRequest,
  module: string,
  action: string,
  ...alternatives: [string, string][]
) {
  const user = await requireStaff(req);
  for (const [m, a] of [[module, action] as [string, string], ...alternatives]) {
    if (await hasPermission(user, m, a)) return user;
  }
  throw new HttpError(403, 'Insufficient permissions');
}
