const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const { PrismaClient } = require('@prisma/client');
const { sendOtp, verifyOtp, normalizeEmail } = require('../utils/otp');

const prisma = new PrismaClient();

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });

const PURPOSES = ['CANDIDATE_REGISTRATION', 'COMPANY_REGISTRATION'];

async function assertEmailAvailable(email, purpose) {
  if (purpose === 'CANDIDATE_REGISTRATION') {
    const existingCandidate = await prisma.candidate.findUnique({ where: { email } });
    if (existingCandidate) {
      const err = new Error('A candidate profile already exists for this email. Please log in.');
      err.status = 409;
      throw err;
    }
    const existingRegistration = await prisma.candidateRegistration.findFirst({ where: { email } });
    if (existingRegistration) {
      const err = new Error('An application with this email already exists.');
      err.status = 409;
      throw err;
    }
  } else if (purpose === 'COMPANY_REGISTRATION') {
    const existingClientUser = await prisma.clientUser.findUnique({ where: { email } });
    if (existingClientUser) {
      const err = new Error('An account with this email already exists. Please log in.');
      err.status = 409;
      throw err;
    }
    const existingClient = await prisma.client.findFirst({ where: { email } });
    if (existingClient) {
      const err = new Error('A company record with this email already exists. Please contact Al Khadim.');
      err.status = 409;
      throw err;
    }
  }
}

/* ── Send a verification code (public) ── */
router.post('/send', limiter, async (req, res) => {
  try {
    const { email, purpose } = req.body;
    if (!email || !purpose || !PURPOSES.includes(purpose)) {
      return res.status(400).json({ error: 'Valid email and purpose are required' });
    }
    const normalized = normalizeEmail(email);
    await assertEmailAvailable(normalized, purpose);
    const result = await sendOtp(normalized, purpose);
    res.json({ message: 'Verification code sent', ...result });
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message });
  }
});

/* ── Verify a code, get a short-lived ticket (public) ── */
router.post('/verify', limiter, async (req, res) => {
  try {
    const { email, code, purpose } = req.body;
    if (!email || !code || !purpose || !PURPOSES.includes(purpose)) {
      return res.status(400).json({ error: 'Valid email, code and purpose are required' });
    }
    const result = await verifyOtp(email, code, purpose);
    res.json(result);
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message });
  }
});

module.exports = router;
