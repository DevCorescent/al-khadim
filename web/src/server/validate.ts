/**
 * Input hardening helpers used by controllers:
 *   - pickFields: whitelist request-body keys before they reach Prisma (no mass assignment)
 *   - escapeHtml: escape user text before it is placed in email HTML
 *   - pagination: safe page/limit parsing
 */
import { HttpError } from './http';

/**
 * Returns only the listed keys that are present (not undefined) in `data`.
 * Use it for create/update payloads so a request can't set columns like
 * `status`, `password` or foreign keys it shouldn't control, and so that a
 * partial update only touches the fields that were actually sent.
 */
export function pickFields<T extends Record<string, any>>(data: T, allowed: readonly string[]): Partial<T> {
  const out: Record<string, any> = {};
  if (!data || typeof data !== 'object') return out as Partial<T>;
  for (const key of allowed) {
    if (data[key] !== undefined) out[key] = data[key];
  }
  return out as Partial<T>;
}

/** All scalar field names of a model, from a Prisma `<Model>ScalarFieldEnum`, minus `omit`. */
export function scalarFields(fieldEnum: Record<string, string>, omit: readonly string[] = []): string[] {
  const skip = new Set(['id', 'createdAt', 'updatedAt', ...omit]);
  return Object.values(fieldEnum).filter((f) => !skip.has(f));
}

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
};

/** Escapes text for safe interpolation into HTML. `null`/`undefined` become ''. */
export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
}

/**
 * Parses `page` / `limit` query params into safe integers (page ≥ 1, 1 ≤ limit ≤ maxLimit),
 * falling back to the defaults when they are missing or not numbers.
 */
export function pagination(
  q: Record<string, any>,
  { defaultLimit = 20, maxLimit = 500 }: { defaultLimit?: number; maxLimit?: number } = {},
) {
  const page = Math.max(1, parseInt(q.page, 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(q.limit, 10) || defaultLimit));
  return { page, limit, skip: (page - 1) * limit };
}

/** Parses a number field, throwing 400 when it is present but not a finite number. */
export function toNumber(value: unknown, field: string): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const n = Number(value);
  if (!Number.isFinite(n)) throw new HttpError(400, `${field} must be a number`);
  return n;
}

/** Parses a date field, throwing 400 when it is present but not a valid date. */
export function toDate(value: unknown, field: string): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const d = new Date(value as any);
  if (Number.isNaN(d.getTime())) throw new HttpError(400, `${field} must be a valid date`);
  return d;
}
