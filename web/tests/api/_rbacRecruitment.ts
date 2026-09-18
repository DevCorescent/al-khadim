/**
 * RBAC helpers for the recruitment/site test files (candidates, registrations,
 * tracking, document requests, jobs, interviews, profile shares, categories,
 * industries, site config): staff users per system role and staff users whose
 * permissions come from a custom role. Everything created here is removed by
 * the returned cleanup functions.
 */
import { TAG, adminAuth, api, expectStatus, testEmail } from './_client';

export interface StaffUser {
  token: string;
  user: any;
  cleanup: () => Promise<unknown>;
}

let seq = 0;

/** A staff user with a system role and a unique email (safe to call many times per process). */
export async function rbacStaff(role: string): Promise<StaffUser> {
  const admin = await adminAuth();
  const email = testEmail(`rrbac-${role.toLowerCase()}-${++seq}`);
  const password = 'Test@12345';
  const created = await api('POST', '/users', { name: `RBAC ${role}`, email, password, role }, { token: admin });
  expectStatus(created, 201);
  const cleanup = () => api('DELETE', `/users/${created.data.id}`, undefined, { token: admin });
  const login = await api('POST', '/auth/login', { email: created.data.email ?? email, password });
  if (login.status !== 200) await cleanup();
  expectStatus(login, 200);
  return { token: login.data.accessToken as string, user: created.data, cleanup };
}

/** One staff user per system role, e.g. `const s = await staffUsers('VIEWER', 'HR')` → s.users.VIEWER.token. */
export async function staffUsers(...roles: string[]) {
  const users: Record<string, StaffUser> = {};
  const cleanup = async () => { for (const role of roles) await users[role]?.cleanup(); };
  try {
    for (const role of roles) users[role] = await rbacStaff(role);
  } catch (err) {
    await cleanup();
    throw err;
  }
  return { users, cleanup };
}

/**
 * A staff user (system role VIEWER) assigned a fresh custom role — created via
 * POST /roles and assigned with PUT /users/:id { customRole } — holding exactly
 * `permissions`. The custom role replaces the system-role preset.
 */
export async function staffWithCustomRole(permissions: Record<string, string[]>): Promise<StaffUser> {
  const admin = await adminAuth();
  const name = `Test Role ${TAG} r${++seq}`;
  const role = await api('POST', '/roles', { name, permissions }, { token: admin });
  expectStatus(role, 201);
  const dropRole = () => api('DELETE', `/roles/${role.data.id}`, undefined, { token: admin });
  let staff: StaffUser | undefined;
  try {
    staff = await rbacStaff('VIEWER');
    expectStatus(await api('PUT', `/users/${staff.user.id}`, { customRole: name }, { token: admin }), 200);
  } catch (err) {
    await staff?.cleanup();
    await dropRole();
    throw err;
  }
  return {
    token: staff.token,
    user: staff.user,
    cleanup: async () => { await staff!.cleanup(); await dropRole(); },
  };
}
