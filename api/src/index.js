require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const path = require('path');
const rateLimit = require('express-rate-limit');

const app = express();

// Security middleware
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(compression());
app.use(morgan('combined'));

// CORS
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true,
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static file serving for uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Global rate limiter
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: { error: 'Too many requests, please try again later.' },
}));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/clients', require('./routes/clients'));
app.use('/api/deals', require('./routes/deals'));
app.use('/api/activities', require('./routes/activities'));
app.use('/api/expenses', require('./routes/expenses'));
app.use('/api/bank-accounts', require('./routes/bankAccounts'));
app.use('/api/budgets', require('./routes/budgets'));
app.use('/api/candidates', require('./routes/candidates'));
app.use('/api/jobs', require('./routes/jobs'));
app.use('/api/interviews', require('./routes/interviews'));
app.use('/api/employees', require('./routes/employees'));
app.use('/api/attendance', require('./routes/attendance'));
app.use('/api/leave', require('./routes/leave'));
app.use('/api/payroll', require('./routes/payroll'));
app.use('/api/outsourcing', require('./routes/outsourcing'));
app.use('/api/documents', require('./routes/documents'));
app.use('/api/follow-ups', require('./routes/followUps'));
app.use('/api/invoices', require('./routes/invoices'));
app.use('/api/enquiries', require('./routes/enquiries'));
app.use('/api/registrations', require('./routes/registrations'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/otp', require('./routes/otp'));
app.use('/api/candidate-auth', require('./routes/candidateAuth'));
app.use('/api/client-auth',    require('./routes/clientAuth'));
app.use('/api/client-users',   require('./routes/clientUsers'));
app.use('/api/profile-shares', require('./routes/profileShares'));
app.use('/api/candidate-tracking', require('./routes/candidateTracking'));
app.use('/api/document-requests', require('./routes/documentRequests'));
app.use('/api/site-config',   require('./routes/siteConfig'));
app.use('/api/roles',         require('./routes/roles'));
app.use('/api/categories',    require('./routes/categories'));
app.use('/api/industries',    require('./routes/industries'));
app.use('/api/emails',        require('./routes/emails'));
app.use('/api/emails/templates', require('./routes/emailTemplates'));
app.use('/api/emails/campaigns', require('./routes/emailCampaigns'));
app.use('/api/emails/groups', require('./routes/emailGroups'));
app.use('/api/ai-assistant', require('./routes/aiAssistant'));
app.use('/api/ai-public', require('./routes/aiPublic'));
app.use('/api/ai-settings', require('./routes/aiSettings'));

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

// 404 handler
app.use((req, res) => res.status(404).json({ error: 'Route not found' }));

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  const status = err.status || 500;
  res.status(status).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

const { startEmailScheduler } = require('./scheduler/emailScheduler');

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Al Khadim API running on port ${PORT}`);
  startEmailScheduler();
});

module.exports = app;
