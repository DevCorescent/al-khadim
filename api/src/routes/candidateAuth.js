const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const upload = require('../middleware/upload');
const { authenticateCandidate } = require('../middleware/candidateAuth');
const { parseCV } = require('../utils/cvParser');
const { isValidYouTubeUrl } = require('../utils/youtube');
const { sendTemplatedMail } = require('../utils/templateRenderer');
const { redeemTicket } = require('../utils/otp');
const rateLimit = require('express-rate-limit');

const prisma = new PrismaClient();

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });

function generateTokens(candidateId) {
  const access = jwt.sign(
    { candidateId, type: 'candidate' },
    process.env.JWT_SECRET,
    { expiresIn: '15m' }
  );
  const refresh = jwt.sign(
    { candidateId, type: 'candidate' },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: '30d' }
  );
  return { access, refresh };
}

/* ── Parse CV (public – no auth needed) ── */
router.post('/parse-cv', upload.single('cv'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No CV file uploaded' });
  try {
    const parsed = await parseCV(req.file.path);
    res.json({ parsed, cvPath: req.file.path });
  } catch (err) {
    console.error('CV parse error:', err);
    res.status(500).json({ error: 'Failed to parse CV', detail: err.message });
  }
});

/* ── Register (public) ── */
router.post('/register', upload.fields([{ name: 'cv', maxCount: 1 }, { name: 'photo', maxCount: 1 }]), async (req, res) => {
  try {
    const { password, skills, languages, experience, parsedData, emailVerificationTicket, ...rest } = req.body;

    const otp = await redeemTicket(emailVerificationTicket, rest.email, 'CANDIDATE_REGISTRATION');

    // Check if email already registered
    const existing = await prisma.candidateRegistration.findFirst({ where: { email: rest.email } });
    if (existing) return res.status(409).json({ error: 'An application with this email already exists.' });

    const existingCandidate = await prisma.candidate.findUnique({ where: { email: rest.email } });
    if (existingCandidate) return res.status(409).json({ error: 'A candidate profile already exists for this email. Please log in.' });

    const hashedPassword = password ? await bcrypt.hash(password, 12) : null;

    // Safely parse parsedData if sent as string
    let parsedDataJson = null;
    if (parsedData) {
      try { parsedDataJson = typeof parsedData === 'string' ? JSON.parse(parsedData) : parsedData; } catch {}
    }

    const data = {
      ...rest,
      password: hashedPassword,
      experience: experience ? String(experience) : null,
      skills: Array.isArray(skills) ? skills.join(', ') : (skills || null),
      languages: Array.isArray(languages) ? languages.join(', ') : (languages || null),
      parsedData: parsedDataJson,
    };
    if (req.files?.cv)    data.cvPath = req.files.cv[0].path;
    if (req.files?.photo) data.photo  = req.files.photo[0].path;

    const [reg] = await prisma.$transaction([
      prisma.candidateRegistration.create({ data }),
      prisma.otpCode.update({ where: { id: otp.id }, data: { ticketUsedAt: new Date() } }),
    ]);
    res.status(201).json({ message: 'Application submitted! You will be notified once approved.', id: reg.id });
  } catch (err) {
    console.error(err);
    if (err.code === 'P2002') return res.status(409).json({ error: 'An application with this email already exists.' });
    res.status(err.status || 400).json({ error: err.message });
  }
});

