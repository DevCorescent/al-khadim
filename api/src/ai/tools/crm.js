/**
 * CRM domain tools: Client, Deal, Activity.
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const CRM_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'];
const CRM_SUMMARY_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'VIEWER'];

const CLIENT_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'];
const DEAL_STAGES = ['LEAD', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST'];
const ACTIVITY_TYPES = ['NOTE', 'CALL', 'MEETING', 'EMAIL', 'TASK', 'STAGE_CHANGE', 'SYSTEM'];

const MAX_ROWS = 100;

module.exports = [
  {
    name: 'searchClients',
    description: 'Search clients by status or a free-text match on company name/contact person. Returns up to 100 matching clients.',
    parameters: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: CLIENT_STATUSES, description: 'Filter by client status' },
        search: { type: 'string', description: 'Free-text match on company name or contact person' },
        limit: { type: 'integer', minimum: 1, maximum: MAX_ROWS },
      },
      additionalProperties: false,
    },
    allowedRoles: CRM_ROLES,
    handler: async (args) => {
      const where = {};
      if (args.status) where.status = args.status;
      if (args.search) {
        where.OR = [
          { companyName: { contains: args.search, mode: 'insensitive' } },
          { contactPerson: { contains: args.search, mode: 'insensitive' } },
        ];
      }
      const take = Math.min(args.limit || MAX_ROWS, MAX_ROWS);
      const [rows, total] = await Promise.all([
        prisma.client.findMany({ where, take, orderBy: { createdAt: 'desc' } }),
        prisma.client.count({ where }),
      ]);
      const table = {
        columns: [
          { key: 'companyName', label: 'Company' }, { key: 'contactPerson', label: 'Contact' }, { key: 'status', label: 'Status' },
          { key: 'industry', label: 'Industry' }, { key: 'tags', label: 'Tags' },
        ],
        rows: rows.map((c) => ({
          companyName: c.companyName, contactPerson: c.contactPerson, status: c.status,
          industry: c.industry || '—', tags: c.tags.join(', ') || '—',
        })),
      };
      const cappedNote = total > take ? ` (showing ${take} of ${total} — refine your question to narrow this down)` : '';
      return { summary: `Found ${total} client${total === 1 ? '' : 's'}${cappedNote}.`, table };
    },
  },
  {
    name: 'searchDeals',
    description: 'Search deals by pipeline stage or a free-text match on title. Returns up to 100 matching deals.',
    parameters: {
      type: 'object',
      properties: {
        stage: { type: 'string', enum: DEAL_STAGES, description: 'Filter by deal stage' },
        search: { type: 'string', description: 'Free-text match on deal title' },
        limit: { type: 'integer', minimum: 1, maximum: MAX_ROWS },
      },
      additionalProperties: false,
    },
    allowedRoles: CRM_ROLES,
    handler: async (args) => {
      const where = {};
      if (args.stage) where.stage = args.stage;
      if (args.search) where.title = { contains: args.search, mode: 'insensitive' };
      const take = Math.min(args.limit || MAX_ROWS, MAX_ROWS);
      const [rows, total] = await Promise.all([
        prisma.deal.findMany({
          where, take, orderBy: { createdAt: 'desc' },
          include: { client: { select: { companyName: true } }, owner: { select: { name: true } } },
        }),
        prisma.deal.count({ where }),
      ]);
      const table = {
        columns: [
          { key: 'title', label: 'Title' }, { key: 'client', label: 'Client' }, { key: 'value', label: 'Value' },
          { key: 'stage', label: 'Stage' }, { key: 'probability', label: 'Probability %' },
          { key: 'owner', label: 'Owner' }, { key: 'expectedCloseDate', label: 'Expected Close' },
        ],
        rows: rows.map((d) => ({
          title: d.title, client: d.client?.companyName || '—', value: `${d.value} ${d.currency}`, stage: d.stage,
          probability: d.probability, owner: d.owner?.name || '—',
          expectedCloseDate: d.expectedCloseDate ? d.expectedCloseDate.toISOString().slice(0, 10) : '—',
        })),
      };
      const cappedNote = total > take ? ` (showing ${take} of ${total})` : '';
      return { summary: `Found ${total} deal${total === 1 ? '' : 's'}${cappedNote}.`, table };
    },
  },
  {
    name: 'getSalesPipelineReport',
    description: 'Get a full sales funnel view: count and total value of deals grouped by stage, including won and lost.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
    allowedRoles: CRM_SUMMARY_ROLES,
    handler: async () => {
      const groups = await prisma.deal.groupBy({ by: ['stage'], _count: { _all: true }, _sum: { value: true } });
      const total = groups.reduce((s, g) => s + g._count._all, 0);
      const totalValue = groups.reduce((s, g) => s + (g._sum.value || 0), 0);
      const table = {
        columns: [{ key: 'stage', label: 'Stage' }, { key: 'count', label: 'Count' }, { key: 'value', label: 'Total Value' }],
        rows: DEAL_STAGES.map((stage) => {
          const g = groups.find((x) => x.stage === stage);
          return { stage, count: g?._count._all || 0, value: g?._sum.value || 0 };
        }),
      };
      return { summary: `${total} deal${total === 1 ? '' : 's'} across the pipeline, worth ${totalValue.toLocaleString()} AED total.`, table };
    },
  },
  {
    name: 'getDealWinLossReport',
    description: 'Get a win/loss report of closed deals (WON vs LOST) with a win-rate percentage for a date range, defaulting to the current year.',
    parameters: {
      type: 'object',
      properties: {
        fromDate: { type: 'string', description: 'ISO date, filters by actual close date, defaults to Jan 1 of the current year' },
        toDate: { type: 'string', description: 'ISO date, filters by actual close date, defaults to Dec 31 of the current year' },
      },
      additionalProperties: false,
    },
    allowedRoles: CRM_SUMMARY_ROLES,
    handler: async (args) => {
      const now = new Date();
      const from = args.fromDate ? new Date(args.fromDate) : new Date(now.getFullYear(), 0, 1);
      const to = args.toDate ? new Date(args.toDate) : new Date(now.getFullYear(), 11, 31, 23, 59, 59);
      const deals = await prisma.deal.findMany({
        where: { stage: { in: ['WON', 'LOST'] }, actualCloseDate: { gte: from, lte: to } },
        select: { stage: true, value: true },
      });
      const won = deals.filter((d) => d.stage === 'WON');
      const lost = deals.filter((d) => d.stage === 'LOST');
      const wonValue = won.reduce((s, d) => s + d.value, 0);
      const lostValue = lost.reduce((s, d) => s + d.value, 0);
      const winRate = deals.length ? Math.round((won.length / deals.length) * 1000) / 10 : 0;
      const table = {
        columns: [{ key: 'outcome', label: 'Outcome' }, { key: 'count', label: 'Count' }, { key: 'value', label: 'Total Value' }],
        rows: [
          { outcome: 'WON', count: won.length, value: wonValue },
          { outcome: 'LOST', count: lost.length, value: lostValue },
        ],
      };
      return {
        summary: `${deals.length} closed deal${deals.length === 1 ? '' : 's'} between ${from.toDateString()} and ${to.toDateString()}: ${won.length} won, ${lost.length} lost (${winRate}% win rate).`,
        table,
      };
    },
  },
  {
    name: 'getRecentActivities',
    description: 'List recent CRM activities (notes, calls, meetings, emails, tasks) across clients and deals, ordered newest first. Defaults to 20 rows, capped at 100.',
    parameters: {
      type: 'object',
      properties: {
        clientSearch: { type: 'string', description: 'Free-text match on client company name' },
        type: { type: 'string', enum: ACTIVITY_TYPES, description: 'Filter by activity type' },
        limit: { type: 'integer', minimum: 1, maximum: MAX_ROWS, description: 'Defaults to 20, capped at 100' },
      },
      additionalProperties: false,
    },
    allowedRoles: CRM_ROLES,
    handler: async (args) => {
      const where = {};
      if (args.type) where.type = args.type;
      if (args.clientSearch) where.client = { companyName: { contains: args.clientSearch, mode: 'insensitive' } };
      const take = Math.min(args.limit || 20, MAX_ROWS);
      const [rows, total] = await Promise.all([
        prisma.activity.findMany({
          where, take, orderBy: { createdAt: 'desc' },
          include: {
            client: { select: { companyName: true } },
            deal: { select: { title: true } },
            createdByUser: { select: { name: true } },
          },
        }),
        prisma.activity.count({ where }),
      ]);
      const table = {
        columns: [
          { key: 'client', label: 'Client' }, { key: 'deal', label: 'Deal' }, { key: 'type', label: 'Type' },
          { key: 'content', label: 'Content' }, { key: 'createdBy', label: 'Created By' }, { key: 'createdAt', label: 'Created At' },
        ],
        rows: rows.map((a) => ({
          client: a.client?.companyName || '—', deal: a.deal?.title || '—', type: a.type,
          content: a.content, createdBy: a.createdByUser?.name || '—', createdAt: a.createdAt.toISOString(),
        })),
      };
      const cappedNote = total > take ? ` (showing ${take} of ${total})` : '';
      return { summary: `${total} activit${total === 1 ? 'y' : 'ies'} found${cappedNote}.`, table };
    },
  },
];
