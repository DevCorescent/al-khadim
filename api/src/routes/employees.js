const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');
const upload = require('../middleware/upload');

const prisma = new PrismaClient();

router.get('/', authenticate, async (req, res) => {
  const { search, status, department, page = 1, limit = 20 } = req.query;
  const where = {};
  if (search) {
    where.OR = [
      { firstName: { contains: search, mode: 'insensitive' } },
      { lastName: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { employeeId: { contains: search, mode: 'insensitive' } },
    ];
  }
  if (status) where.status = status;
  if (department) where.department = { contains: department, mode: 'insensitive' };

  const [employees, total] = await Promise.all([
    prisma.employee.findMany({
      where,
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit),
      orderBy: { createdAt: 'desc' },
    }),
    prisma.employee.count({ where }),
  ]);
  res.json({ data: employees, total, page: Number(page), limit: Number(limit) });
});

router.get('/:id', authenticate, async (req, res) => {
  const employee = await prisma.employee.findUnique({
    where: { id: req.params.id },
    include: {
      attendances: { orderBy: { date: 'desc' }, take: 30 },
      leaves: { orderBy: { startDate: 'desc' }, take: 10 },
      payrolls: { orderBy: { year: 'desc' }, take: 12 },
      documents: true,
    },
  });
  if (!employee) return res.status(404).json({ error: 'Employee not found' });
  res.json(employee);
});

router.post('/', authenticate, upload.single('photo'), async (req, res) => {
  try {
    const data = { ...req.body };
    if (req.file) data.photo = req.file.path;
    if (data.basicSalary) data.basicSalary = parseFloat(data.basicSalary);
    if (data.joiningDate) data.joiningDate = new Date(data.joiningDate);
    if (data.passportExpiry) data.passportExpiry = new Date(data.passportExpiry);
    if (data.visaExpiry) data.visaExpiry = new Date(data.visaExpiry);
    if (data.emiratesExpiry) data.emiratesExpiry = new Date(data.emiratesExpiry);

    const employee = await prisma.employee.create({ data });
    res.status(201).json(employee);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id', authenticate, upload.single('photo'), async (req, res) => {
  try {
    const data = { ...req.body };
    if (req.file) data.photo = req.file.path;
    if (data.basicSalary) data.basicSalary = parseFloat(data.basicSalary);
    if (data.joiningDate) data.joiningDate = new Date(data.joiningDate);
    if (data.passportExpiry) data.passportExpiry = new Date(data.passportExpiry);
    if (data.visaExpiry) data.visaExpiry = new Date(data.visaExpiry);
    if (data.emiratesExpiry) data.emiratesExpiry = new Date(data.emiratesExpiry);

    const employee = await prisma.employee.update({ where: { id: req.params.id }, data });
    res.json(employee);
  } catch {
    res.status(404).json({ error: 'Employee not found' });
  }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    await prisma.employee.delete({ where: { id: req.params.id } });
    res.json({ message: 'Employee deleted' });
  } catch {
    res.status(404).json({ error: 'Employee not found' });
  }
});

module.exports = router;
