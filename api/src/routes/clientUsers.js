const router = require('express').Router();
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const { authenticate, authorize } = require('../middleware/auth');
const { sendInviteEmail, INVITE_EXPIRY_DAYS } = require('../utils/clientPortalMail');

const prisma = new PrismaClient();

/* ── List portal users for a client ── */
router.get('/', authenticate, async (req, res) => {
  const { clientId } = req.query;
  if (!clientId) return res.status(400).json({ error: 'clientId is required' });

  const users = await prisma.clientUser.findMany({
    where: { clientId },
    select: {
      id: true, name: true, email: true, role: true, isActive: true,
      lastLogin: true, acceptedAt: true, inviteExpiresAt: true, createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  });
  res.json(users);
});

/* ── Create/invite a portal user (typically the first COMPANY_ADMIN for a new vendor) ── */
router.post('/', authenticate, authorize('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'RECRUITER'), async (req, res) => {
  const { clientId, name, email, role } = req.body;
  if (!clientId || !name || !email) return res.status(400).json({ error: 'clientId, name and email are required' });

  try {
    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) return res.status(404).json({ error: 'Client not found' });

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
        invitedByStaffId: req.user.id,
      },
    });

    await sendInviteEmail({
      clientUser,
      inviteToken,
      companyName: client.companyName,
      invitedByName: req.user.name,
    });

    res.status(201).json(clientUser);
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'A portal user with this email already exists' });
    res.status(400).json({ error: err.message });
  }
});

/* ── Update a portal user's name/role ── */
router.put('/:id', authenticate, authorize('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'RECRUITER'), async (req, res) => {
  try {
    const { name, role } = req.body;
    const updated = await prisma.clientUser.update({
      where: { id: req.params.id },
      data: { ...(name && { name }), ...(role && { role }) },
    });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/* ── Toggle active state (e.g. contact left the company) ── */
router.patch('/:id/toggle-active', authenticate, authorize('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'RECRUITER'), async (req, res) => {
  const target = await prisma.clientUser.findUnique({ where: { id: req.params.id } });
  if (!target) return res.status(404).json({ error: 'Portal user not found' });
  const updated = await prisma.clientUser.update({
    where: { id: target.id },
    data: { isActive: !target.isActive },
  });
  res.json({ id: updated.id, isActive: updated.isActive });
});

/* ── Resend invite ── */
router.post('/:id/resend-invite', authenticate, authorize('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'RECRUITER'), async (req, res) => {
  const target = await prisma.clientUser.findUnique({ where: { id: req.params.id }, include: { client: true } });
  if (!target) return res.status(404).json({ error: 'Portal user not found' });
  if (target.acceptedAt) return res.status(400).json({ error: 'This user has already accepted their invite' });

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
    invitedByName: req.user.name,
  });

  res.json({ message: 'Invite resent' });
});

/* ── Delete a portal user ── */
router.delete('/:id', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  try {
    await prisma.clientUser.delete({ where: { id: req.params.id } });
    res.json({ message: 'Portal user removed' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
