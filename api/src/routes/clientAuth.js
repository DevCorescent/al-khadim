const router = require('express').Router();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const rateLimit = require('express-rate-limit');
const { authenticateClient, authorizeCompanyAdmin, authenticateApprovedClient } = require('../middleware/clientAuth');
const { sendInviteEmail, INVITE_EXPIRY_DAYS } = require('../utils/clientPortalMail');
const { redeemTicket } = require('../utils/otp');
const { sendTemplatedMail } = require('../utils/templateRenderer');

const prisma = new PrismaClient();

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });

function generateTokens(clientUserId) {
  const access = jwt.sign({ clientUserId, type: 'client' }, process.env.JWT_SECRET, { expiresIn: '15m' });
  const refresh = jwt.sign({ clientUserId, type: 'client' }, process.env.JWT_REFRESH_SECRET, { expiresIn: '30d' });
  return { access, refresh };
}

function publicClientUser(cu) {
  return {
    id: cu.id,
    name: cu.name,
    email: cu.email,
    role: cu.role,
    client: { id: cu.client.id, companyName: cu.client.companyName, status: cu.client.status },
  };
}

/* ── Login (public) ── */
router.post('/login', limiter, async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  try {
    const clientUser = await prisma.clientUser.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: { client: true },
    });

    if (!clientUser || !clientUser.isActive || !clientUser.client.isActive || !clientUser.password) {
      return res.status(401).json({ error: 'Invalid credentials or account not yet activated.' });
    }

    const valid = await bcrypt.compare(password, clientUser.password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const { access, refresh } = generateTokens(clientUser.id);
    await prisma.clientUser.update({
      where: { id: clientUser.id },
      data: { refreshToken: refresh, lastLogin: new Date() },
    });

    res.json({ accessToken: access, refreshToken: refresh, clientUser: publicClientUser(clientUser) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

/* ── Register a new business profile (public) ── */
router.post('/register', limiter, async (req, res) => {
  try {
    const {
      companyName, contactPerson, email, phone, altPhone, industry, industryId,
      country, city, address, website, password, emailVerificationTicket,
    } = req.body;

    if (!companyName || !contactPerson || !email || !phone || !password) {
      return res.status(400).json({ error: 'Company name, contact person, email, phone and password are required' });
    }
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

    const normalizedEmail = email.toLowerCase().trim();
    const otp = await redeemTicket(emailVerificationTicket, normalizedEmail, 'COMPANY_REGISTRATION');

    const existingClientUser = await prisma.clientUser.findUnique({ where: { email: normalizedEmail } });
    if (existingClientUser) return res.status(409).json({ error: 'An account with this email already exists. Please log in.' });

    const existingClient = await prisma.client.findFirst({ where: { email: normalizedEmail } });
    if (existingClient) return res.status(409).json({ error: 'A company record with this email already exists. Please contact Al Khadim.' });

    const hashedPassword = await bcrypt.hash(password, 12);

    const client = await prisma.$transaction(async (tx) => {
      const newClient = await tx.client.create({
        data: {
          companyName, contactPerson, email: normalizedEmail, phone,
          altPhone: altPhone || null, industry: industry || null, industryId: industryId || null,
          country: country || 'UAE', city: city || null, address: address || null,
          website: website || null, source: 'SELF_SIGNUP', status: 'PENDING',
        },
      });
      const clientUser = await tx.clientUser.create({
        data: {
          clientId: newClient.id, name: contactPerson, email: normalizedEmail,
          password: hashedPassword, role: 'COMPANY_ADMIN', acceptedAt: new Date(),
        },
      });
      await tx.otpCode.update({ where: { id: otp.id }, data: { ticketUsedAt: new Date() } });
      return { newClient, clientUser };
    });

    const { access, refresh } = generateTokens(client.clientUser.id);
    await prisma.clientUser.update({
      where: { id: client.clientUser.id },
      data: { refreshToken: refresh, lastLogin: new Date() },
    });

    sendTemplatedMail({
      templateSlug: 'client-signup-review',
      to: normalizedEmail,
      data: { contactPerson, companyName },
    }).catch((e) => console.error('company signup confirmation email failed', e));

    prisma.user.findMany({ where: { role: { in: ['SUPER_ADMIN', 'ADMIN'] }, isActive: true }, select: { email: true } })
      .then((admins) => Promise.all(admins.map((a) => sendTemplatedMail({
        templateSlug: 'admin-new-company-registration',
        to: a.email,
        data: { companyName, contactPerson, email: normalizedEmail },
      }).catch((e) => console.error('admin notify failed', e)))))
      .catch((e) => console.error('admin lookup failed', e));

    res.status(201).json({
      accessToken: access,
      refreshToken: refresh,
      clientUser: publicClientUser({ ...client.clientUser, client: client.newClient }),
    });
  } catch (err) {
    console.error(err);
    if (err.code === 'P2002') return res.status(409).json({ error: 'An account with this email already exists.' });
    res.status(err.status || 400).json({ error: err.message });
  }
});

/* ── Refresh token ── */
router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(401).json({ error: 'Refresh token required' });

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    if (decoded.type !== 'client') return res.status(401).json({ error: 'Invalid token type' });

    const clientUser = await prisma.clientUser.findUnique({ where: { id: decoded.clientUserId } });
    if (!clientUser || clientUser.refreshToken !== refreshToken || !clientUser.isActive) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    const { access, refresh } = generateTokens(clientUser.id);
    await prisma.clientUser.update({ where: { id: clientUser.id }, data: { refreshToken: refresh } });
    res.json({ accessToken: access, refreshToken: refresh });
  } catch {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

/* ── Logout ── */
router.post('/logout', authenticateClient, async (req, res) => {
  await prisma.clientUser.update({ where: { id: req.clientUser.id }, data: { refreshToken: null } });
  res.json({ message: 'Logged out' });
});

/* ── Get my account ── */
router.get('/me', authenticateClient, (req, res) => {
  res.json(publicClientUser({ ...req.clientUser, client: req.client }));
});

/* ── Change password ── */
router.put('/change-password', authenticateClient, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Both passwords required' });
  if (newPassword.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

  try {
    const valid = await bcrypt.compare(currentPassword, req.clientUser.password);
    if (!valid) return res.status(400).json({ error: 'Current password is incorrect' });

    const hashed = await bcrypt.hash(newPassword, 12);
    await prisma.clientUser.update({ where: { id: req.clientUser.id }, data: { password: hashed } });
    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

/* ── Accept invite: view (public) ── */
router.get('/accept-invite/:token', async (req, res) => {
  const clientUser = await prisma.clientUser.findUnique({
    where: { inviteToken: req.params.token },
    include: { client: { select: { companyName: true } } },
  });
  if (!clientUser || !clientUser.inviteExpiresAt || clientUser.inviteExpiresAt < new Date()) {
    return res.status(404).json({ error: 'This invite link is invalid or has expired.' });
  }
  res.json({ name: clientUser.name, email: clientUser.email, companyName: clientUser.client.companyName });
});

/* ── Accept invite: set password (public) ── */
router.post('/accept-invite/:token', async (req, res) => {
  const { password } = req.body;
  if (!password || password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

  const clientUser = await prisma.clientUser.findUnique({ where: { inviteToken: req.params.token } });
  if (!clientUser || !clientUser.inviteExpiresAt || clientUser.inviteExpiresAt < new Date()) {
    return res.status(404).json({ error: 'This invite link is invalid or has expired.' });
  }

  const hashed = await bcrypt.hash(password, 12);
  const { access, refresh } = generateTokens(clientUser.id);
  const updated = await prisma.clientUser.update({
    where: { id: clientUser.id },
    data: {
      password: hashed,
      acceptedAt: new Date(),
      inviteToken: null,
      inviteExpiresAt: null,
      refreshToken: refresh,
      lastLogin: new Date(),
    },
    include: { client: true },
  });

  res.json({ accessToken: access, refreshToken: refresh, clientUser: publicClientUser(updated) });
});

/* ── Team: list (any teammate) ── */
router.get('/team', authenticateApprovedClient, async (req, res) => {
  const team = await prisma.clientUser.findMany({
    where: { clientId: req.client.id },
    select: {
      id: true, name: true, email: true, role: true, isActive: true,
      lastLogin: true, acceptedAt: true, inviteExpiresAt: true, createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  });
  res.json(team);
});

/* ── Team: invite a teammate (company admin only) ── */
router.post('/team/invite', authenticateApprovedClient, authorizeCompanyAdmin, async (req, res) => {
  const { name, email, role } = req.body;
  if (!name || !email) return res.status(400).json({ error: 'Name and email are required' });

  try {
    const inviteToken = crypto.randomBytes(32).toString('hex');
    const inviteExpiresAt = new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    const clientUser = await prisma.clientUser.create({
      data: {
        clientId: req.client.id,
        name,
        email: email.toLowerCase().trim(),
        role: role === 'COMPANY_ADMIN' ? 'COMPANY_ADMIN' : 'COMPANY_MEMBER',
        inviteToken,
        inviteExpiresAt,
        invitedByClientUserId: req.clientUser.id,
      },
    });

    await sendInviteEmail({
      clientUser,
      inviteToken,
      companyName: req.client.companyName,
      invitedByName: req.clientUser.name,
    });

    res.status(201).json({ id: clientUser.id, name: clientUser.name, email: clientUser.email, role: clientUser.role });
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'A user with this email already exists' });
    res.status(400).json({ error: err.message });
  }
});

/* ── Team: toggle a teammate's active state (company admin only) ── */
router.patch('/team/:id/toggle-active', authenticateApprovedClient, authorizeCompanyAdmin, async (req, res) => {
  const target = await prisma.clientUser.findUnique({ where: { id: req.params.id } });
  if (!target || target.clientId !== req.client.id) return res.status(404).json({ error: 'User not found' });
  if (target.id === req.clientUser.id) return res.status(400).json({ error: "You can't deactivate your own account" });

  const updated = await prisma.clientUser.update({
    where: { id: target.id },
    data: { isActive: !target.isActive },
  });
  res.json({ id: updated.id, isActive: updated.isActive });
});

module.exports = router;
