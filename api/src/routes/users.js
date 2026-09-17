const router   = require('express').Router();
const bcrypt   = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { authenticate, authorize } = require('../middleware/auth');

const prisma = new PrismaClient();

const USER_SELECT = {
  id: true, name: true, email: true, role: true, customRole: true,
  permissions: true, phone: true, department: true, avatar: true,
  isActive: true, lastLogin: true, createdAt: true,
};

/* ── List all users ── */
router.get('/', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  const { search, role, isActive } = req.query;
  const where = {};
  if (search) {
    where.OR = [
      { name:  { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ];
  }
  if (role)     where.role     = role;
  if (isActive !== undefined) where.isActive = isActive === 'true';

  const users = await prisma.user.findMany({
    where, select: USER_SELECT, orderBy: { createdAt: 'desc' },
  });
  res.json(users);
});

/* ── Get single user ── */
router.get('/:id', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.params.id }, select: USER_SELECT });
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

/* ── Create user ── */
router.post('/', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), [
  body('name').notEmpty().withMessage('Name is required'),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('role').isIn(['SUPER_ADMIN','ADMIN','MANAGER','RECRUITER','HR','ACCOUNTANT','VIEWER']).withMessage('Invalid role'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { name, email, password, role, phone, department, customRole, permissions } = req.body;

  // Only SUPER_ADMIN can create other SUPER_ADMINs
  if (role === 'SUPER_ADMIN' && req.user.role !== 'SUPER_ADMIN') {
    return res.status(403).json({ error: 'Only Super Admin can create Super Admin accounts' });
  }

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const hashed = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        name, email, password: hashed, role, phone, department,
        customRole: customRole || null,
        permissions: permissions ? (typeof permissions === 'string' ? JSON.parse(permissions) : permissions) : null,
      },
      select: USER_SELECT,
    });
    res.status(201).json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── Update user ── */
router.put('/:id', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  const { name, role, phone, department, isActive, customRole, permissions } = req.body;

  // Prevent ADMIN from promoting to SUPER_ADMIN
  if (role === 'SUPER_ADMIN' && req.user.role !== 'SUPER_ADMIN') {
    return res.status(403).json({ error: 'Only Super Admin can assign Super Admin role' });
  }
  // Prevent self-deactivation
  if (req.params.id === req.user.id && isActive === false) {
    return res.status(400).json({ error: 'Cannot deactivate your own account' });
  }

  try {
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: {
        name, role, phone, department,
        isActive: isActive !== undefined ? Boolean(isActive) : undefined,
        customRole: customRole || null,
        permissions: permissions ? (typeof permissions === 'string' ? JSON.parse(permissions) : permissions) : null,
      },
      select: USER_SELECT,
    });
    res.json(user);
  } catch {
    res.status(404).json({ error: 'User not found' });
  }
});

/* ── Reset user password (admin) ── */
router.post('/:id/reset-password', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), [
  body('newPassword').isLength({ min: 8 }),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const hashed = await bcrypt.hash(req.body.newPassword, 12);
    await prisma.user.update({ where: { id: req.params.id }, data: { password: hashed } });
    res.json({ message: 'Password reset successfully' });
  } catch {
    res.status(404).json({ error: 'User not found' });
  }
});

/* ── Toggle active status ── */
router.patch('/:id/toggle-active', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  if (req.params.id === req.user.id) {
    return res.status(400).json({ error: 'Cannot deactivate your own account' });
  }
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id }, select: { isActive: true } });
    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: { isActive: !user.isActive },
      select: USER_SELECT,
    });
    res.json(updated);
  } catch {
    res.status(404).json({ error: 'User not found' });
  }
});

/* ── Delete user ── */
router.delete('/:id', authenticate, authorize('SUPER_ADMIN'), async (req, res) => {
  if (req.params.id === req.user.id) {
    return res.status(400).json({ error: 'Cannot delete your own account' });
  }
  try {
    await prisma.user.delete({ where: { id: req.params.id } });
    res.json({ message: 'User deleted' });
  } catch {
    res.status(404).json({ error: 'User not found' });
  }
});

module.exports = router;
