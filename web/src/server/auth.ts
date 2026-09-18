/**
 * Auth guards for the three kinds of logged-in principal. Each one reads the
 * Bearer token, verifies it and loads the account, throwing an HttpError with
 * the same status and message the Express middleware used.
 *   - staff:     api/src/middleware/auth.js          (authenticate, authorize)
 *   - candidate: api/src/middleware/candidateAuth.js (authenticateCandidate)
 *   - client:    api/src/middleware/clientAuth.js    (authenticateClient, ...)
 */
import jwt from 'jsonwebtoken';
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { UserRole } from '@/generated/prisma/client';
import { HttpError } from './http';

export function bearerToken(req: NextRequest): string | undefined {
  return req.headers.get('authorization')?.split(' ')[1];
}

function verifyToken(req: NextRequest): any {
  const token = bearerToken(req);
  if (!token) throw new HttpError(401, 'Access token required');
  try {
    return jwt.verify(token, process.env.JWT_SECRET!);
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') throw new HttpError(401, 'Token expired');
    throw new HttpError(401, 'Invalid token');
  }
}

/** Staff user (admin panel). Pass roles to also enforce `authorize(...roles)`. */
export async function requireStaff(req: NextRequest, ...roles: UserRole[]) {
  const decoded = verifyToken(req);
  // Candidate/company tokens carry `type` and no staff `id`.
  if (decoded.type || typeof decoded.id !== 'string') throw new HttpError(401, 'Invalid token type');
  const user = await prisma.user.findUnique({ where: { id: decoded.id } });
  if (!user || !user.isActive) throw new HttpError(401, 'Invalid or inactive account');
  if (roles.length && !roles.includes(user.role)) throw new HttpError(403, 'Insufficient permissions');
  return user;
}

/** Candidate portal account. */
export async function requireCandidate(req: NextRequest) {
  const decoded = verifyToken(req);
  if (decoded.type !== 'candidate') throw new HttpError(401, 'Invalid token type');
  const account = await prisma.candidateAccount.findUnique({
    where: { candidateId: decoded.candidateId },
    include: { candidate: true },
  });
  if (!account || !account.isActive) throw new HttpError(401, 'Account not active or not found');
  const { candidate, ...candidateAccount } = account;
  return { candidate, candidateAccount };
}

/** Company portal user. */
export async function requireClient(req: NextRequest) {
  const decoded = verifyToken(req);
  if (decoded.type !== 'client') throw new HttpError(401, 'Invalid token type');
  const clientUser = await prisma.clientUser.findUnique({
    where: { id: decoded.clientUserId },
    include: { client: true },
  });
  if (!clientUser || !clientUser.isActive || !clientUser.client.isActive) {
    throw new HttpError(401, 'Account not active or not found');
  }
  return { clientUser, client: clientUser.client };
}

/** Company portal user whose company has been approved (`authenticateApprovedClient`). */
export async function requireApprovedClient(req: NextRequest) {
  const ctx = await requireClient(req);
  if (ctx.client.status !== 'APPROVED') {
    throw new HttpError(403, 'Your company account is pending approval', { status: ctx.client.status });
  }
  return ctx;
}

/** `authorizeCompanyAdmin`. */
export function assertCompanyAdmin(clientUser: { role: string }) {
  if (clientUser.role !== 'COMPANY_ADMIN') {
    throw new HttpError(403, 'Only a company admin can perform this action');
  }
}
