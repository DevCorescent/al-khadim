// Ported from api/src/routes/industries.js
import { prisma } from '@/lib/prisma';
import { requireStaff } from '../auth';
import { requirePermission } from '../permissions';
import { body, handler, HttpError, json, query } from '../http';
import { pickFields, toNumber } from '../validate';

function slugify(name: string) {
  return String(name).toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

async function uniqueKey(name: string) {
  const base = slugify(name) || 'INDUSTRY';
  let key = base;
  let n = 2;
  while (await prisma.industry.findUnique({ where: { key } })) {
    key = `${base}_${n}`;
    n++;
  }
  return key;
}

const isObject = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);

/**
 * Validates a tracking template (sections → fields) so the CSV export/import and
 * the portals never crash on a malformed one. Missing `fields` / `items` /
 * `columns` arrays are normalised to [] (the template builder creates fields
 * before their items/columns are filled in).
 */
function normalizeTrackingSections(value: unknown) {
  if (value === null) return [];
  if (!Array.isArray(value)) throw new HttpError(400, 'trackingSections must be an array of sections');
  return value.map((section, i) => {
    if (!isObject(section) || typeof section.key !== 'string' || typeof section.label !== 'string') {
      throw new HttpError(400, `trackingSections[${i}] must have a string key and label`);
    }
    const fields = section.fields ?? [];
    if (!Array.isArray(fields)) throw new HttpError(400, `trackingSections[${i}].fields must be an array`);
    return {
      ...section,
      fields: fields.map((field, j) => {
        if (!isObject(field) || typeof field.key !== 'string' || typeof field.label !== 'string' || typeof field.type !== 'string') {
          throw new HttpError(400, `trackingSections[${i}].fields[${j}] must have a string key, label and type`);
        }
        const out: Record<string, any> = { ...field };
        if (field.type === 'checklist') {
          const items = field.items ?? [];
          if (!Array.isArray(items)) throw new HttpError(400, `trackingSections[${i}].fields[${j}].items must be an array`);
          out.items = items.map((it) => String(it));
        }
        if (field.type === 'table') {
          const columns = field.columns ?? [];
          if (!Array.isArray(columns) || columns.some((c) => !isObject(c) || typeof c.key !== 'string' || typeof c.label !== 'string')) {
            throw new HttpError(400, `trackingSections[${i}].fields[${j}].columns must be an array of { key, label }`);
          }
          out.columns = columns;
        }
        return out;
      }),
    };
  });
}

const FIELDS = ['name', 'description', 'color', 'order', 'hasTracking', 'trackingSections'];

/** Whitelists and validates an industry payload; with `partial` only sent fields are touched. */
function industryData(raw: any, partial: boolean) {
  const data: any = pickFields(raw || {}, FIELDS);
  if (!partial || 'name' in data) {
    if (typeof data.name !== 'string' || !data.name.trim()) throw new HttpError(400, 'Industry name is required');
    data.name = data.name.trim();
  }
  if (data.description !== undefined && data.description !== null) data.description = String(data.description);
  if (data.color !== undefined) {
    if (data.color === '' || data.color === null) delete data.color;
    else if (typeof data.color !== 'string') throw new HttpError(400, 'Invalid color');
  }
  if (data.order !== undefined) {
    const n = toNumber(data.order, 'order');
    if (n === undefined) delete data.order;
    else data.order = Math.trunc(n);
  }
  if (data.hasTracking !== undefined) data.hasTracking = data.hasTracking === true || data.hasTracking === 'true' || data.hasTracking === 'on';
  if (data.trackingSections !== undefined) data.trackingSections = normalizeTrackingSections(data.trackingSections);
  return data;
}

/* ── List all industries (public — used in dropdowns everywhere, incl. public signup forms) ── */
export const list = handler(async (req) => {
  const { hasTracking } = query(req);
  const where: any = {};
  if (hasTracking !== undefined) where.hasTracking = hasTracking === 'true';
  const industries = await prisma.industry.findMany({
    where,
    orderBy: [{ order: 'asc' }, { name: 'asc' }],
    select: { id: true, key: true, name: true, description: true, color: true, order: true, hasTracking: true },
  });
  return json(industries);
});

/* ── Get a single industry (incl. its tracking template, for the builder page) ── */
export const get = handler<{ id: string }>(async (req, { params }) => {
  await requireStaff(req);
  const industry = await prisma.industry.findUnique({ where: { id: params.id } });
  if (!industry) return json({ error: 'Industry not found' }, 404);
  return json(industry);
});

/* ── Create industry ── */
export const create = handler(async (req) => {
  await requirePermission(req, 'settings', 'edit');
  const data = industryData(await body(req), false);
  const hasTracking = !!data.hasTracking;
  try {
    const key = await uniqueKey(data.name);
    const industry = await prisma.industry.create({
      data: {
        key,
        name: data.name,
        description: data.description,
        color: data.color || '#6366f1',
        order: data.order ?? 0,
        hasTracking,
        trackingSections: hasTracking ? (data.trackingSections || []) : undefined,
      },
    });
    return json(industry, 201);
  } catch (err: any) {
    if (err.code === 'P2002') return json({ error: 'An industry with this name already exists' }, 409);
    throw err;
  }
});

/* ── Update industry (name/description/color/order/hasTracking/trackingSections — key is immutable) ── */
export const update = handler<{ id: string }>(async (req, { params }) => {
  await requirePermission(req, 'settings', 'edit');
  const data = industryData(await body(req), true);
  try {
    const industry = await prisma.industry.update({ where: { id: params.id }, data });
    return json(industry);
  } catch (err: any) {
    if (err.code === 'P2002') return json({ error: 'An industry with this name already exists' }, 409);
    if (err.code === 'P2025') return json({ error: 'Industry not found' }, 404);
    throw err;
  }
});

/* ── Delete industry (blocked if still in use) ── */
export const remove = handler<{ id: string }>(async (req, { params }) => {
  await requirePermission(req, 'settings', 'edit');
  const { id } = params;
  const [candidateCount, clientCount, jobCount, trackingCount] = await Promise.all([
    prisma.candidate.count({ where: { industryId: id } }),
    prisma.client.count({ where: { industryId: id } }),
    prisma.job.count({ where: { industryId: id } }),
    prisma.candidateTracking.count({ where: { industryId: id } }),
  ]);
  if (candidateCount > 0 || clientCount > 0 || jobCount > 0 || trackingCount > 0) {
    return json({
      error: `Cannot delete — still used by ${candidateCount} candidate(s), ${clientCount} client(s), ${jobCount} job(s) and ${trackingCount} tracking record(s). Reassign them first.`,
    }, 409);
  }
  try {
    await prisma.industry.delete({ where: { id } });
    return json({ message: 'Industry deleted' });
  } catch (err: any) {
    if (err.code === 'P2025') return json({ error: 'Industry not found' }, 404);
    throw err;
  }
});
