const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');
const upload = require('../middleware/upload');
const path = require('path');
const fs = require('fs');

const prisma = new PrismaClient();

router.get('/', authenticate, async (req, res) => {
  const { employeeId, candidateId, type } = req.query;
  const where = {};
  if (employeeId) where.employeeId = employeeId;
  if (candidateId) where.candidateId = candidateId;
  if (type) where.type = type;
  const docs = await prisma.document.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      employee: { select: { id: true, firstName: true, lastName: true } },
      candidate: { select: { id: true, firstName: true, lastName: true } },
    },
  });
  res.json(docs);
});

router.post('/', authenticate, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'File is required' });
  try {
    const doc = await prisma.document.create({
      data: {
        ...req.body,
        filePath: req.file.path,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        uploadedBy: req.user.name,
        expiryDate: req.body.expiryDate ? new Date(req.body.expiryDate) : null,
      },
    });
    res.status(201).json(doc);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/:id/download', authenticate, async (req, res) => {
  const doc = await prisma.document.findUnique({ where: { id: req.params.id } });
  if (!doc) return res.status(404).json({ error: 'Document not found' });
  res.download(doc.filePath, doc.title);
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    const doc = await prisma.document.findUnique({ where: { id: req.params.id } });
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    if (fs.existsSync(doc.filePath)) fs.unlinkSync(doc.filePath);
    await prisma.document.delete({ where: { id: req.params.id } });
    res.json({ message: 'Document deleted' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Expiry alerts
router.get('/alerts/expiring', authenticate, async (req, res) => {
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
  const docs = await prisma.document.findMany({
    where: { expiryDate: { lte: thirtyDaysFromNow, gte: new Date() } },
    include: {
      employee: { select: { firstName: true, lastName: true } },
      candidate: { select: { firstName: true, lastName: true } },
    },
    orderBy: { expiryDate: 'asc' },
  });
  res.json(docs);
});

module.exports = router;
