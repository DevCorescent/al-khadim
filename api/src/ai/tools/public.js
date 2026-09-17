/**
 * Public (unauthenticated) tools: exposed only to the anonymous homepage
 * widget via getPublicTools()/executePublicTool() in _registry.js — these are
 * the only tools whose `allowedRoles` includes the literal 'PUBLIC' sentinel.
 * No internal/private data is ever touched here.
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const MAX_ROWS = 50;

// Closed enum -> real href. The model can only ever pick one of these keys;
// it never gets to construct a URL itself.
const TARGETS = {
  'candidate-register': { href: '/candidate/register', label: 'Submit Your Profile' },
  'enquiry': { href: '/enquiry', label: 'Request Staff / Outsourcing' },
  'careers': { href: '/careers', label: 'Browse Open Jobs' },
  'contact': { href: '/contact', label: 'Contact Us' },
};

module.exports = [
  {
    name: 'listOpenJobs',
    description: 'List currently open, published job vacancies. Optionally filter by a free-text match on the job title or by country.',
    parameters: {
      type: 'object',
      properties: {
        search: { type: 'string', description: 'Free-text match on job title' },
        country: { type: 'string', description: 'Filter by client country' },
        limit: { type: 'integer', minimum: 1, maximum: MAX_ROWS, description: `Max rows to return (capped at ${MAX_ROWS})` },
      },
      additionalProperties: false,
    },
    allowedRoles: ['PUBLIC'],
    handler: async (args) => {
      const where = { status: 'OPEN', isPublished: true };
      if (args.search) where.title = { contains: args.search, mode: 'insensitive' };
      if (args.country) where.client = { is: { country: { contains: args.country, mode: 'insensitive' } } };

      const take = Math.min(args.limit || 20, MAX_ROWS);
      const jobs = await prisma.job.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: { client: { select: { companyName: true, country: true } } },
        take,
      });

      const table = {
        columns: [
          { key: 'title', label: 'Title' }, { key: 'client', label: 'Client' },
          { key: 'country', label: 'Country' }, { key: 'location', label: 'Location' },
        ],
        rows: jobs.map((j) => ({
          title: j.title,
          client: j.client?.companyName || '—',
          country: j.client?.country || j.country || '—',
          location: j.location || '—',
        })),
      };

      return {
        summary: `${jobs.length} open job${jobs.length === 1 ? '' : 's'} found${jobs.length === MAX_ROWS ? ' (showing the most recent 50)' : ''}.`,
        table,
      };
    },
  },
  {
    name: 'suggestNavigation',
    description: "Point the visitor to the right page on the site for what they want to do — use 'candidate-register' when they want to submit their CV/profile for work, 'enquiry' when a company wants to request staff/outsourcing, 'careers' to browse all open jobs, 'contact' for anything else.",
    parameters: {
      type: 'object',
      properties: {
        target: { type: 'string', enum: Object.keys(TARGETS), description: 'Which page to send the visitor to' },
      },
      required: ['target'],
      additionalProperties: false,
    },
    allowedRoles: ['PUBLIC'],
    handler: async (args) => {
      const target = TARGETS[args.target];
      if (!target) {
        return { summary: `I couldn't find a page for "${args.target}".`, table: undefined };
      }
      // NOTE: `navigate` is an extra field beyond the standard {summary, table}
      // AiTool return shape — this is the one tool whose result the frontend
      // reads a `navigate` key from (in the SSE tool_result event) to render
      // a CTA button, rather than a table.
      return { summary: `Head to "${target.label}" to continue.`, table: undefined, navigate: target };
    },
  },
];
