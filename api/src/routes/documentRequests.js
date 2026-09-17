const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const { authenticate, authorize } = require('../middleware/auth');
const { sendTemplatedMail } = require('../utils/templateRenderer');

const prisma = new PrismaClient();
const WEB_URL = process.env.WEB_URL || 'http://localhost:3000';

/* ── List requests for a candidate (staff) ── */
router.get('/', authenticate, async (req, res) => {
  const { candidateId, trackingId } = req.query;
  if (!candidateId) return res.status(400).json({ error: 'candidateId is required' });

  const where = { candidateId };
  if (trackingId) where.trackingId = trackingId;

  const requests = await prisma.documentRequest.findMany({
    where,
    include: {
      requestedByUser: { select: { id: true, name: true } },
      verifiedByUser: { select: { id: true, name: true } },
    },
    orderBy: { requestedAt: 'desc' },
  });
  res.json(requests);
});

/* ── Request a document from a candidate ── */
router.post('/', authenticate, async (req, res) => {
  try {
    const { candidateId, trackingId, title, description } = req.body;
    if (!candidateId || !title) return res.status(400).json({ error: 'candidateId and title are required' });

    const candidate = await prisma.candidate.findUnique({ where: { id: candidateId } });
    if (!candidate) return res.status(404).json({ error: 'Candidate not found' });

    const request = await prisma.documentRequest.create({
      data: {
        candidateId, trackingId: trackingId || null, title, description: description || null,
        requestedByUserId: req.user.id,
      },
    });

    try {
      await sendTemplatedMail({
        templateSlug: 'document-requested',
        to: candidate.email,
        data: {
          firstName: candidate.firstName,
          documentTitle: title,
          descriptionBlock: description ? `<p>${description}</p>` : '',
          dashboardUrl: `${WEB_URL}/candidate/dashboard`,
        },
      });
    } catch (mailErr) {
      console.error('documentRequests: email send failed', mailErr);
    }

    res.status(201).json(request);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/* ── Get one request (staff) ── */
router.get('/:id', authenticate, async (req, res) => {
  const request = await prisma.documentRequest.findUnique({
    where: { id: req.params.id },
    include: {
      candidate: { select: { id: true, firstName: true, lastName: true } },
      requestedByUser: { select: { id: true, name: true } },
      verifiedByUser: { select: { id: true, name: true } },
    },
  });
  if (!request) return res.status(404).json({ error: 'Request not found' });
  res.json(request);
});

/* ── Staff downloads the uploaded file ── */
router.get('/:id/download', authenticate, async (req, res) => {
  const request = await prisma.documentRequest.findUnique({ where: { id: req.params.id } });
  if (!request || !request.filePath) return res.status(404).json({ error: 'No file uploaded yet' });
  res.download(request.filePath, request.title);
});

/* ── Verify or reject an uploaded document ── */
router.post('/:id/verify', authenticate, async (req, res) => {
  try {
    const { approved, rejectionReason } = req.body;
    const request = await prisma.documentRequest.findUnique({ where: { id: req.params.id } });
    if (!request) return res.status(404).json({ error: 'Request not found' });
    if (request.status !== 'UPLOADED') return res.status(400).json({ error: 'Only uploaded documents can be verified' });

    const updated = await prisma.documentRequest.update({
      where: { id: request.id },
      data: {
        status: approved ? 'VERIFIED' : 'REJECTED',
        verifiedByUserId: req.user.id,
        verifiedAt: new Date(),
        rejectionReason: approved ? null : (rejectionReason || 'Document rejected'),
      },
    });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/* ── Toggle whether a verified document is visible to the company ── */
router.patch('/:id/visibility', authenticate, async (req, res) => {
  try {
    const { visibleToCompany } = req.body;
    const updated = await prisma.documentRequest.update({
      where: { id: req.params.id },
      data: { visibleToCompany: !!visibleToCompany },
    });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/* ── Remove a request ── */
router.delete('/:id', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  try {
    await prisma.documentRequest.delete({ where: { id: req.params.id } });
    res.json({ message: 'Request removed' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
