const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { parseCV } = require('../utils/cvParser');
const { generateCvId } = require('../utils/cvId');
const { sendTemplatedMail } = require('../utils/templateRenderer');

const prisma = new PrismaClient();

/* Public endpoint – parse CV and register */
router.post('/public', upload.single('cv'), async (req, res) => {
  try {
    const data = { ...req.body };
    if (req.file) data.cvPath = req.file.path;
    const reg = await prisma.candidateRegistration.create({ data });
    res.status(201).json({ message: 'Registration submitted successfully', id: reg.id });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/* List all registrations (admin) */
router.get('/', authenticate, async (req, res) => {
  const { status } = req.query;
  const where = {};
  if (status) where.status = status;
  const registrations = await prisma.candidateRegistration.findMany({
    where, orderBy: { createdAt: 'desc' },
  });
  res.json(registrations);
});

/* Update a registration (admin) */
router.put('/:id', authenticate, async (req, res) => {
  try {
    const reg = await prisma.candidateRegistration.update({ where: { id: req.params.id }, data: req.body });
    res.json(reg);
  } catch {
    res.status(404).json({ error: 'Registration not found' });
  }
});

/* Approve – creates Candidate + CandidateAccount, marks registration APPROVED */
router.post('/:id/approve', authenticate, async (req, res) => {
  try {
    const reg = await prisma.candidateRegistration.findUnique({ where: { id: req.params.id } });
    if (!reg) return res.status(404).json({ error: 'Registration not found' });
    if (reg.status === 'APPROVED') return res.status(409).json({ error: 'Already approved' });

    // Check if candidate with email already exists
    let candidate = await prisma.candidate.findUnique({ where: { email: reg.email } });

    if (!candidate) {
      const skillsArr = reg.skills ? reg.skills.split(',').map(s => s.trim()).filter(Boolean) : [];
      const langsArr  = reg.languages ? reg.languages.split(',').map(s => s.trim()).filter(Boolean) : [];

      candidate = await prisma.candidate.create({
        data: {
          cvId:            await generateCvId(prisma),
          firstName:       reg.firstName,
          lastName:        reg.lastName,
          email:           reg.email,
          phone:           reg.phone,
          nationality:     reg.nationality,
          currentLocation: reg.currentLocation,
          skills:          skillsArr,
          languages:       langsArr,
          education:       reg.education,
          headline:        reg.headline,
          summary:         reg.summary,
          linkedIn:        reg.linkedIn,
          experience:      reg.experience ? parseInt(reg.experience) : null,
          cvPath:          reg.cvPath,
          photo:           reg.photo,
          source:          'WEBSITE',
          isPublic:        req.body.isPublic ?? true,
          status:          'NEW',
        },
      });
    }

    // Create account if not already exists
    const existingAccount = await prisma.candidateAccount.findUnique({ where: { candidateId: candidate.id } });
    if (!existingAccount) {
      if (!reg.password) {
        // Generate a default password = "AlKhadim@123" if no password was set during registration
        const defaultPwd = await bcrypt.hash('AlKhadim@123', 12);
        await prisma.candidateAccount.create({
          data: { candidateId: candidate.id, password: defaultPwd, isActive: true },
        });
      } else {
        await prisma.candidateAccount.create({
          data: { candidateId: candidate.id, password: reg.password, isActive: true },
        });
      }
    } else {
      await prisma.candidateAccount.update({ where: { candidateId: candidate.id }, data: { isActive: true } });
    }

    await prisma.candidateRegistration.update({
      where: { id: reg.id },
      data: { status: 'APPROVED', convertedTo: candidate.id },
    });

    // Welcome email from the Careers identity (fire-and-forget — never blocks approval)
    sendTemplatedMail({
      templateSlug: 'candidate-welcome',
      to: candidate.email,
      data: { firstName: candidate.firstName, cvId: candidate.cvId },
    }).catch(e => console.error('[registrations] welcome email failed:', e.message));

    res.json({ message: 'Candidate approved and portal account created.', candidateId: candidate.id });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message });
  }
});

/* Reject */
router.post('/:id/reject', authenticate, async (req, res) => {
  try {
    await prisma.candidateRegistration.update({
      where: { id: req.params.id },
      data: { status: 'REJECTED', notes: req.body.reason || null },
    });
    res.json({ message: 'Registration rejected' });
  } catch {
    res.status(404).json({ error: 'Registration not found' });
  }
});

/* Legacy convert route */
router.post('/:id/convert', authenticate, async (req, res) => {
  return res.redirect(307, `/${req.params.id}/approve`);
});

module.exports = router;
