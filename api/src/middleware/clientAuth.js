const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const authenticateClient = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Access token required' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.type !== 'client') return res.status(401).json({ error: 'Invalid token type' });

    const clientUser = await prisma.clientUser.findUnique({
      where: { id: decoded.clientUserId },
      include: { client: true },
    });

    if (!clientUser || !clientUser.isActive || !clientUser.client.isActive) {
      return res.status(401).json({ error: 'Account not active or not found' });
    }

    req.clientUser = clientUser;
    req.client = clientUser.client;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') return res.status(401).json({ error: 'Token expired' });
    return res.status(401).json({ error: 'Invalid token' });
  }
};

const authorizeCompanyAdmin = (req, res, next) => {
  if (req.clientUser.role !== 'COMPANY_ADMIN') {
    return res.status(403).json({ error: 'Only a company admin can perform this action' });
  }
  next();
};

const requireApprovedClient = (req, res, next) => {
  if (req.client.status !== 'APPROVED') {
    return res.status(403).json({ error: 'Your company account is pending approval', status: req.client.status });
  }
  next();
};

const authenticateApprovedClient = [authenticateClient, requireApprovedClient];

module.exports = { authenticateClient, authorizeCompanyAdmin, requireApprovedClient, authenticateApprovedClient };
