const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { parseCV } = require('../utils/cvParser');
const { generateCvId } = require('../utils/cvId');
const { isValidYouTubeUrl } = require('../utils/youtube');

const prisma = new PrismaClient();

const CATEGORY_INDUSTRY_INCLUDE = {
  category: { select: { id: true, name: true, color: true } },
  industry: { select: { id: true, key: true, name: true, color: true } },
};

/** Empty-string values from HTML selects can't be assigned to a Prisma relation FK
 * (must be null to unset) — normalize before any create/update spread. */
function sanitizeFkFields(data) {
  if (data.categoryId === '') data.categoryId = null;
  if (data.industryId === '') data.industryId = null;
  return data;
}

/* ═══════════════════════════════════════════════════════
   PUBLIC ROUTES (no auth)  — must come before /:id
   ═══════════════════════════════════════════════════════ */

/* Public talent pool listing */
router.get('/public-profiles', async (req, res) => {
  const { search, limit = 20, page = 1 } = req.query;
  const skip = (Number(page) - 1) * Number(limit);
  const where = { isPublic: true };
  if (search) {
    where.OR = [
      { firstName: { contains: search, mode: 'insensitive' } },
      { lastName:  { contains: search, mode: 'insensitive' } },
      { headline:  { contains: search, mode: 'insensitive' } },
    ];
  }
  const [data, total] = await Promise.all([
    prisma.candidate.findMany({
      where, skip, take: Number(limit),
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true, firstName: true, lastName: true, headline: true,
        summary: true, photo: true, currentLocation: true, experience: true,
        skills: true, languages: true, nationality: true, status: true,
      },
    }),
    prisma.candidate.count({ where }),
  ]);
  res.json({ data, total });
});

/* Single public profile (used by /candidates/[id] page) */
router.get('/profile/:id', async (req, res) => {
  const candidate = await prisma.candidate.findUnique({
    where: { id: req.params.id, isPublic: true },
    select: {
      id: true, firstName: true, lastName: true, headline: true,
      summary: true, photo: true, currentLocation: true, experience: true,
      skills: true, languages: true, nationality: true, education: true,
      linkedIn: true, portfolio: true, status: true,
    },
  });
  if (!candidate) return res.status(404).json({ error: 'Profile not found' });
  res.json(candidate);
});

/* Submit a profile request (public – no auth) */
router.post('/profile/:id/request', async (req, res) => {
  try {
    const candidate = await prisma.candidate.findUnique({
      where: { id: req.params.id, isPublic: true },
      select: { id: true, firstName: true, lastName: true },
    });
    if (!candidate) return res.status(404).json({ error: 'Candidate not found' });

    const { requesterName, companyName, email, phone, position, message } = req.body;
    if (!requesterName || !companyName || !email || !phone) {
      return res.status(400).json({ error: 'Name, company, email and phone are required' });
    }

    const request = await prisma.profileRequest.create({
      data: {
        candidateId: req.params.id,
        requesterName, companyName, email, phone,
        position: position || null,
        message: message || null,
      },
    });
    res.status(201).json({ message: 'Request submitted successfully', id: request.id });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/* ═══════════════════════════════════════════════════════
   ADMIN ROUTES (require auth) — named, before /:id
   ═══════════════════════════════════════════════════════ */

/* List all profile requests */
router.get('/profile-requests', authenticate, async (req, res) => {
  const { status } = req.query;
  const where = status ? { status } : {};
  const requests = await prisma.profileRequest.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      candidate: {
        select: { id: true, firstName: true, lastName: true, headline: true, photo: true },
      },
    },
  });
  res.json(requests);
});

/* Update a profile request status / admin notes */
router.put('/profile-requests/:id', authenticate, async (req, res) => {
  try {
    const updated = await prisma.profileRequest.update({
      where: { id: req.params.id },
      data: { status: req.body.status, adminNotes: req.body.adminNotes },
    });
    res.json(updated);
  } catch {
    res.status(404).json({ error: 'Request not found' });
  }
});

