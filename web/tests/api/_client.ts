/**
 * Shared helpers for the API integration tests.
 *
 * The tests call a RUNNING server over HTTP against the database in .env, and
 * delete everything they create. Start a server first, then run the suite:
 *
 *   npm run test:server   # terminal 1 — dev server on :3200, rate limits off
 *   npm run test:api      # terminal 2
 *
 * Env: API_BASE_URL (default http://localhost:3200),
 *      TEST_ADMIN_EMAIL / TEST_ADMIN_PASSWORD (default: the seeded admin).
 */
import 'dotenv/config';
import assert from 'node:assert/strict';

export const BASE_URL = (process.env.API_BASE_URL || 'http://localhost:3200').replace(/\/$/, '');
const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || 'admin@alkhadim.ae';
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || 'Admin@123';

/** Unique suffix for test data, so runs never collide and leftovers are easy to spot. */
export const TAG = `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
export const testEmail = (name: string) => `${name}.${TAG}@example.test`;

export interface ApiResponse<T = any> {
  status: number;
  data: T;
  headers: Headers;
}

export interface RequestOptions {
  token?: string | null;
  headers?: Record<string, string>;
}

/** Calls `/api${path}`. Plain objects are sent as JSON; FormData as multipart. */
export async function api<T = any>(
  method: string,
  path: string,
  body?: unknown,
  { token, headers = {} }: RequestOptions = {},
): Promise<ApiResponse<T>> {
  const h: Record<string, string> = { ...headers };
  if (token) h.Authorization = `Bearer ${token}`;
  let payload: BodyInit | undefined;
  if (body instanceof FormData) payload = body;
  else if (body !== undefined) {
    h['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const res = await fetch(`${BASE_URL}/api${path}`, { method, headers: h, body: payload });
  const text = await res.text();
  let data: any = text;
  try { data = text ? JSON.parse(text) : null; } catch { /* non-JSON (CSV, files) */ }
  return { status: res.status, data, headers: res.headers };
}

/** Asserts the status, printing the response body when it doesn't match. */
export function expectStatus(res: ApiResponse, status: number) {
  assert.equal(res.status, status, `expected ${status}, got ${res.status}: ${JSON.stringify(res.data)?.slice(0, 500)}`);
}

let adminToken: Promise<string> | undefined;

/** Access token for the seeded admin (logged in once per test process). */
export function adminAuth(): Promise<string> {
  adminToken ||= (async () => {
    const res = await api('POST', '/auth/login', { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
    expectStatus(res, 200);
    return res.data.accessToken as string;
  })();
  return adminToken;
}

/** Creates a staff user with the given role and returns its token (deleted by the returned cleanup). */
export async function staffWithRole(role: string) {
  const admin = await adminAuth();
  const email = testEmail(role.toLowerCase());
  const password = 'Test@12345';
  const created = await api('POST', '/users', { name: `Test ${role}`, email, password, role }, { token: admin });
  expectStatus(created, 201);
  const login = await api('POST', '/auth/login', { email: created.data.email ?? email, password });
  expectStatus(login, 200);
  return {
    token: login.data.accessToken as string,
    user: created.data,
    cleanup: () => api('DELETE', `/users/${created.data.id}`, undefined, { token: admin }),
  };
}

/** A small valid PDF (with extractable text) for upload tests. */
export function samplePdf(text = 'Test Document'): Blob {
  const stream = `BT /F1 12 Tf 72 720 Td (${text}) Tj ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((obj, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach((o) => { pdf += `${String(o).padStart(10, '0')} 00000 n \n`; });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new Blob([pdf], { type: 'application/pdf' });
}

/** A 1×1 PNG for photo upload tests. */
export function samplePng(): Blob {
  const b64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  return new Blob([Buffer.from(b64, 'base64')], { type: 'image/png' });
}

/** Fetches a non-API path on the server (e.g. an uploaded file under /uploads). */
export function fetchRaw(path: string) {
  return fetch(`${BASE_URL}/${path.replace(/^\//, '')}`);
}
