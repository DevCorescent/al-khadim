// Ported from api/src/utils/otp.js
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';
import type { OtpPurpose } from '@/generated/prisma/client';
import { HttpError } from '../http';
import { getTransport } from './mailer';
import { sendTemplatedMail } from './templateRenderer';

// Errors carry an HTTP status (the Express version set `err.status`); HttpError
// does the same, and `handler()` turns it into a `{ error }` response.

const OTP_EXPIRY_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_SENDS_PER_HOUR = 5;
const MAX_VERIFY_ATTEMPTS = 5;
const TICKET_EXPIRY = '15m';

// Opt-in dev escape hatch: any pending code can be verified with 123456, but only
// when OTP_DEV_BYPASS=true is set explicitly AND we're not in production. Off by default.
const BYPASS_CODE = '123456';
function bypassEnabled() {
  return process.env.OTP_DEV_BYPASS === 'true' && process.env.NODE_ENV !== 'production';
}

export function normalizeEmail(email: unknown): string {
  return String(email || '').toLowerCase().trim();
}

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function sendOtp(rawEmail: string, purpose: OtpPurpose): Promise<{ expiresIn: number; devCode?: string }> {
  const email = normalizeEmail(rawEmail);

  const recent = await prisma.otpCode.findFirst({
    where: { email, purpose },
    orderBy: { createdAt: 'desc' },
  });
  if (recent && Date.now() - recent.createdAt.getTime() < RESEND_COOLDOWN_MS) {
    const waitSec = Math.ceil((RESEND_COOLDOWN_MS - (Date.now() - recent.createdAt.getTime())) / 1000);
    throw new HttpError(429, `Please wait ${waitSec}s before requesting another code`);
  }

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const sentInLastHour = await prisma.otpCode.count({
    where: { email, purpose, createdAt: { gte: oneHourAgo } },
  });
  if (sentInLastHour >= MAX_SENDS_PER_HOUR) {
    throw new HttpError(429, 'Too many verification requests. Please try again later.');
  }

  const code = generateCode();
  const codeHash = await bcrypt.hash(code, 10);
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS);

  await prisma.otpCode.create({ data: { email, codeHash, purpose, expiresAt } });

  await sendTemplatedMail({
    templateSlug: 'otp-verification',
    to: email,
    data: { code, expiryMinutes: String(OTP_EXPIRY_MS / 60000) },
  });

  // No real SMTP configured — the code was only logged server-side, not delivered.
  // Outside production, hand it back so the UI can surface it directly instead of
  // the user being stuck with a code they can never receive. Never in production:
  // there it would let anyone verify an email address they don't own.
  if (process.env.NODE_ENV === 'production') return { expiresIn: OTP_EXPIRY_MS / 1000 };
  const { configured } = await getTransport();
  return { expiresIn: OTP_EXPIRY_MS / 1000, devCode: configured ? undefined : code };
}

export async function verifyOtp(rawEmail: string, code: string, purpose: OtpPurpose): Promise<{ ticket: string }> {
  const email = normalizeEmail(rawEmail);

  const otp = await prisma.otpCode.findFirst({
    where: { email, purpose, consumedAt: null },
    orderBy: { createdAt: 'desc' },
  });

  if (!otp) {
    throw new HttpError(400, 'No verification code found. Please request a new one.');
  }
  if (otp.expiresAt < new Date()) {
    throw new HttpError(400, 'This code has expired. Please request a new one.');
  }
  if (otp.attempts >= MAX_VERIFY_ATTEMPTS) {
    throw new HttpError(400, 'Too many incorrect attempts. Please request a new code.');
  }

  const isBypass = bypassEnabled() && String(code || '') === BYPASS_CODE;
  const valid = isBypass || await bcrypt.compare(String(code || ''), otp.codeHash);
  if (!valid) {
    await prisma.otpCode.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
    throw new HttpError(400, 'Incorrect code');
  }

  await prisma.otpCode.update({ where: { id: otp.id }, data: { consumedAt: new Date() } });

  const ticket = jwt.sign(
    { typ: 'otp_ticket', otpId: otp.id, email, purpose },
    process.env.JWT_SECRET,
    { expiresIn: TICKET_EXPIRY }
  );

  return { ticket };
}

/**
 * Verifies an email-verification ticket and returns the OtpCode row (still unconsumed-for-registration).
 * Does NOT mark it used — callers must do that inside their own transaction via markTicketUsed().
 */
export async function redeemTicket(ticket: string, rawEmail: string, purpose: OtpPurpose) {
  if (!ticket) {
    throw new HttpError(400, 'Please verify your email first');
  }
  const email = normalizeEmail(rawEmail);

  let payload: any;
  try {
    payload = jwt.verify(ticket, process.env.JWT_SECRET);
  } catch {
    throw new HttpError(400, 'Your email verification has expired. Please verify again.');
  }

  if (payload.typ !== 'otp_ticket' || payload.purpose !== purpose || normalizeEmail(payload.email) !== email) {
    throw new HttpError(400, 'Email verification does not match. Please verify again.');
  }

  const otp = await prisma.otpCode.findUnique({ where: { id: payload.otpId } });
  if (!otp || !otp.consumedAt) {
    throw new HttpError(400, 'Please verify your email first');
  }
  if (otp.ticketUsedAt) {
    throw new HttpError(400, 'This email verification has already been used');
  }

  return otp;
}
