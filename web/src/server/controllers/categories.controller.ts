// Ported from api/src/routes/categories.js
import { prisma } from '@/lib/prisma';
import { requirePermission } from '../permissions';
import { body, handler, HttpError, json } from '../http';
import { pickFields, toNumber } from '../validate';

const FIELDS = ['name', 'description', 'color', 'order'];

/** Whitelists and validates a category payload; with `partial` only sent fields are touched. */
function categoryData(raw: any, partial: boolean) {
  const data: any = pickFields(raw || {}, FIELDS);
  if (!partial || 'name' in data) {
    if (typeof data.name !== 'string' || !data.name.trim()) throw new HttpError(400, 'Category name is required');
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
  return data;
}

/* ── List all categories (public — used in dropdowns everywhere, incl. company portal) ── */
export const list = handler(async () => {
  const categories = await prisma.category.findMany({ orderBy: [{ order: 'asc' }, { name: 'asc' }] });
  return json(categories);
});

/* ── Create category ── */
export const create = handler(async (req) => {
  await requirePermission(req, 'settings', 'edit');
  const data = categoryData(await body(req), false);
  try {
    const category = await prisma.category.create({ data: { color: '#6366f1', order: 0, ...data } });
    return json(category, 201);
  } catch (err: any) {
    if (err.code === 'P2002') return json({ error: 'A category with this name already exists' }, 409);
    throw err;
  }
});

/* ── Update category ── */
export const update = handler<{ id: string }>(async (req, { params }) => {
  await requirePermission(req, 'settings', 'edit');
  const data = categoryData(await body(req), true);
  try {
    const category = await prisma.category.update({ where: { id: params.id }, data });
    return json(category);
  } catch (err: any) {
    if (err.code === 'P2002') return json({ error: 'A category with this name already exists' }, 409);
    if (err.code === 'P2025') return json({ error: 'Category not found' }, 404);
    throw err;
  }
});

/* ── Delete category (blocked if still in use) ── */
export const remove = handler<{ id: string }>(async (req, { params }) => {
  await requirePermission(req, 'settings', 'edit');
  const { id } = params;
  const [candidateCount, jobCount] = await Promise.all([
    prisma.candidate.count({ where: { categoryId: id } }),
    prisma.job.count({ where: { categoryId: id } }),
  ]);
  if (candidateCount > 0 || jobCount > 0) {
    return json({
      error: `Cannot delete — still used by ${candidateCount} candidate(s) and ${jobCount} job(s). Reassign them first.`,
    }, 409);
  }
  try {
    await prisma.category.delete({ where: { id } });
    return json({ message: 'Category deleted' });
  } catch (err: any) {
    if (err.code === 'P2025') return json({ error: 'Category not found' }, 404);
    throw err;
  }
});
