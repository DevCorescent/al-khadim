// Ported from api/src/routes/clientUsers.js
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '../permissions';
import { body, handler, json, query } from '../http';
import { INVITE_EXPIRY_DAYS, sendInviteEmail } from '../utils/clientPortalMail';

/** Never return the password hash, refresh token or invite token. */
const PUBLIC_SELECT = {
  id: true, clientId: true, name: true, email: true, role: true, isActive: true,
  lastLogin: true, acceptedAt: true, inviteExpiresAt: true, invitedByStaffId: true,
  invitedByClientUserId: true, createdAt: true, updatedAt: true,
};

const ROLES = ['COMPANY_ADMIN', 'COMPANY_MEMBER'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* ── List portal users for a client ── */
export const list = handler(async (req) => {
  await requirePermission(req, 'clients', 'view');
  const { clientId } = query(req);
  if (!clientId) return json({ error: 'clientId is required' }, 400);

  const users = await prisma.clientUser.findMany({
    where: { clientId: String(clientId) },
    select: {
      id: true, name: true, email: true, role: true, isActive: true,
      lastLogin: true, acceptedAt: true, inviteExpiresAt: true, createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  });
  return json(users);
});

/* ── Create/invite a portal user (typically the first COMPANY_ADMIN for a new vendor) ── */
export const create = handler(async (req) => {
  const me = await requirePermission(req, 'clients', 'edit');
  const { clientId, name, email, role } = await body(req);
  if (!clientId || !name || !email) return json({ error: 'clientId, name and email are required' }, 400);
  if (typeof clientId !== 'string' || typeof name !== 'string' || typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
    return json({ error: 'A valid clientId, name and email are required' }, 400);
  }

  try {
    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) return json({ error: 'Client not found' }, 404);

    const inviteToken = crypto.randomBytes(32).toString('hex');
    const inviteExpiresAt = new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    const clientUser = await prisma.clientUser.create({
      data: {
        clientId,
        name,
        email: email.toLowerCase().trim(),
        role: role === 'COMPANY_MEMBER' ? 'COMPANY_MEMBER' : 'COMPANY_ADMIN',
        inviteToken,
        inviteExpiresAt,
        invitedByStaffId: me.id,
      },
      select: PUBLIC_SELECT,
    });

    await sendInviteEmail({
      clientUser,
      inviteToken,
      companyName: client.companyName,
      invitedByName: me.name,
    });

    return json(clientUser, 201);
  } catch (err: any) {
    if (err.code === 'P2002') return json({ error: 'A portal user with this email already exists' }, 409);
    return json({ error: err.message }, 400);
  }
});

/* ── Update a portal user's name/role ── */
export const update = handler<{ id: string }>(async (req, { params }) => {
  await requirePermission(req, 'clients', 'edit');
  const { name, role } = await body(req);
  if (name !== undefined && (typeof name !== 'string' || !name.trim())) return json({ error: 'Name cannot be empty' }, 400);
  if (role !== undefined && !ROLES.includes(role)) return json({ error: 'Invalid role' }, 400);
  const target = await prisma.clientUser.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!target) return json({ error: 'Portal user not found' }, 404);
  const updated = await prisma.clientUser.update({
    where: { id: target.id },
    data: { ...(name && { name: name.trim() }), ...(role && { role }) },
    select: PUBLIC_SELECT,
  });
  return json(updated);
});

/* ── Toggle active state (e.g. contact left the company) ── */
export const toggleActive = handler<{ id: string }>(async (req, { params }) => {
  await requirePermission(req, 'clients', 'edit');
  const target = await prisma.clientUser.findUnique({ where: { id: params.id } });
  if (!target) return json({ error: 'Portal user not found' }, 404);
  const updated = await prisma.clientUser.update({
    where: { id: target.id },
    data: { isActive: !target.isActive },
  });
  return json({ id: updated.id, isActive: updated.isActive });
});

/* ── Resend invite ── */
export const resendInvite = handler<{ id: string }>(async (req, { params }) => {
  const me = await requirePermission(req, 'clients', 'edit');
  const target = await prisma.clientUser.findUnique({ where: { id: params.id }, include: { client: true } });
  if (!target) return json({ error: 'Portal user not found' }, 404);
  if (target.acceptedAt) return json({ error: 'This user has already accepted their invite' }, 400);

  const inviteToken = crypto.randomBytes(32).toString('hex');
  const inviteExpiresAt = new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
  const updated = await prisma.clientUser.update({
    where: { id: target.id },
    data: { inviteToken, inviteExpiresAt },
  });

  await sendInviteEmail({
    clientUser: updated,
    inviteToken,
    companyName: target.client.companyName,
    invitedByName: me.name,
  });

  return json({ message: 'Invite resent' });
});

/* ── Delete a portal user ── */
export const remove = handler<{ id: string }>(async (req, { params }) => {
  await requirePermission(req, 'clients', 'delete');
  const target = await prisma.clientUser.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!target) return json({ error: 'Portal user not found' }, 404);
  try {
    await prisma.clientUser.delete({ where: { id: target.id } });
    return json({ message: 'Portal user removed' });
  } catch (err: any) {
    // e.g. the user already responded to profile shares / requested jobs
    return json({ error: err.code === 'P2003' ? 'This portal user has linked records; deactivate them instead.' : err.message }, 400);
  }
});
