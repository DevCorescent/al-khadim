const router  = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');

const prisma = new PrismaClient();

/* ─── helpers ─────────────────────────────────────────────── */
const PREFIX = { INVOICE: 'INV', PROFORMA_INVOICE: 'PI', QUOTATION: 'QT' };

async function nextNumber(docType) {
  const prefix = PREFIX[docType] || 'INV';
  const yr     = new Date().getFullYear();
  const last   = await prisma.invoice.findFirst({
    where: { docType, invoiceNo: { startsWith: `${prefix}-${yr}-` } },
    orderBy: { createdAt: 'desc' },
  });
  const seq = last ? parseInt(last.invoiceNo.split('-').pop() || '0') + 1 : 1;
  return `${prefix}-${yr}-${String(seq).padStart(4, '0')}`;
}

function calcTotals(items = [], discountVal, discountType, taxRate) {
  const subtotal  = items.reduce((s, i) => s + (parseFloat(i.qty) * parseFloat(i.unitPrice)), 0);
  const discAmt   = discountType === 'PERCENT'
    ? subtotal * (parseFloat(discountVal) / 100)
    : parseFloat(discountVal || 0);
  const taxable   = Math.max(0, subtotal - discAmt);
  const taxAmt    = taxable * (parseFloat(taxRate || 0) / 100);
  const total     = taxable + taxAmt;
  return { subtotal, discount: discAmt, tax: taxAmt, totalAmount: total, amount: subtotal };
}

const includeAll = {
  client: { select: { id: true, companyName: true, contactPerson: true, email: true, phone: true, address: true, city: true, country: true } },
  items: { orderBy: { sortOrder: 'asc' } },
};

