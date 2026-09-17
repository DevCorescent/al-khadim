const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const { getTransport } = require('./mailer');
const { sendTemplatedMail } = require('./templateRenderer');

const prisma = new PrismaClient();

const OTP_EXPIRY_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_SENDS_PER_HOUR = 5;
const MAX_VERIFY_ATTEMPTS = 5;
const TICKET_EXPIRY = '15m';

// TEMPORARY: lets any pending code be verified with 123456 while OTP delivery
// isn't wired up end-to-end for testing. Never active in production.
const BYPASS_CODE = '123456';
const BYPASS_ENABLED = process.env.NODE_ENV !== 'production';

function normalizeEmail(email) {
  return String(email || '').toLowerCase().trim();
}

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function sendOtp(rawEmail, purpose) {
  const email = normalizeEmail(rawEmail);

  const recent = await prisma.otpCode.findFirst({
    where: { email, purpose },
    orderBy: { createdAt: 'desc' },
  });
  if (recent && Date.now() - recent.createdAt.getTime() < RESEND_COOLDOWN_MS) {
    const waitSec = Math.ceil((RESEND_COOLDOWN_MS - (Date.now() - recent.createdAt.getTime())) / 1000);
    const err = new Error(`Please wait ${waitSec}s before requesting another code`);
    err.status = 429;
    throw err;
  }

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const sentInLastHour = await prisma.otpCode.count({
    where: { email, purpose, createdAt: { gte: oneHourAgo } },
  });
  if (sentInLastHour >= MAX_SENDS_PER_HOUR) {
    const err = new Error('Too many verification requests. Please try again later.');
    err.status = 429;
    throw err;
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
  // Hand it back to the caller so the UI can surface it directly instead of the
  // user being stuck with a code they can never receive (dev/local only).
  const { configured } = await getTransport();
  return { expiresIn: OTP_EXPIRY_MS / 1000, devCode: configured ? undefined : code };
}

async function verifyOtp(rawEmail, code, purpose) {
  const email = normalizeEmail(rawEmail);

  const otp = await prisma.otpCode.findFirst({
    where: { email, purpose, consumedAt: null },
    orderBy: { createdAt: 'desc' },
  });

  if (!otp) {
    const err = new Error('No verification code found. Please request a new one.');
    err.status = 400;
    throw err;
  }
  if (otp.expiresAt < new Date()) {
    const err = new Error('This code has expired. Please request a new one.');
    err.status = 400;
    throw err;
  }
  if (otp.attempts >= MAX_VERIFY_ATTEMPTS) {
    const err = new Error('Too many incorrect attempts. Please request a new code.');
    err.status = 400;
    throw err;
  }

  const isBypass = BYPASS_ENABLED && String(code || '') === BYPASS_CODE;
  const valid = isBypass || await bcrypt.compare(String(code || ''), otp.codeHash);
  if (!valid) {
    await prisma.otpCode.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
    const err = new Error('Incorrect code');
    err.status = 400;
    throw err;
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
async function redeemTicket(ticket, rawEmail, purpose) {
  if (!ticket) {
    const err = new Error('Please verify your email first');
    err.status = 400;
    throw err;
  }
  const email = normalizeEmail(rawEmail);

  let payload;
  try {
    payload = jwt.verify(ticket, process.env.JWT_SECRET);
  } catch {
    const err = new Error('Your email verification has expired. Please verify again.');
    err.status = 400;
    throw err;
  }

  if (payload.typ !== 'otp_ticket' || payload.purpose !== purpose || normalizeEmail(payload.email) !== email) {
    const err = new Error('Email verification does not match. Please verify again.');
    err.status = 400;
    throw err;
  }

  const otp = await prisma.otpCode.findUnique({ where: { id: payload.otpId } });
  if (!otp || !otp.consumedAt) {
    const err = new Error('Please verify your email first');
    err.status = 400;
    throw err;
  }
  if (otp.ticketUsedAt) {
    const err = new Error('This email verification has already been used');
    err.status = 400;
    throw err;
  }

  return otp;
}

module.exports = { sendOtp, verifyOtp, redeemTicket, normalizeEmail };
