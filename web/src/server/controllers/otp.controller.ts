// Ported from api/src/routes/otp.js
import { prisma } from '@/lib/prisma';
import { body, handler, json } from '../http';
import { rateLimit } from '../rateLimit';
import { normalizeEmail, sendOtp, verifyOtp } from '../utils/otp';

// One limiter shared by /send and /verify, as in Express (same instance → same per-IP budget).
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });

const PURPOSES = ['CANDIDATE_REGISTRATION', 'COMPANY_REGISTRATION'];

function conflict(message: string) {
  return Object.assign(new Error(message), { status: 409 });
}

async function assertEmailAvailable(email: string, purpose: string) {
  if (purpose === 'CANDIDATE_REGISTRATION') {
    const existingCandidate = await prisma.candidate.findUnique({ where: { email } });
    if (existingCandidate) throw conflict('A candidate profile already exists for this email. Please log in.');
    const existingRegistration = await prisma.candidateRegistration.findFirst({ where: { email } });
    if (existingRegistration) throw conflict('An application with this email already exists.');
  } else if (purpose === 'COMPANY_REGISTRATION') {
    const existingClientUser = await prisma.clientUser.findUnique({ where: { email } });
    if (existingClientUser) throw conflict('An account with this email already exists. Please log in.');
    const existingClient = await prisma.client.findFirst({ where: { email } });
    if (existingClient) throw conflict('A company record with this email already exists. Please contact Al Khadim.');
  }
}

/* ── Send a verification code (public) ── */
export const send = handler(async (req) => {
  limiter(req);
  try {
    const { email, purpose } = await body(req);
    if (!email || !purpose || !PURPOSES.includes(purpose)) {
      return json({ error: 'Valid email and purpose are required' }, 400);
    }
    const normalized = normalizeEmail(email);
    await assertEmailAvailable(normalized, purpose);
    const result = await sendOtp(normalized, purpose);
    return json({ message: 'Verification code sent', ...result });
  } catch (err: any) {
    return json({ error: err.message }, err.status || 400);
  }
});

/* ── Verify a code, get a short-lived ticket (public) ── */
export const verify = handler(async (req) => {
  limiter(req);
  try {
    const { email, code, purpose } = await body(req);
    if (!email || !code || !purpose || !PURPOSES.includes(purpose)) {
      return json({ error: 'Valid email, code and purpose are required' }, 400);
    }
    const result = await verifyOtp(email, code, purpose);
    return json(result);
  } catch (err: any) {
    return json({ error: err.message }, err.status || 400);
  }
});
