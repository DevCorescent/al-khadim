/**
 * RBAC test helpers: staff users with system roles, per-user permission
 * overrides or custom roles. Every user gets a unique email, so one test file
 * can create several users with the same system role. Each helper returns a
 * cleanup that deletes what it created.
 */
import { adminAuth, api, expectStatus, testEmail } from './_client';

export interface StaffUser {
  token: string;
  user: any;
  cleanup: () => Promise<any>;
}

const PASSWORD = 'Test@12345';
let seq = 0;

/** A staff user with `role` and optional `permissions` / `customRole`, created by the seeded admin. */
export async function staffUser(
  label: string,
  role: string,
  extra: { permissions?: Record<string, string[]>; customRole?: string } = {},
): Promise<StaffUser> {
  const admin = await adminAuth();
  const slug = `rbac-${label}-${++seq}-${Math.random().toString(36).slice(2, 6)}`.toLowerCase().replace(/[^a-z0-9-]+/g, '');
  const email = testEmail(slug);
  const created = await api('POST', '/users', { name: `RBAC ${label}`, email, password: PASSWORD, role, ...extra }, { token: admin });
  expectStatus(created, 201);
  const login = await api('POST', '/auth/login', { email: created.data.email ?? email, password: PASSWORD });
  expectStatus(login, 200);
  return {
    token: login.data.accessToken as string,
    user: created.data,
    cleanup: () => api('DELETE', `/users/${created.data.id}`, undefined, { token: admin }),
  };
}

/** One staff user per system role, keyed by role. */
export async function staffUsers(...roles: string[]): Promise<{ users: Record<string, StaffUser>; cleanup: () => Promise<void> }> {
  const users: Record<string, StaffUser> = {};
  for (const role of roles) users[role] = await staffUser(role, role);
  return {
    users,
    cleanup: async () => {
      for (const u of Object.values(users)) await u.cleanup().catch(() => {});
    },
  };
}

/** A staff user whose effective permissions are exactly `permissions` (per-user override on a VIEWER). */
export function staffWithPermissions(permissions: Record<string, string[]>, role = 'VIEWER'): Promise<StaffUser> {
  return staffUser('custom', role, { permissions });
}
