// Ported from api/src/routes/clientAuth.js
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';
import { assertCompanyAdmin, requireApprovedClient, requireClient } from '../auth';
import { body, handler, json } from '../http';
import { rateLimit } from '../rateLimit';
import { INVITE_EXPIRY_DAYS, sendInviteEmail } from '../utils/clientPortalMail';
import { redeemTicket } from '../utils/otp';
import { sendTemplatedMail } from '../utils/templateRenderer';

// Shared by /login and /register, as in Express (same instance → same per-IP budget).
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });

function generateTokens(clientUserId: string) {
  const access = jwt.sign({ clientUserId, type: 'client' }, process.env.JWT_SECRET!, { expiresIn: '15m' });
  const refresh = jwt.sign({ clientUserId, type: 'client' }, process.env.JWT_REFRESH_SECRET!, { expiresIn: '30d' });
  return { access, refresh };
}

const REGISTER_FIELDS = [
  'companyName', 'contactPerson', 'email', 'phone', 'altPhone', 'industry', 'industryId',
  'country', 'city', 'address', 'website',
] as const;

function publicClientUser(cu: any) {
  return {
    id: cu.id,
    name: cu.name,
    email: cu.email,
    role: cu.role,
    client: { id: cu.client.id, companyName: cu.client.companyName, status: cu.client.status },
  };
}

/* ── Login (public) ── */
export const login = handler(async (req) => {
  limiter(req);
  const { email, password } = await body(req);
  if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
    return json({ error: 'Email and password required' }, 400);
  }

  try {
    const clientUser = await prisma.clientUser.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: { client: true },
    });

    if (!clientUser || !clientUser.isActive || !clientUser.client.isActive || !clientUser.password) {
      return json({ error: 'Invalid credentials or account not yet activated.' }, 401);
    }

    const valid = await bcrypt.compare(password, clientUser.password);
    if (!valid) return json({ error: 'Invalid credentials' }, 401);

    const { access, refresh } = generateTokens(clientUser.id);
    await prisma.clientUser.update({
      where: { id: clientUser.id },
      data: { refreshToken: refresh, lastLogin: new Date() },
    });

    return json({ accessToken: access, refreshToken: refresh, clientUser: publicClientUser(clientUser) });
  } catch (err) {
    console.error(err);
    return json({ error: 'Server error' }, 500);
  }
});

/* ── Register a new business profile (public) ── */
export const register = handler(async (req) => {
  limiter(req);
  try {
    const b = await body(req);
    const { password, emailVerificationTicket } = b;
    // Explicit allow-list of company profile fields; status/source/isActive/approval
    // columns are always set server-side. Everything is coerced to a string.
    const f: Record<string, string | undefined> = {};
    for (const k of REGISTER_FIELDS) {
      const v = b[k];
      f[k] = v === undefined || v === null || v === '' ? undefined : String(v).trim();
    }
    const { companyName, contactPerson, email, phone, altPhone, industry, industryId, country, city, address, website } = f;

    if (!companyName || !contactPerson || !email || !phone || !password) {
      return json({ error: 'Company name, contact person, email, phone and password are required' }, 400);
    }
    if (typeof password !== 'string' || password.length < 8) return json({ error: 'Password must be at least 8 characters' }, 400);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'Please enter a valid email address' }, 400);
    if (industryId && !(await prisma.industry.findUnique({ where: { id: industryId }, select: { id: true } }))) {
      return json({ error: 'Unknown industry' }, 400);
    }

    const normalizedEmail = email.toLowerCase().trim();
    const otp = await redeemTicket(emailVerificationTicket, normalizedEmail, 'COMPANY_REGISTRATION');

    const existingClientUser = await prisma.clientUser.findUnique({ where: { email: normalizedEmail } });
    if (existingClientUser) return json({ error: 'An account with this email already exists. Please log in.' }, 409);

    const existingClient = await prisma.client.findFirst({ where: { email: normalizedEmail } });
    if (existingClient) return json({ error: 'A company record with this email already exists. Please contact Al Khadim.' }, 409);

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

    return json({
      accessToken: access,
      refreshToken: refresh,
      clientUser: publicClientUser({ ...client.clientUser, client: client.newClient }),
    }, 201);
  } catch (err: any) {
    console.error(err);
    if (err.code === 'P2002') return json({ error: 'An account with this email already exists.' }, 409);
    return json({ error: err.message }, err.status || 400);
  }
});

/* ── Refresh token ── */
export const refresh = handler(async (req) => {
  const { refreshToken } = await body(req);
  if (!refreshToken) return json({ error: 'Refresh token required' }, 401);

  try {
    const decoded: any = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!);
    if (decoded.type !== 'client') return json({ error: 'Invalid token type' }, 401);

    const clientUser = await prisma.clientUser.findUnique({
      where: { id: decoded.clientUserId },
      include: { client: { select: { isActive: true } } },
    });
    // A deactivated company (or teammate) must not be able to mint new access tokens.
    if (!clientUser || clientUser.refreshToken !== refreshToken || !clientUser.isActive || !clientUser.client.isActive) {
      return json({ error: 'Invalid refresh token' }, 401);
    }

    const { access, refresh } = generateTokens(clientUser.id);
    await prisma.clientUser.update({ where: { id: clientUser.id }, data: { refreshToken: refresh } });
    return json({ accessToken: access, refreshToken: refresh });
  } catch {
    return json({ error: 'Invalid refresh token' }, 401);
  }
});

