const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');

const prisma = new PrismaClient();

// Public endpoint for contact form
router.post('/public', async (req, res) => {
  try {
    const enquiry = await prisma.clientEnquiry.create({ data: req.body });
    res.status(201).json({ message: 'Enquiry submitted successfully', id: enquiry.id });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/', authenticate, async (req, res) => {
  const { status } = req.query;
  const where = {};
  if (status) where.status = status;
  const enquiries = await prisma.clientEnquiry.findMany({
    where, orderBy: { createdAt: 'desc' },
    include: { client: { select: { id: true, companyName: true } } },
  });
  res.json(enquiries);
});

router.put('/:id', authenticate, async (req, res) => {
  try {
    const enquiry = await prisma.clientEnquiry.update({ where: { id: req.params.id }, data: req.body });
    res.json(enquiry);
  } catch {
    res.status(404).json({ error: 'Enquiry not found' });
  }
});

/* Convert an enquiry into a Client (find-or-create by email) + a LEAD-stage Deal. */
router.post('/:id/convert', authenticate, async (req, res) => {
  try {
    const enquiry = await prisma.clientEnquiry.findUnique({ where: { id: req.params.id }, include: { deal: true } });
    if (!enquiry) return res.status(404).json({ error: 'Enquiry not found' });
    if (enquiry.deal) return res.status(400).json({ error: 'This enquiry has already been converted' });

    let clientId = enquiry.clientId;
    if (!clientId) {
      const existingClient = await prisma.client.findFirst({ where: { email: enquiry.email } });
      if (existingClient) {
        clientId = existingClient.id;
      } else {
        const newClient = await prisma.client.create({
          data: {
            companyName: enquiry.companyName,
            contactPerson: enquiry.contactName,
            email: enquiry.email,
            phone: enquiry.phone,
            source: 'Enquiry Form',
            status: 'APPROVED',
          },
        });
        clientId = newClient.id;
      }
      await prisma.clientEnquiry.update({ where: { id: enquiry.id }, data: { clientId } });
    }

    const deal = await prisma.deal.create({
      data: {
        title: `${enquiry.companyName} — ${enquiry.service || 'General Enquiry'}`,
        clientId,
        source: 'Enquiry Form',
        enquiryId: enquiry.id,
        stage: 'LEAD',
        probability: 10,
        ownerId: req.user.id,
        createdBy: req.user.id,
      },
    });
    await prisma.activity.create({
      data: { clientId, dealId: deal.id, type: 'SYSTEM', content: `Deal created from converted enquiry`, createdBy: req.user.id },
    });

    const updatedEnquiry = await prisma.clientEnquiry.update({ where: { id: enquiry.id }, data: { status: 'CONVERTED' } });
    const client = await prisma.client.findUnique({ where: { id: clientId } });

    res.json({ client, deal, enquiry: updatedEnquiry });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