/* Admin: parse a CV and return structured data (no candidate created yet) */
router.post('/parse-cv', authenticate, upload.single('cv'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No CV file uploaded' });
  try {
    const parsed = await parseCV(req.file.path);
    res.json({ parsed, cvPath: req.file.path });
  } catch (err) {
    res.status(500).json({ error: 'Failed to parse CV', detail: err.message });
  }
});

/* Admin: create candidate directly from parsed CV data */
router.post('/admin-import', authenticate, upload.fields([
  { name: 'photo', maxCount: 1 },
]), async (req, res) => {
  try {
    const { skills, languages, experience, isPublic, ...rest } = req.body;
    const data = sanitizeFkFields({ ...rest });

    if (req.files?.photo) data.photo = req.files.photo[0].path;
    data.skills    = skills    ? (Array.isArray(skills)    ? skills    : skills.split(',').map(s => s.trim()).filter(Boolean))    : [];
    data.languages = languages ? (Array.isArray(languages) ? languages : languages.split(',').map(s => s.trim()).filter(Boolean)) : [];
    if (experience) data.experience = parseInt(experience);
    data.isPublic = isPublic === 'true' || isPublic === true;
    data.source = data.source || 'ADMIN_IMPORT';
    data.cvId = await generateCvId(prisma);

    const candidate = await prisma.candidate.create({ data });
    res.status(201).json(candidate);
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'A candidate with this email already exists.' });
    res.status(400).json({ error: err.message });
  }
});

/* Admin: toggle isPublic for a candidate */
router.patch('/:id/visibility', authenticate, async (req, res) => {
  try {
    const candidate = await prisma.candidate.update({
      where: { id: req.params.id },
      data: { isPublic: req.body.isPublic },
    });
    res.json(candidate);
  } catch {
    res.status(404).json({ error: 'Candidate not found' });
  }
});

/* Admin list all candidates */
router.get('/', authenticate, async (req, res) => {
  const {
    search, status, page = 1, limit = 20,
    skills, nationality, source, currentLocation,
    minExperience, maxExperience, categoryId, industryId,
  } = req.query;
  const skip = (page - 1) * limit;
  const where = {};
  if (search) {
    where.OR = [
      { cvId:      { contains: search, mode: 'insensitive' } },
      { firstName: { contains: search, mode: 'insensitive' } },
      { lastName:  { contains: search, mode: 'insensitive' } },
      { email:     { contains: search, mode: 'insensitive' } },
      { phone:     { contains: search } },
    ];
  }
  if (status) where.status = status;
  if (nationality) where.nationality = { contains: nationality, mode: 'insensitive' };
  if (currentLocation) where.currentLocation = { contains: currentLocation, mode: 'insensitive' };
  if (source) where.source = source;
  if (categoryId) where.categoryId = categoryId;
  if (industryId) where.industryId = industryId;
  if (skills) {
    const skillList = String(skills).split(',').map((s) => s.trim()).filter(Boolean);
    if (skillList.length) where.skills = { hasSome: skillList };
  }
  if (minExperience || maxExperience) {
    where.experience = {};
    if (minExperience) where.experience.gte = Number(minExperience);
    if (maxExperience) where.experience.lte = Number(maxExperience);
  }

  const [candidates, total] = await Promise.all([
    prisma.candidate.findMany({
      where, skip: Number(skip), take: Number(limit),
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { applications: true, interviews: true } }, ...CATEGORY_INDUSTRY_INCLUDE },
    }),
    prisma.candidate.count({ where }),
  ]);
  res.json({ data: candidates, total, page: Number(page), limit: Number(limit) });
});

/* Admin get single candidate (with edit history) */
router.get('/:id', authenticate, async (req, res) => {
  const candidate = await prisma.candidate.findUnique({
    where: { id: req.params.id },
    include: {
      applications: { include: { job: { include: { client: true } } } },
      interviews:   { include: { job: true } },
      documents: true,
      followUps: true,
      editHistory: { orderBy: { createdAt: 'desc' }, take: 100 },
      ...CATEGORY_INDUSTRY_INCLUDE,
    },
  });
  if (!candidate) return res.status(404).json({ error: 'Candidate not found' });
  res.json(candidate);
});

