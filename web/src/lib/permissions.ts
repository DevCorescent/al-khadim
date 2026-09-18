/**
 * Client-side permission helpers for the admin UI. The backend is the real enforcement
 * (src/server/permissions.ts); these only decide what to show.
 */
import { ROLE_PRESETS, type Permissions } from './permissionMatrix';

export type { Permissions };

export interface PermissionSubject {
  role: string;
  permissions?: Permissions | null;
}

/**
 * Effective permissions as known on the client. `permissions` comes from
 * /auth/login or /auth/me; sessions persisted before that field existed fall back
 * to the system-role preset until /auth/me refreshes them.
 */
export function clientPermissions(user: PermissionSubject | null | undefined): Permissions {
  if (!user) return {};
  if (user.permissions && typeof user.permissions === 'object') return user.permissions;
  return ROLE_PRESETS[user.role] || {};
}

export function hasPermission(
  user: PermissionSubject | null | undefined,
  module: string,
  action = 'view',
): boolean {
  if (!user) return false;
  if (user.role === 'SUPER_ADMIN') return true;
  return !!clientPermissions(user)[module]?.includes(action);
}

/** Pages only a SUPER_ADMIN can use (backend uses requireStaff(req, 'SUPER_ADMIN')). */
const SUPER_ADMIN_ROUTES = ['/admin/settings/ai'];

/**
 * Module whose `view` permission gates an admin route. Longest prefix wins.
 * `null` means "no module check" (any staff user may open it).
 */
const ROUTE_MODULES: [prefix: string, module: string][] = [
  ['/admin/candidates',        'candidates'],
  ['/admin/candidate-tracking', 'candidates'],
  ['/admin/profile-requests',  'candidates'],
  ['/admin/profile-shares',    'candidates'],
  ['/admin/jobs',              'jobs'],
  ['/admin/interviews',        'interviews'],
  ['/admin/crm/enquiries',     'enquiries'],
  ['/admin/crm/invoices',      'invoices'],
  ['/admin/crm',               'clients'],
  ['/admin/finance',           'finance'],
  ['/admin/payroll',           'payroll'],
  ['/admin/employees',         'employees'],
  ['/admin/outsourcing',       'employees'],
  ['/admin/attendance',        'attendance'],
  ['/admin/leave',             'leave'],
  ['/admin/documents',         'documents'],
  ['/admin/emails',            'emails'],
  ['/admin/reports',           'reports'],
  ['/admin/site-editor',       'site_editor'],
  ['/admin/users',             'users'],
  ['/admin/settings',          'settings'],
];

const matches = (pathname: string, prefix: string) =>
  pathname === prefix || pathname.startsWith(prefix + '/');

export function moduleForPath(pathname: string): string | null {
  if (pathname === '/admin' || pathname === '/admin/') return 'dashboard';
  let best: [string, string] | null = null;
  for (const entry of ROUTE_MODULES) {
    if (matches(pathname, entry[0]) && (!best || entry[0].length > best[0].length)) best = entry;
  }
  return best ? best[1] : null;
}

/** First admin page the user can open (dashboard first), or null if none. */
export function firstAccessiblePath(user: PermissionSubject | null | undefined): string | null {
  const candidates = ['/admin', ...ROUTE_MODULES.map(([prefix]) => prefix)];
  return candidates.find((p) => canViewPath(user, p)) ?? null;
}

/** Whether `user` may open the admin page at `pathname`. */
export function canViewPath(user: PermissionSubject | null | undefined, pathname: string): boolean {
  if (!user) return false;
  if (user.role === 'SUPER_ADMIN') return true;
  if (SUPER_ADMIN_ROUTES.some((p) => matches(pathname, p))) return false;
  const module = moduleForPath(pathname);
  return module === null || hasPermission(user, module, 'view');
}
