// Ported from api/src/routes/emailGroups.js
import { prisma } from '@/lib/prisma';
import { requirePermission } from '../permissions';
import { body, handler, json, query } from '../http';
import { pagination, pickFields } from '../validate';
import { RESOLVERS, resolveAudienceForSend } from '../utils/audienceQuery';

const WRITABLE_FIELDS = ['name', 'description'] as const;

function checkGroupFields(data: Record<string, any>) {
  if (data.name !== undefined && data.name !== null && typeof data.name !== 'string') return 'name must be a string';
  if (data.description !== undefined && data.description !== null && typeof data.description !== 'string') {
    return 'description must be a string';
  }
  return null;
}

/* ── List groups + member counts ── */
export const list = handler(async (req) => {
  await requirePermission(req, 'emails', 'view');
  const groups = await prisma.emailGroup.findMany({
    include: { _count: { select: { members: true } } },
    orderBy: { updatedAt: 'desc' },
  });
  return json(
    groups.map((g) => ({
      id: g.id,
      name: g.name,
      description: g.description,
      memberCount: g._count.members,
      createdAt: g.createdAt,
      updatedAt: g.updatedAt,
    }))
  );
});

/* ── Group detail + paginated members (?page=&limit=&search=) ── */
export const get = handler<{ id: string }>(async (req, { params }) => {
  await requirePermission(req, 'emails', 'view');
  const group = await prisma.emailGroup.findUnique({ where: { id: params.id } });
  if (!group) return json({ error: 'Group not found' }, 404);

  const q = query(req);
  const { search } = q;
  const { page, limit, skip } = pagination(q, { defaultLimit: 20 });
  const where: any = { groupId: group.id };
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ];
  }
  const [total, members] = await Promise.all([
    prisma.emailGroupMember.count({ where }),
    prisma.emailGroupMember.findMany({
      where,
      skip,
      take: limit,
      orderBy: { addedAt: 'desc' },
    }),
  ]);

  return json({
    id: group.id,
    name: group.name,
    description: group.description,
    createdAt: group.createdAt,
    updatedAt: group.updatedAt,
    members: {
      data: members.map((m) => ({
        id: m.id,
        recipientType: m.recipientType,
        recipientId: m.recipientId,
        name: m.name,
        email: m.email,
        addedAt: m.addedAt,
      })),
      total,
      page,
      limit,
    },
  });
});

/* ── Create group ── */
export const create = handler(async (req) => {
  const user = await requirePermission(req, 'emails', 'create');
  const fields: Record<string, any> = pickFields((await body(req)) || {}, WRITABLE_FIELDS);
  const invalid = checkGroupFields(fields);
  if (invalid) return json({ error: invalid }, 400);
  const { name, description } = fields;
  if (!name || !name.trim()) return json({ error: 'name is required' }, 400);

  const existing = await prisma.emailGroup.findUnique({ where: { name: name.trim() } });
  if (existing) return json({ error: `A group named "${name.trim()}" already exists` }, 400);

  try {
    const group = await prisma.emailGroup.create({
      data: {
        name: name.trim(),
        description: description || null,
        createdBy: user.id,
      },
    });
    return json(group, 201);
  } catch (err: any) {
    if (err.code === 'P2002') {
      return json({ error: `A group named "${name.trim()}" already exists` }, 400);
    }
    return json({ error: err.message }, 400);
  }
});

/* ── Update group (rename/description) ── */
export const update = handler<{ id: string }>(async (req, { params }) => {
  await requirePermission(req, 'emails', 'edit');
  const existing = await prisma.emailGroup.findUnique({ where: { id: params.id } });
  if (!existing) return json({ error: 'Group not found' }, 404);

  const fields: Record<string, any> = pickFields((await body(req)) || {}, WRITABLE_FIELDS);
  const invalid = checkGroupFields(fields);
  if (invalid) return json({ error: invalid }, 400);
  const { name, description } = fields;
  if (name !== undefined && (name === null || !name.trim())) {
    return json({ error: 'name cannot be blank' }, 400);
  }
  if (name !== undefined && name.trim() !== existing.name) {
    const nameTaken = await prisma.emailGroup.findUnique({ where: { name: name.trim() } });
    if (nameTaken) return json({ error: `A group named "${name.trim()}" already exists` }, 400);
  }

  const data: any = {};
  if (name !== undefined) data.name = name.trim();
  if (description !== undefined) data.description = description || null;

  try {
    const group = await prisma.emailGroup.update({ where: { id: params.id }, data });
    return json(group);
  } catch (err: any) {
    if (err.code === 'P2002') {
      return json({ error: `A group named "${name?.trim()}" already exists` }, 400);
    }
    return json({ error: err.message }, 400);
  }
});

/* ── Delete group (members cascade) ── */
export const remove = handler<{ id: string }>(async (req, { params }) => {
  await requirePermission(req, 'emails', 'delete');
  const existing = await prisma.emailGroup.findUnique({ where: { id: params.id } });
  if (!existing) return json({ error: 'Group not found' }, 404);
  await prisma.emailGroup.delete({ where: { id: params.id } });
  return json({ message: 'Group deleted' });
});

/* ── Add members — direct snapshot rows, or bulk-add everyone matching a filter ── */
export const addMembers = handler<{ id: string }>(async (req, { params }) => {
  await requirePermission(req, 'emails', 'edit');
  const existing = await prisma.emailGroup.findUnique({ where: { id: params.id } });
  if (!existing) return json({ error: 'Group not found' }, 404);

  const { members, recipientType, filters } = (await body(req)) || {};

  let rows: any[] = [];
  try {
    if (Array.isArray(members)) {
      rows = members
        .filter((m: any) => m && RESOLVERS[m.recipientType] && m.recipientId && m.name && m.email
          && typeof m.name === 'string' && typeof m.email === 'string')
        .map((m: any) => ({
          recipientType: m.recipientType,
          recipientId: String(m.recipientId),
          name: m.name,
          email: m.email,
        }));
    } else if (recipientType) {
      if (!RESOLVERS[recipientType]) return json({ error: `Unknown recipient type "${recipientType}"` }, 400);
      const audience: any[] = await resolveAudienceForSend(recipientType, filters || {});
      rows = audience.map((r) => ({
        recipientType,
        recipientId: r.id,
        name: r.name,
        email: r.email,
      }));
    } else {
      return json({ error: 'Provide either members[] or {recipientType, filters}' }, 400);
    }
  } catch (err: any) {
    return json({ error: err.message }, err.status || 400);
  }

  if (rows.length === 0) {
    return json({ added: 0 });
  }

  const result = await prisma.emailGroupMember.createMany({
    data: rows.map((r) => ({
      groupId: params.id,
      recipientType: r.recipientType,
      recipientId: r.recipientId,
      name: r.name,
      email: r.email,
    })),
    skipDuplicates: true,
  });
  return json({ added: result.count });
});

/* ── Remove one member (scoped to this group) ── */
export const removeMember = handler<{ id: string; memberId: string }>(async (req, { params }) => {
  await requirePermission(req, 'emails', 'edit');
  const member = await prisma.emailGroupMember.findUnique({ where: { id: params.memberId } });
  if (!member || member.groupId !== params.id) {
    return json({ error: 'Member not found in this group' }, 404);
  }
  await prisma.emailGroupMember.delete({ where: { id: params.memberId } });
  return json({ message: 'Member removed' });
});
