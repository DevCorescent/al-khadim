// Ported from api/src/routes/candidateTracking.js
import { prisma } from '@/lib/prisma';
import { requirePermission } from '../permissions';
import { body, handler, json, query } from '../http';
import { parseCsvUpload } from '../upload';
import { applyTrackingCsv, buildTrackingCsv, parseCsv } from '../utils/trackingCsv';
import { pagination } from '../validate';

const INDUSTRY_BADGE = { select: { key: true, name: true, color: true } };
const VISIBILITIES = ['PRIVATE', 'PUBLIC'];
/** Upper bound for "Row N" table rows in an imported CSV (guards against huge sparse arrays). */
const MAX_TABLE_ROWS = 500;

function toTemplate(industry: any) {
  const sections = Array.isArray(industry.trackingSections) ? industry.trackingSections : [];
  return { label: industry.name, sections };
}

function csvResponse(csv: string, filename: string) {
  // Names come from user data — keep the header value to safe characters.
  const safeName = filename.replace(/[^\w.-]+/g, '_');
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${safeName}"`,
    },
  });
}

/* ── Templates (public — no PII here, just field definitions; consumed by staff,
 * candidate portal, company portal, and the public tokenized share view alike) ── */
export const templates = handler(async () => {
  const industries = await prisma.industry.findMany({ where: { hasTracking: true }, orderBy: { order: 'asc' } });
  const out: Record<string, any> = {};
  for (const ind of industries) out[ind.key] = toTemplate(ind);
  return json(out);
});

/* ── Blank sample CSV for an industry — same shape export/import use, so it
 * doubles as a fillable template. ── */
export const sampleCsv = handler(async (req) => {
  await requirePermission(req, 'candidates', 'view');
  const { industry: industryKey } = query(req);
  if (!industryKey || typeof industryKey !== 'string') return json({ error: 'industry is required' }, 400);
  const industry = await prisma.industry.findUnique({ where: { key: industryKey } });
  if (!industry || !industry.hasTracking) return json({ error: 'Invalid industry' }, 400);

  const csv = buildTrackingCsv(toTemplate(industry), {});
  return csvResponse(csv, `${industryKey}_tracking_template.csv`);
});

/* ── List tracking records for a candidate ── */
export const list = handler(async (req) => {
  await requirePermission(req, 'candidates', 'view');
  const q = query(req);
  const { candidateId, industry, visibility } = q;

  if (candidateId) {
    const records = await prisma.candidateTracking.findMany({
      where: { candidateId: String(candidateId) },
      include: { updatedByUser: { select: { id: true, name: true } }, industry: INDUSTRY_BADGE },
      orderBy: { createdAt: 'asc' },
    });
    return json(records);
  }

  // No candidateId: global admin listing across all candidates.
  const where: any = {};
  if (industry) where.industry = { key: String(industry) };
  if (visibility) {
    if (!VISIBILITIES.includes(String(visibility))) return json({ error: 'Invalid visibility' }, 400);
    where.visibility = visibility;
  }

  const { page, limit, skip } = pagination(q, { defaultLimit: 20, maxLimit: 200 });
  const [data, total] = await Promise.all([
    prisma.candidateTracking.findMany({
      where,
      skip,
      take: limit,
      orderBy: { updatedAt: 'desc' },
      include: {
        candidate: { select: { id: true, firstName: true, lastName: true, photo: true } },
        updatedByUser: { select: { id: true, name: true } },
        industry: INDUSTRY_BADGE,
      },
    }),
    prisma.candidateTracking.count({ where }),
  ]);
  return json({ data, total, page });
});

/* ── Get one record ── */
export const get = handler<{ id: string }>(async (req, { params }) => {
  await requirePermission(req, 'candidates', 'view');
  const record = await prisma.candidateTracking.findUnique({
    where: { id: params.id },
    include: {
      candidate: { select: { id: true, firstName: true, lastName: true, photo: true } },
      updatedByUser: { select: { id: true, name: true } },
      industry: INDUSTRY_BADGE,
    },
  });
  if (!record) return json({ error: 'Tracking record not found' }, 404);
  return json(record);
});

