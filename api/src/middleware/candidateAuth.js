const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const authenticateCandidate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Access token required' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.type !== 'candidate') return res.status(401).json({ error: 'Invalid token type' });

    const account = await prisma.candidateAccount.findUnique({
      where: { candidateId: decoded.candidateId },
      include: { candidate: true },
    });

    if (!account || !account.isActive) {
      return res.status(401).json({ error: 'Account not active or not found' });
    }

    req.candidate = account.candidate;
    req.candidateAccount = account;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') return res.status(401).json({ error: 'Token expired' });
    return res.status(401).json({ error: 'Invalid token' });
  }
};

module.exports = { authenticateCandidate };
