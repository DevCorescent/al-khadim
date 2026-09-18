/**
 * Pure permission data shared by the server (src/server/permissions.ts) and the
 * admin UI (Roles & Permissions page, sidebar, page guards). No runtime deps, so it
 * is safe to import from both client and server code.
 */

export type Permissions = Record<string, string[]>;

/** Every module and the actions it supports. */
export const MODULES: Record<string, string[]> = {
  dashboard:   ['view'],
  candidates:  ['view', 'create', 'edit', 'delete', 'export', 'make_public'],
  jobs:        ['view', 'create', 'edit', 'delete'],
  clients:     ['view', 'create', 'edit', 'delete'],
  interviews:  ['view', 'create', 'edit', 'delete'],
  employees:   ['view', 'create', 'edit', 'delete'],
  attendance:  ['view', 'create', 'edit'],
  leave:       ['view', 'approve', 'reject'],
  payroll:     ['view', 'create', 'approve'],
  documents:   ['view', 'upload', 'delete'],
  enquiries:   ['view', 'create', 'edit', 'delete'],
  invoices:    ['view', 'create', 'edit', 'delete'],
  finance:     ['view', 'create', 'edit', 'delete', 'approve'],
  emails:      ['view', 'create', 'edit', 'delete', 'send'],
  reports:     ['view', 'export'],
  site_editor: ['view', 'edit'],
  users:       ['view', 'create', 'edit', 'delete'],
  settings:    ['view', 'edit'],
};

/** Every action on every module, minus the modules listed in `except`. */
export const allPermissions = (except: string[] = []): Permissions =>
  Object.fromEntries(
    Object.entries(MODULES).map(([m, actions]) => [m, except.includes(m) ? [] : [...actions]]),
  );

/** Default permissions per system role (START.md "Admin Roles"). */
export const ROLE_PRESETS: Record<string, Permissions> = {
  // All modules; user management without delete; system settings read-only.
  ADMIN: {
    ...allPermissions(),
    users: ['view', 'create', 'edit'],
    settings: ['view', 'edit'],
  },
  // CRM, ATS and reports.
  MANAGER: {
    dashboard: ['view'],
    candidates: ['view', 'create', 'edit', 'export', 'make_public'],
    jobs: ['view', 'create', 'edit'],
    clients: ['view', 'create', 'edit'],
    interviews: ['view', 'create', 'edit', 'delete'],
    enquiries: ['view', 'create', 'edit'],
    documents: ['view', 'upload'],
    employees: ['view'],
    attendance: ['view'],
    leave: ['view', 'approve', 'reject'],
    invoices: ['view'],
    reports: ['view', 'export'],
  },
  // Candidates, jobs, interviews.
  RECRUITER: {
    dashboard: ['view'],
    candidates: ['view', 'create', 'edit', 'export'],
    jobs: ['view', 'create', 'edit'],
    clients: ['view'],
    interviews: ['view', 'create', 'edit'],
    documents: ['view', 'upload'],
    reports: ['view'],
  },
  // Employees, attendance, leave, payroll.
  HR: {
    dashboard: ['view'],
    employees: ['view', 'create', 'edit'],
    attendance: ['view', 'create', 'edit'],
    leave: ['view', 'approve', 'reject'],
    payroll: ['view'],
    documents: ['view', 'upload'],
    reports: ['view'],
  },
  // Payroll, invoices, finance, reports.
  ACCOUNTANT: {
    dashboard: ['view'],
    payroll: ['view', 'create', 'approve'],
    invoices: ['view', 'create', 'edit'],
    finance: ['view', 'create', 'edit', 'approve'],
    clients: ['view'],
    employees: ['view'],
    reports: ['view', 'export'],
  },
  // Read-only.
  VIEWER: {
    dashboard: ['view'],
    candidates: ['view'],
    jobs: ['view'],
    clients: ['view'],
    reports: ['view'],
  },
};