/* ── Start tracking a candidate for an industry ── */
export const create = handler(async (req) => {
  const user = await requirePermission(req, 'candidates', 'edit');
  const { candidateId, industry: industryKey } = await body(req);
  if (!candidateId || !industryKey || typeof candidateId !== 'string' || typeof industryKey !== 'string') {
    return json({ error: 'candidateId and industry are required' }, 400);
  }

  const industry = await prisma.industry.findUnique({ where: { key: industryKey } });
  if (!industry || !industry.hasTracking) return json({ error: 'Invalid industry' }, 400);

  const candidate = await prisma.candidate.findUnique({ where: { id: candidateId } });
  if (!candidate) return json({ error: 'Candidate not found' }, 404);

  const record = await prisma.candidateTracking.upsert({
    where: { candidateId_industryId: { candidateId, industryId: industry.id } },
    update: {},
    create: { candidateId, industryId: industry.id, data: {}, updatedByUserId: user.id },
    include: { industry: INDUSTRY_BADGE },
  });
  return json(record, 201);
});

/* ── Update data / visibility ── */
export const update = handler<{ id: string }>(async (req, { params }) => {
  const user = await requirePermission(req, 'candidates', 'edit');
  const { data, visibility, visibleToCandidate, visibleToCompany } = await body(req);
  const existing = await prisma.candidateTracking.findUnique({ where: { id: params.id } });
  if (!existing) return json({ error: 'Tracking record not found' }, 404);

  const updateData: any = { updatedByUserId: user.id };
  if (data !== undefined) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return json({ error: 'data must be an object' }, 400);
    updateData.data = data;
  }
  if (visibility !== undefined) {
    if (!VISIBILITIES.includes(visibility)) return json({ error: 'Invalid visibility' }, 400);
    updateData.visibility = visibility;
  }
  if (visibleToCandidate !== undefined) updateData.visibleToCandidate = !!visibleToCandidate;
  if (visibleToCompany !== undefined) updateData.visibleToCompany = !!visibleToCompany;

  const updated = await prisma.candidateTracking.update({
    where: { id: params.id },
    data: updateData,
    include: { industry: INDUSTRY_BADGE },
  });
  return json(updated);
});

/* ── Export current data as CSV ── */
export const exportCsv = handler<{ id: string }>(async (req, { params }) => {
  await requirePermission(req, 'candidates', 'view');
  const record = await prisma.candidateTracking.findUnique({
    where: { id: params.id },
    include: { candidate: { select: { firstName: true, lastName: true } }, industry: true },
  });
  if (!record) return json({ error: 'Tracking record not found' }, 404);

  const csv = buildTrackingCsv(toTemplate(record.industry), (record.data as any) || {});
  const name = `${record.candidate.firstName}_${record.candidate.lastName}_${record.industry.key}_tracking`.replace(/\s+/g, '_');
  return csvResponse(csv, `${name}.csv`);
});

/* ── Import a filled CSV, replacing this record's data wholesale ── */
export const importCsv = handler<{ id: string }>(async (req, { params }) => {
  const user = await requirePermission(req, 'candidates', 'edit');
  const { file } = await parseCsvUpload(req, 'file');
  try {
    if (!file) return json({ error: 'CSV file is required' }, 400);
    const record = await prisma.candidateTracking.findUnique({ where: { id: params.id }, include: { industry: true } });
    if (!record) return json({ error: 'Tracking record not found' }, 404);

    const rows = parseCsv(file.buffer.toString('utf-8'));
    const tooManyRows = rows.some((r) => r.some((cell) => {
      const m = /^\s*Row (\d+) - /i.exec(cell || '');
      return !!m && Number(m[1]) > MAX_TABLE_ROWS;
    }));
    if (tooManyRows) return json({ error: `Table rows are limited to ${MAX_TABLE_ROWS}` }, 400);
    const data = applyTrackingCsv(toTemplate(record.industry), rows);

    const updated = await prisma.candidateTracking.update({
      where: { id: record.id },
      data: { data, updatedByUserId: user.id },
      include: { industry: INDUSTRY_BADGE },
    });
    return json(updated);
  } catch (err: any) {
    return json({ error: err.message || 'Failed to import CSV' }, 400);
  }
});

/* ── Remove a tracking record ── */
export const remove = handler<{ id: string }>(async (req, { params }) => {
  await requirePermission(req, 'candidates', 'delete');
  try {
    await prisma.candidateTracking.delete({ where: { id: params.id } });
    return json({ message: 'Tracking record removed' });
  } catch (err: any) {
    if (err?.code === 'P2025') return json({ error: 'Tracking record not found' }, 404);
    throw err;
  }
});