/* ─── GET /  list ─────────────────────────────────────────── */
router.get('/', authenticate, async (req, res) => {
  try {
    const { clientId, status, docType, search, page = 1, limit = 50, year } = req.query;
    const where = {};
    if (clientId) where.clientId = clientId;
    if (status)   where.status   = status;
    if (docType)  where.docType  = docType;
    if (year) {
      where.issueDate = {
        gte: new Date(`${year}-01-01`),
        lte: new Date(`${year}-12-31`),
      };
    }
    if (search) {
      where.OR = [
        { invoiceNo: { contains: search, mode: 'insensitive' } },
        { client: { companyName: { contains: search, mode: 'insensitive' } } },
        { subject: { contains: search, mode: 'insensitive' } },
      ];
    }
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [docs, total] = await Promise.all([
      prisma.invoice.findMany({ where, include: includeAll, orderBy: { createdAt: 'desc' }, skip, take: parseInt(limit) }),
      prisma.invoice.count({ where }),
    ]);
    res.json({ data: docs, total });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ─── GET /stats  financial summary ──────────────────────── */
router.get('/stats', authenticate, async (req, res) => {
  try {
    const { year = new Date().getFullYear() } = req.query;
    const where = { issueDate: { gte: new Date(`${year}-01-01`), lte: new Date(`${year}-12-31`) } };

    const [all, byMonth, byClient, byStatus, byType] = await Promise.all([
      prisma.invoice.findMany({ where }),
      prisma.invoice.groupBy({ by: ['issueDate', 'status', 'docType'], where, _sum: { totalAmount: true } }),
      prisma.invoice.groupBy({ by: ['clientId'], where: { ...where, docType: 'INVOICE' }, _sum: { totalAmount: true }, orderBy: { _sum: { totalAmount: 'desc' } }, take: 10 }),
      prisma.invoice.groupBy({ by: ['status'], where: { docType: 'INVOICE' }, _sum: { totalAmount: true }, _count: true }),
      prisma.invoice.groupBy({ by: ['docType'], _sum: { totalAmount: true }, _count: true }),
    ]);

    const invoices = all.filter(i => i.docType === 'INVOICE');
    const totalInvoiced   = invoices.reduce((s, i) => s + i.totalAmount, 0);
    const totalPaid       = invoices.filter(i => i.status === 'PAID').reduce((s, i) => s + i.totalAmount, 0);
    const totalOverdue    = invoices.filter(i => i.status === 'OVERDUE').reduce((s, i) => s + i.totalAmount, 0);
    const totalDraft      = invoices.filter(i => i.status === 'DRAFT').reduce((s, i) => s + i.totalAmount, 0);
    const totalOutstanding = invoices.filter(i => ['SENT','PENDING'].includes(i.status)).reduce((s, i) => s + i.totalAmount, 0);

    // Monthly aggregation
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const monthly = months.map((m, idx) => {
      const monthDocs = invoices.filter(i => new Date(i.issueDate).getMonth() === idx);
      return {
        month: m,
        invoiced: monthDocs.reduce((s, i) => s + i.totalAmount, 0),
        paid:     monthDocs.filter(i => i.status === 'PAID').reduce((s, i) => s + i.totalAmount, 0),
        overdue:  monthDocs.filter(i => i.status === 'OVERDUE').reduce((s, i) => s + i.totalAmount, 0),
      };
    });

    // Top clients with names
    const clientIds = byClient.map(c => c.clientId);
    const clientNames = await prisma.client.findMany({ where: { id: { in: clientIds } }, select: { id: true, companyName: true } });
    const nameMap = Object.fromEntries(clientNames.map(c => [c.id, c.companyName]));
    const topClients = byClient.map(c => ({ name: nameMap[c.clientId] || c.clientId, value: c._sum.totalAmount || 0 }));

    res.json({
      kpis: { totalInvoiced, totalPaid, totalOverdue, totalDraft, totalOutstanding,
               collectionRate: totalInvoiced ? ((totalPaid / totalInvoiced) * 100).toFixed(1) : '0.0',
               totalDocuments: all.length, invoiceCount: invoices.length },
      monthly,
      topClients,
      byStatus: byStatus.map(s => ({ name: s.status, value: s._sum.totalAmount || 0, count: s._count })),
      byType:   byType.map(t => ({ name: t.docType.replace('_', ' '), value: t._sum.totalAmount || 0, count: t._count })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ─── GET /:id ────────────────────────────────────────────── */
router.get('/:id', authenticate, async (req, res) => {
  try {
    const doc = await prisma.invoice.findUnique({ where: { id: req.params.id }, include: includeAll });
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ─── scalar fields helper ────────────────────────────────── */
function scalarFields(rest) {
  return {
    clientId:       rest.clientId,
    status:         rest.status        || 'DRAFT',
    currency:       rest.currency      || 'USD',
    subject:        rest.subject       || null,
    description:    rest.description   || null,
    terms:          rest.terms         || null,
    notes:          rest.notes         || null,
    // From / sender
    fromName:       rest.fromName      || null,
    fromAddress:    rest.fromAddress   || null,
    fromEmail:      rest.fromEmail     || null,
    fromPhone:      rest.fromPhone     || null,
    fromTaxNo:      rest.fromTaxNo     || null,
    fromRegNo:      rest.fromRegNo     || null,
    // Billing / to
    billingName:    rest.billingName   || null,
    billingAddress: rest.billingAddress|| null,
    billingEmail:   rest.billingEmail  || null,
    billingPhone:   rest.billingPhone  || null,
    // Tax
    taxLabel:       rest.taxLabel      || 'VAT',
    // Design
    template:       rest.template        || 'classic',
    primaryColor:   rest.primaryColor    || '#6366f1',
    accentColor:    rest.accentColor     || '#ffffff',
    fontFamily:     rest.fontFamily      || 'helvetica',
    logoText:       rest.logoText        || null,
    logoShape:      rest.logoShape       || 'rounded',
    tableStyle:     rest.tableStyle      || 'striped',
    watermark:      rest.watermark       || null,
    watermarkOpacity: rest.watermarkOpacity !== undefined ? parseInt(rest.watermarkOpacity) : 12,
    showHeader:     rest.showHeader    !== undefined ? Boolean(rest.showHeader)    : true,
    showFooter:     rest.showFooter    !== undefined ? Boolean(rest.showFooter)    : true,
    showSignature:  rest.showSignature !== undefined ? Boolean(rest.showSignature) : false,
    footerText:     rest.footerText    || null,
    // Payment
    paymentMethod:  rest.paymentMethod || 'BANK_TRANSFER',
    paymentRef:     rest.paymentRef    || null,
    // Bank
    bankName:       rest.bankName      || null,
    bankAccount:    rest.bankAccount   || null,
    bankIBAN:       rest.bankIBAN      || null,
    bankSwift:      rest.bankSwift     || null,
    bankRoutingNo:  rest.bankRoutingNo || null,
    bankSortCode:   rest.bankSortCode  || null,
  };
}

/* ─── POST /  create ──────────────────────────────────────── */
router.post('/', authenticate, async (req, res) => {
  try {
    const { items = [], discountType = 'FIXED', discount = 0, taxRate = 0, docType = 'INVOICE', ...rest } = req.body;
    const invoiceNo = await nextNumber(docType);
    const totals    = calcTotals(items, discount, discountType, taxRate);

    const doc = await prisma.invoice.create({
      data: {
        invoiceNo, docType,
        ...scalarFields(rest),
        discountType, taxRate: parseFloat(taxRate),
        issueDate:  rest.issueDate  ? new Date(rest.issueDate)  : new Date(),
        dueDate:    rest.dueDate    ? new Date(rest.dueDate)    : null,
        validUntil: rest.validUntil ? new Date(rest.validUntil) : null,
        ...totals,
        items: {
          create: items.map((it, idx) => ({
            description: it.description,
            qty:         parseFloat(it.qty || 1),
            unit:        it.unit || null,
            unitPrice:   parseFloat(it.unitPrice || 0),
            total:       parseFloat(it.qty || 1) * parseFloat(it.unitPrice || 0),
            sortOrder:   idx,
          })),
        },
      },
      include: includeAll,
    });
    res.status(201).json(doc);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/* ─── PUT /:id  update ────────────────────────────────────── */
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { items, discountType, discount, taxRate, ...rest } = req.body;
    const existing = await prisma.invoice.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Not found' });

    const update = { ...scalarFields(rest) };
    if (rest.status)     update.status     = rest.status;
    if (rest.docType)    update.docType    = rest.docType;
    if (rest.issueDate)  update.issueDate  = new Date(rest.issueDate);
    if (rest.dueDate)    update.dueDate    = rest.dueDate ? new Date(rest.dueDate) : null;
    if (rest.validUntil) update.validUntil = rest.validUntil ? new Date(rest.validUntil) : null;
    if (rest.status === 'PAID' && !existing.paidDate) update.paidDate = new Date();

    if (items !== undefined) {
      const effDiscount     = discount     ?? existing.discount;
      const effDiscountType = discountType ?? existing.discountType;
      const effTaxRate      = taxRate      ?? existing.taxRate;
      const totals = calcTotals(items, effDiscount, effDiscountType, effTaxRate);
      Object.assign(update, totals, { discountType: effDiscountType, taxRate: parseFloat(effTaxRate) });

      // Replace items
      await prisma.invoiceItem.deleteMany({ where: { invoiceId: req.params.id } });
      await prisma.invoiceItem.createMany({
        data: items.map((it, idx) => ({
          invoiceId:   req.params.id,
          description: it.description,
          qty:         parseFloat(it.qty || 1),
          unit:        it.unit || null,
          unitPrice:   parseFloat(it.unitPrice || 0),
          total:       parseFloat(it.qty || 1) * parseFloat(it.unitPrice || 0),
          sortOrder:   idx,
        })),
      });
    } else if (discount !== undefined || taxRate !== undefined) {
      const effDiscount     = discount     ?? existing.discount;
      const effDiscountType = discountType ?? existing.discountType;
      const effTaxRate      = taxRate      ?? existing.taxRate;
      const existingItems   = await prisma.invoiceItem.findMany({ where: { invoiceId: req.params.id } });
      const totals = calcTotals(existingItems, effDiscount, effDiscountType, effTaxRate);
      Object.assign(update, totals, { discountType: effDiscountType, taxRate: parseFloat(effTaxRate) });
    }

    const doc = await prisma.invoice.update({ where: { id: req.params.id }, data: update, include: includeAll });

    // Only post a cash-in transaction on the actual DRAFT/SENT/... -> PAID
    // transition (not a no-op re-save of an already-paid invoice), and only
    // when the caller opted in with an accountId.
    if (rest.status === 'PAID' && rest.accountId && !existing.paidDate) {
      await prisma.accountTransaction.create({
        data: {
          accountId: rest.accountId,
          type: 'INVOICE_PAYMENT',
          amount: doc.totalAmount,
          description: `Payment received for ${doc.invoiceNo}`,
          relatedInvoiceId: doc.id,
          createdBy: req.user.id,
        },
      });
    }

    res.json(doc);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/* ─── DELETE /:id ─────────────────────────────────────────── */
router.delete('/:id', authenticate, async (req, res) => {
  try {
    await prisma.invoice.delete({ where: { id: req.params.id } });
    res.json({ message: 'Deleted' });
  } catch {
    res.status(404).json({ error: 'Not found' });
  }
});

/* ─── POST /:id/duplicate ─────────────────────────────────── */
router.post('/:id/duplicate', authenticate, async (req, res) => {
  try {
    const src   = await prisma.invoice.findUnique({ where: { id: req.params.id }, include: { items: true } });
    if (!src) return res.status(404).json({ error: 'Not found' });
    const invoiceNo = await nextNumber(src.docType);
    const { id, createdAt, updatedAt, paidDate, invoiceNo: _no, ...srcData } = src;
    const doc = await prisma.invoice.create({
      data: {
        ...srcData,
        invoiceNo,
        status: 'DRAFT',
        issueDate: new Date(),
        items: { create: src.items.map(({ id: _id, invoiceId: _iv, createdAt: _c, ...item }) => item) },
      },
      include: includeAll,
    });
    res.status(201).json(doc);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