/* Admin create candidate */
router.post('/', authenticate, upload.fields([
  { name: 'cv', maxCount: 1 },
  { name: 'photo', maxCount: 1 },
]), async (req, res) => {
  try {
    const data = sanitizeFkFields({ ...req.body });
    if (req.files?.cv)    data.cvPath = req.files.cv[0].path;
    if (req.files?.photo) data.photo  = req.files.photo[0].path;
    data.skills    = Array.isArray(data.skills)    ? data.skills    : (data.skills    ? data.skills.split(',').map(s => s.trim()).filter(Boolean) : []);
    data.languages = Array.isArray(data.languages) ? data.languages : (data.languages ? data.languages.split(',').map(s => s.trim()).filter(Boolean) : []);
    data.currentSalary  = data.currentSalary  ? parseFloat(data.currentSalary)  : null;
    data.expectedSalary = data.expectedSalary ? parseFloat(data.expectedSalary) : null;
    data.experience = data.experience ? parseInt(data.experience) : null;
    data.cvId = await generateCvId(prisma);

    const candidate = await prisma.candidate.create({ data });
    res.status(201).json(candidate);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/* Admin update candidate (with edit history) */
router.put('/:id', authenticate, upload.fields([
  { name: 'cv', maxCount: 1 },
  { name: 'photo', maxCount: 1 },
]), async (req, res) => {
  try {
    const before = await prisma.candidate.findUnique({ where: { id: req.params.id } });
    if (!before) return res.status(404).json({ error: 'Candidate not found' });

    const data = sanitizeFkFields({ ...req.body });
    if (req.files?.cv)    data.cvPath = req.files.cv[0].path;
    if (req.files?.photo) data.photo  = req.files.photo[0].path;
    if (typeof data.skills    === 'string') data.skills    = data.skills.split(',').map(s => s.trim()).filter(Boolean);
    if (typeof data.languages === 'string') data.languages = data.languages.split(',').map(s => s.trim()).filter(Boolean);
    if (data.currentSalary !== undefined)  data.currentSalary  = data.currentSalary  === '' ? null : parseFloat(data.currentSalary);
    if (data.expectedSalary !== undefined) data.expectedSalary = data.expectedSalary === '' ? null : parseFloat(data.expectedSalary);
    if (data.experience !== undefined)     data.experience     = data.experience     === '' ? null : parseInt(data.experience);
    if (data.introVideoUrl) {
      if (!isValidYouTubeUrl(data.introVideoUrl)) return res.status(400).json({ error: 'Please enter a valid YouTube video URL' });
    } else if (data.introVideoUrl === '') {
      data.introVideoUrl = null;
    }

    const TRACKED = ['firstName','lastName','email','phone','headline','summary','nationality','currentLocation','experience','skills','languages','education','linkedIn','portfolio','isPublic','status','notes','cvPath','photo','introVideoUrl','categoryId','industryId'];
    const changes = {};
    for (const field of TRACKED) {
      if (data[field] !== undefined && JSON.stringify(before[field]) !== JSON.stringify(data[field])) {
        changes[field] = { old: before[field], new: data[field] };
      }
    }

    const adminName = req.user?.name || 'Admin';
    const [candidate] = await prisma.$transaction([
      prisma.candidate.update({ where: { id: req.params.id }, data }),
      ...(Object.keys(changes).length > 0 ? [
        prisma.candidateEditHistory.create({
          data: { candidateId: req.params.id, editedBy: 'admin', editorName: adminName, editorId: req.user?.id, changes },
        }),
      ] : []),
    ]);
    res.json(candidate);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/* Admin delete candidate */
router.delete('/:id', authenticate, async (req, res) => {
  try {
    await prisma.candidate.delete({ where: { id: req.params.id } });
    res.json({ message: 'Candidate deleted' });
  } catch {
    res.status(404).json({ error: 'Candidate not found' });
  }
});

/* Assign candidate to job */
router.post('/:id/apply', authenticate, async (req, res) => {
  const { jobId } = req.body;
  try {
    const application = await prisma.candidateJob.create({
      data: { candidateId: req.params.id, jobId },
      include: { job: { include: { client: true } } },
    });
    res.status(201).json(application);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
