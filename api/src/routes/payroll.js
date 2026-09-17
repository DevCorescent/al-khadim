const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const { authenticate, authorize } = require('../middleware/auth');

const prisma = new PrismaClient();

router.get('/', authenticate, async (req, res) => {
  const { employeeId, month, year, status } = req.query;
  const where = {};
  if (employeeId) where.employeeId = employeeId;
  if (month) where.month = parseInt(month);
  if (year) where.year = parseInt(year);
  if (status) where.status = status;

  const payrolls = await prisma.payroll.findMany({
    where,
    orderBy: [{ year: 'desc' }, { month: 'desc' }],
    include: { employee: { select: { id: true, firstName: true, lastName: true, employeeId: true, designation: true } } },
  });
  res.json(payrolls);
});

router.post('/process', authenticate, authorize('SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT'), async (req, res) => {
  const { month, year, employeeIds } = req.body;
  try {
    const employees = await prisma.employee.findMany({
      where: employeeIds ? { id: { in: employeeIds } } : { status: 'ACTIVE' },
    });

    const payrolls = await Promise.all(employees.map(async (emp) => {
      const attendances = await prisma.attendance.findMany({
        where: {
          employeeId: emp.id,
          date: {
            gte: new Date(year, month - 1, 1),
            lte: new Date(year, month, 0),
          },
        },
      });

      const totalOvertime = attendances.reduce((sum, a) => sum + (a.overtime || 0), 0);
      const overtimePay = (emp.basicSalary / 30 / 8) * 1.5 * totalOvertime;
      const grossSalary = emp.basicSalary + overtimePay;
      const netSalary = grossSalary;

      return prisma.payroll.upsert({
        where: { employeeId_month_year: { employeeId: emp.id, month: parseInt(month), year: parseInt(year) } },
        update: { basicSalary: emp.basicSalary, overtime: overtimePay, grossSalary, netSalary, status: 'PROCESSED' },
        create: {
          employeeId: emp.id,
          month: parseInt(month),
          year: parseInt(year),
          basicSalary: emp.basicSalary,
          allowances: 0,
          overtime: overtimePay,
          deductions: 0,
          grossSalary,
          netSalary,
          currency: emp.currency,
          status: 'PROCESSED',
        },
      });
    }));

    res.json({ processed: payrolls.length, payrolls });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id', authenticate, async (req, res) => {
  try {
    const data = { ...req.body };
    if (data.basicSalary) data.basicSalary = parseFloat(data.basicSalary);
    if (data.allowances) data.allowances = parseFloat(data.allowances);
    if (data.deductions) data.deductions = parseFloat(data.deductions);
    if (data.overtime) data.overtime = parseFloat(data.overtime);
    data.grossSalary = (data.basicSalary || 0) + (data.allowances || 0) + (data.overtime || 0);
    data.netSalary = data.grossSalary - (data.deductions || 0);

    const payroll = await prisma.payroll.update({ where: { id: req.params.id }, data });
    res.json(payroll);
  } catch {
    res.status(404).json({ error: 'Payroll not found' });
  }
});

router.post('/:id/approve', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  try {
    const payroll = await prisma.payroll.update({
      where: { id: req.params.id },
      data: { status: 'APPROVED' },
    });
    res.json(payroll);
  } catch {
    res.status(404).json({ error: 'Payroll not found' });
  }
});

/* ─── PATCH /:id/pay  (optionally posts an AccountTransaction) ── */
router.patch('/:id/pay', authenticate, authorize('SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT'), async (req, res) => {
  const existing = await prisma.payroll.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: 'Payroll record not found' });
  if (existing.status === 'PAID') return res.status(400).json({ error: 'Already marked paid' });

  const { accountId, paymentMethod } = req.body || {};

  try {
    const [payroll] = await prisma.$transaction([
      prisma.payroll.update({
        where: { id: req.params.id },
        data: {
          status: 'PAID',
          paymentDate: new Date(),
          paymentMethod: paymentMethod || existing.paymentMethod,
        },
      }),
      ...(accountId
        ? [
            prisma.accountTransaction.create({
              data: {
                accountId,
                type: 'PAYROLL_PAYMENT',
                amount: -Math.abs(existing.netSalary),
                description: `Payroll ${existing.month}/${existing.year}`,
                relatedPayrollId: existing.id,
                createdBy: req.user.id,
              },
            }),
          ]
        : []),
    ]);
    res.json(payroll);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