/* ── Logout ── */
export const logout = handler(async (req) => {
  const { clientUser } = await requireClient(req);
  await prisma.clientUser.update({ where: { id: clientUser.id }, data: { refreshToken: null } });
  return json({ message: 'Logged out' });
});

/* ── Get my account ── */
export const me = handler(async (req) => {
  const { clientUser, client } = await requireClient(req);
  return json(publicClientUser({ ...clientUser, client }));
});

/* ── Change password ── */
export const changePassword = handler(async (req) => {
  const { clientUser } = await requireClient(req);
  const { currentPassword, newPassword } = await body(req);
  if (!currentPassword || !newPassword) return json({ error: 'Both passwords required' }, 400);
  if (String(newPassword).length < 8) return json({ error: 'Password must be at least 8 characters' }, 400);

  try {
    const valid = await bcrypt.compare(String(currentPassword), clientUser.password || '');
    if (!valid) return json({ error: 'Current password is incorrect' }, 400);

    const hashed = await bcrypt.hash(String(newPassword), 12);
    await prisma.clientUser.update({ where: { id: clientUser.id }, data: { password: hashed } });
    return json({ message: 'Password changed successfully' });
  } catch {
    return json({ error: 'Server error' }, 500);
  }
});

/* ── Accept invite: view (public) ── */
export const viewInvite = handler<{ token: string }>(async (req, { params }) => {
  const clientUser = await prisma.clientUser.findUnique({
    where: { inviteToken: params.token },
    include: { client: { select: { companyName: true, isActive: true } } },
  });
  if (!clientUser || !clientUser.inviteExpiresAt || clientUser.inviteExpiresAt < new Date()) {
    return json({ error: 'This invite link is invalid or has expired.' }, 404);
  }
  if (!clientUser.isActive || !clientUser.client.isActive) {
    return json({ error: 'This account has been deactivated. Please contact your company admin.' }, 403);
  }
  return json({ name: clientUser.name, email: clientUser.email, companyName: clientUser.client.companyName });
});

/* ── Accept invite: set password (public) ── */
export const acceptInvite = handler<{ token: string }>(async (req, { params }) => {
  const { password } = await body(req);
  if (!password || typeof password !== 'string' || password.length < 8) {
    return json({ error: 'Password must be at least 8 characters' }, 400);
  }

  const clientUser = await prisma.clientUser.findUnique({
    where: { inviteToken: params.token },
    include: { client: { select: { isActive: true } } },
  });
  if (!clientUser || !clientUser.inviteExpiresAt || clientUser.inviteExpiresAt < new Date()) {
    return json({ error: 'This invite link is invalid or has expired.' }, 404);
  }
  // A teammate deactivated before accepting (or whose company was deactivated) can't activate the invite.
  if (!clientUser.isActive || !clientUser.client.isActive) {
    return json({ error: 'This account has been deactivated. Please contact your company admin.' }, 403);
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

  return json({ accessToken: access, refreshToken: refresh, clientUser: publicClientUser(updated) });
});

/* ── Team: list (any teammate) ── */
export const team = handler(async (req) => {
  const { client } = await requireApprovedClient(req);
  const members = await prisma.clientUser.findMany({
    where: { clientId: client.id },
    select: {
      id: true, name: true, email: true, role: true, isActive: true,
      lastLogin: true, acceptedAt: true, inviteExpiresAt: true, createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  });
  return json(members);
});

/* ── Team: invite a teammate (company admin only) ── */
export const inviteTeammate = handler(async (req) => {
  const { clientUser: me, client } = await requireApprovedClient(req);
  assertCompanyAdmin(me);
  const { name, email, role } = await body(req);
  if (!name || !email || typeof name !== 'string' || typeof email !== 'string') {
    return json({ error: 'Name and email are required' }, 400);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return json({ error: 'Please enter a valid email address' }, 400);

  try {
    const inviteToken = crypto.randomBytes(32).toString('hex');
    const inviteExpiresAt = new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    const clientUser = await prisma.clientUser.create({
      data: {
        clientId: client.id,
        name,
        email: email.toLowerCase().trim(),
        role: role === 'COMPANY_ADMIN' ? 'COMPANY_ADMIN' : 'COMPANY_MEMBER',
        inviteToken,
        inviteExpiresAt,
        invitedByClientUserId: me.id,
      },
    });

    await sendInviteEmail({
      clientUser,
      inviteToken,
      companyName: client.companyName,
      invitedByName: me.name,
    });

    return json({ id: clientUser.id, name: clientUser.name, email: clientUser.email, role: clientUser.role }, 201);
  } catch (err: any) {
    if (err.code === 'P2002') return json({ error: 'A user with this email already exists' }, 409);
    return json({ error: err.message }, 400);
  }
});

/* ── Team: toggle a teammate's active state (company admin only) ── */
export const toggleTeammate = handler<{ id: string }>(async (req, { params }) => {
  const { clientUser: me, client } = await requireApprovedClient(req);
  assertCompanyAdmin(me);
  const target = await prisma.clientUser.findUnique({ where: { id: params.id } });
  if (!target || target.clientId !== client.id) return json({ error: 'User not found' }, 404);
  if (target.id === me.id) return json({ error: "You can't deactivate your own account" }, 400);

  const updated = await prisma.clientUser.update({
    where: { id: target.id },
    data: { isActive: !target.isActive },
  });
  return json({ id: updated.id, isActive: updated.isActive });
});