/* ── Login (public) ── */
router.post('/login', limiter, async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  try {
    const account = await prisma.candidateAccount.findFirst({
      where: { candidate: { email: email.toLowerCase().trim() } },
      include: { candidate: true },
    });

    if (!account || !account.isActive) {
      return res.status(401).json({ error: 'Invalid credentials or account not yet approved.' });
    }

    const valid = await bcrypt.compare(password, account.password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const { access, refresh } = generateTokens(account.candidateId);
    await prisma.candidateAccount.update({
      where: { id: account.id },
      data: { refreshToken: refresh, lastLogin: new Date() },
    });

    res.json({
      accessToken: access,
      refreshToken: refresh,
      candidate: {
        id: account.candidate.id,
        firstName: account.candidate.firstName,
        lastName: account.candidate.lastName,
        email: account.candidate.email,
        photo: account.candidate.photo,
        headline: account.candidate.headline,
        isPublic: account.candidate.isPublic,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

/* ── Refresh token ── */
router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(401).json({ error: 'Refresh token required' });

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    if (decoded.type !== 'candidate') return res.status(401).json({ error: 'Invalid token type' });

    const account = await prisma.candidateAccount.findUnique({
      where: { candidateId: decoded.candidateId },
    });
    if (!account || account.refreshToken !== refreshToken || !account.isActive) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    const { access, refresh } = generateTokens(decoded.candidateId);
    await prisma.candidateAccount.update({
      where: { id: account.id },
      data: { refreshToken: refresh },
    });
    res.json({ accessToken: access, refreshToken: refresh });
  } catch {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

/* ── Get my profile ── */
router.get('/me', authenticateCandidate, async (req, res) => {
  const candidate = await prisma.candidate.findUnique({
    where: { id: req.candidate.id },
    include: {
      applications: {
        include: { job: { include: { client: { select: { companyName: true } } } } },
        orderBy: { appliedAt: 'desc' },
      },
      interviews: {
        include: { job: true },
        orderBy: { scheduledAt: 'desc' },
      },
      documents: true,
    },
  });
  res.json(candidate);
});

/* ── Update my profile ── */
router.put('/me', authenticateCandidate, upload.fields([
  { name: 'cv', maxCount: 1 },
  { name: 'photo', maxCount: 1 },
]), async (req, res) => {
  try {
    const { skills, languages, currentSalary, expectedSalary, experience, introVideoUrl, ...rest } = req.body;
    const data = { ...rest };

    if (req.files?.cv)    data.cvPath = req.files.cv[0].path;
    if (req.files?.photo) data.photo  = req.files.photo[0].path;
    if (skills)      data.skills    = Array.isArray(skills)    ? skills    : skills.split(',').map(s => s.trim()).filter(Boolean);
    if (languages)   data.languages = Array.isArray(languages) ? languages : languages.split(',').map(s => s.trim()).filter(Boolean);
    if (currentSalary)  data.currentSalary  = parseFloat(currentSalary);
    if (expectedSalary) data.expectedSalary = parseFloat(expectedSalary);
    if (experience)     data.experience     = parseInt(experience);
    if (introVideoUrl !== undefined) {
      if (introVideoUrl && !isValidYouTubeUrl(introVideoUrl)) {
        return res.status(400).json({ error: 'Please enter a valid YouTube video URL' });
      }
      data.introVideoUrl = introVideoUrl || null;
    }

    // Capture changes for edit history
    const before = req.candidate;
    const changes = {};
    const TRACKED = ['firstName','lastName','email','phone','headline','summary','nationality','currentLocation','experience','skills','languages','education','linkedIn','portfolio','isPublic','introVideoUrl'];
    for (const field of TRACKED) {
      const oldVal = before[field];
      const newVal = data[field];
      if (newVal !== undefined) {
        const oldStr = JSON.stringify(oldVal);
        const newStr = JSON.stringify(newVal);
        if (oldStr !== newStr) changes[field] = { old: oldVal, new: newVal };
      }
    }
    if (req.files?.cv)    changes.cvPath = { old: before.cvPath, new: data.cvPath };
    if (req.files?.photo) changes.photo  = { old: before.photo,  new: data.photo };

    const [updated] = await prisma.$transaction([
      prisma.candidate.update({ where: { id: req.candidate.id }, data }),
      ...(Object.keys(changes).length > 0 ? [
        prisma.candidateEditHistory.create({
          data: {
            candidateId: req.candidate.id,
            editedBy: 'candidate',
            editorName: `${before.firstName} ${before.lastName}`,
            changes,
          },
        }),
      ] : []),
    ]);

    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/* ── Get edit history ── */
router.get('/me/edit-history', authenticateCandidate, async (req, res) => {
  const history = await prisma.candidateEditHistory.findMany({
    where: { candidateId: req.candidate.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  res.json(history);
});

/* ── Shared With: which companies my profile has been shared with ── */
router.get('/me/shares', authenticateCandidate, async (req, res) => {
  const shares = await prisma.profileShare.findMany({
    where: { candidateId: req.candidate.id, status: { not: 'WITHDRAWN' } },
    select: {
      id: true,
      sentAt: true,
      status: true,
      client: { select: { companyName: true } },
      job: { select: { title: true } },
    },
    orderBy: { sentAt: 'desc' },
  });
  res.json(shares);
});

/* ── My industry tracking (read-only, only what admin made visible to me) ── */
router.get('/me/tracking', authenticateCandidate, async (req, res) => {
  const records = await prisma.candidateTracking.findMany({
    where: { candidateId: req.candidate.id, visibility: 'PUBLIC', visibleToCandidate: true },
    select: { id: true, industry: { select: { key: true, name: true, color: true } }, data: true, updatedAt: true },
    orderBy: { createdAt: 'asc' },
  });
  res.json(records);
});

/* ── My requested documents ── */
router.get('/me/document-requests', authenticateCandidate, async (req, res) => {
  const requests = await prisma.documentRequest.findMany({
    where: { candidateId: req.candidate.id },
    select: {
      id: true, title: true, description: true, status: true,
      fileSize: true, mimeType: true, requestedAt: true, uploadedAt: true,
      verifiedAt: true, rejectionReason: true,
    },
    orderBy: { requestedAt: 'desc' },
  });
  res.json(requests);
});

/* ── Upload a document against a request ── */
router.post('/me/document-requests/:id/upload', authenticateCandidate, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'File is required' });
    const request = await prisma.documentRequest.findUnique({
      where: { id: req.params.id },
      include: { requestedByUser: { select: { email: true, name: true } } },
    });
    if (!request || request.candidateId !== req.candidate.id) return res.status(404).json({ error: 'Request not found' });
    if (!['REQUESTED', 'REJECTED'].includes(request.status)) {
      return res.status(400).json({ error: 'This document has already been uploaded' });
    }

    const updated = await prisma.documentRequest.update({
      where: { id: request.id },
      data: {
        filePath: req.file.path, fileSize: req.file.size, mimeType: req.file.mimetype,
        status: 'UPLOADED', uploadedAt: new Date(), rejectionReason: null,
      },
    });

    if (request.requestedByUser?.email) {
      sendTemplatedMail({
        templateSlug: 'document-uploaded-notify',
        to: request.requestedByUser.email,
        data: {
          candidateFullName: `${req.candidate.firstName} ${req.candidate.lastName}`,
          documentTitle: request.title,
        },
      }).catch((e) => console.error('document upload notify failed', e));
    }

    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/* ── Download my own uploaded document ── */
router.get('/me/document-requests/:id/download', authenticateCandidate, async (req, res) => {
  const request = await prisma.documentRequest.findUnique({ where: { id: req.params.id } });
  if (!request || request.candidateId !== req.candidate.id || !request.filePath) {
    return res.status(404).json({ error: 'File not found' });
  }
  res.download(request.filePath, request.title);
});

/* ── Change password ── */
router.put('/change-password', authenticateCandidate, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Both passwords required' });
  if (newPassword.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

  try {
    const valid = await bcrypt.compare(currentPassword, req.candidateAccount.password);
    if (!valid) return res.status(400).json({ error: 'Current password is incorrect' });

    const hashed = await bcrypt.hash(newPassword, 12);
    await prisma.candidateAccount.update({
      where: { id: req.candidateAccount.id },
      data: { password: hashed },
    });
    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

/* ── Logout ── */
router.post('/logout', authenticateCandidate, async (req, res) => {
  await prisma.candidateAccount.update({
    where: { id: req.candidateAccount.id },
    data: { refreshToken: null },
  });
  res.json({ message: 'Logged out' });
});

/* ── Public profiles (approved + isPublic) ── */
router.get('/public-profiles', async (req, res) => {
  const { search, category, limit = 20, page = 1 } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  const where = { isPublic: true };
  if (search) {
    where.OR = [
      { firstName: { contains: search, mode: 'insensitive' } },
      { lastName:  { contains: search, mode: 'insensitive' } },
      { headline:  { contains: search, mode: 'insensitive' } },
      { skills: { has: search } },
    ];
  }

  const [profiles, total] = await Promise.all([
    prisma.candidate.findMany({
      where,
      skip,
      take: Number(limit),
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true, firstName: true, lastName: true,
        headline: true, summary: true, photo: true,
        currentLocation: true, experience: true, skills: true,
        languages: true, nationality: true, linkedIn: true,
        portfolio: true, status: true,
        _count: { select: { applications: true } },
      },
    }),
    prisma.candidate.count({ where }),
  ]);

  res.json({ data: profiles, total, page: Number(page) });
});

module.exports = router;
