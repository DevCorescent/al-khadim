// Ported from api/src/ai/tools/recruitment.js
/**
 * Recruitment domain tools: Candidate, CandidateJob, Job, Interview.
 * Reference implementation for the tool contract — see _registry.js.
 */
import { prisma } from '@/lib/prisma';
import type { AiTool } from './_registry';

/**
 * Ids of candidates with a skill containing `search`, case-insensitively —
 * Prisma's scalar-list `has` filter is exact and case-sensitive, unlike the
 * `contains`/`insensitive` matching used for the other search fields.
 */
async function candidateIdsWithSkillLike(search: string): Promise<string[]> {
  const pattern = `%${search.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT c.id FROM candidates c
    WHERE EXISTS (SELECT 1 FROM unnest(c.skills) AS s WHERE s ILIKE ${pattern})`;
  return rows.map((r) => r.id);
}

const RECRUITMENT_ROLES = ['SUPER_ADMIN', 'ADMIN', 'RECRUITER', 'HR'];
const SUMMARY_ROLES = ['SUPER_ADMIN', 'ADMIN', 'RECRUITER', 'HR', 'MANAGER', 'VIEWER'];

const CANDIDATE_STATUSES = ['NEW', 'SCREENING', 'SHORTLISTED', 'INTERVIEW_SCHEDULED', 'INTERVIEWED', 'OFFERED', 'JOINED', 'REJECTED', 'ON_HOLD'];
const JOB_STATUSES = ['OPEN', 'CLOSED', 'ON_HOLD', 'FILLED'];

const MAX_ROWS = 100;

const tools: AiTool[] = [
  {
    name: 'searchCandidates',
    description: "Search the candidate database by status, nationality, or a free-text match on name/email/skills. Returns up to 100 matching candidates.",
    parameters: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: CANDIDATE_STATUSES, description: 'Filter by pipeline status' },
        nationality: { type: 'string', description: 'Filter by nationality' },
        search: { type: 'string', description: 'Free-text match on name, email, or skills' },
        limit: { type: 'integer', minimum: 1, maximum: MAX_ROWS, description: `Max rows to return (capped at ${MAX_ROWS})` },
      },
      additionalProperties: false,
    },
    allowedRoles: RECRUITMENT_ROLES,
    handler: async (args) => {
      const where: any = {};
      if (args.status) where.status = args.status;
      if (args.nationality) where.nationality = { contains: args.nationality, mode: 'insensitive' };
      if (args.search) {
        const skillIds = await candidateIdsWithSkillLike(String(args.search));
        where.OR = [
          { firstName: { contains: args.search, mode: 'insensitive' } },
          { lastName: { contains: args.search, mode: 'insensitive' } },
          { email: { contains: args.search, mode: 'insensitive' } },
          ...(skillIds.length ? [{ id: { in: skillIds } }] : []),
        ];
      }
      const take = Math.min(args.limit || MAX_ROWS, MAX_ROWS);
      const [rows, total] = await Promise.all([
        prisma.candidate.findMany({ where, take, orderBy: { createdAt: 'desc' } }),
        prisma.candidate.count({ where }),
      ]);
      const table = {
        columns: [
          { key: 'name', label: 'Name' }, { key: 'email', label: 'Email' }, { key: 'phone', label: 'Phone' },
          { key: 'nationality', label: 'Nationality' }, { key: 'status', label: 'Status' },
          { key: 'expectedSalary', label: 'Expected Salary' },
        ],
        rows: rows.map((c) => ({
          name: `${c.firstName} ${c.lastName}`, email: c.email, phone: c.phone,
          nationality: c.nationality || '—', status: c.status, expectedSalary: c.expectedSalary || '—',
        })),
      };
      const cappedNote = total > take ? ` (showing ${take} of ${total} — refine your question to narrow this down)` : '';
      return { summary: `Found ${total} candidate${total === 1 ? '' : 's'}${cappedNote}.`, table };
    },
  },
  {
    name: 'getCandidatePipelineSummary',
    description: 'Get a count of candidates grouped by their current recruitment pipeline status.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
    allowedRoles: SUMMARY_ROLES,
    handler: async () => {
      const groups = await prisma.candidate.groupBy({ by: ['status'], _count: { _all: true } });
      const total = groups.reduce((s, g) => s + g._count._all, 0);
      const table = {
        columns: [{ key: 'status', label: 'Status' }, { key: 'count', label: 'Count' }],
        rows: CANDIDATE_STATUSES.map((s) => ({ status: s, count: groups.find((g) => g.status === s)?._count._all || 0 })),
      };
      return { summary: `${total} candidates in the pipeline across ${groups.length} statuses.`, table };
    },
  },
  {
    name: 'searchJobs',
    description: 'Search open positions/job orders by status or a free-text match on title. Returns up to 100 matching jobs.',
    parameters: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: JOB_STATUSES, description: 'Filter by job status' },
        search: { type: 'string', description: 'Free-text match on job title' },
        limit: { type: 'integer', minimum: 1, maximum: MAX_ROWS },
      },
      additionalProperties: false,
    },
    allowedRoles: RECRUITMENT_ROLES,
    handler: async (args) => {
      const where: any = {};
      if (args.status) where.status = args.status;
      if (args.search) where.title = { contains: args.search, mode: 'insensitive' };
      const take = Math.min(args.limit || MAX_ROWS, MAX_ROWS);
      const [rows, total] = await Promise.all([
        prisma.job.findMany({ where, take, orderBy: { createdAt: 'desc' }, include: { client: { select: { companyName: true } } } }),
        prisma.job.count({ where }),
      ]);
      const table = {
        columns: [
          { key: 'title', label: 'Title' }, { key: 'client', label: 'Client' }, { key: 'status', label: 'Status' },
          { key: 'positions', label: 'Positions' }, { key: 'filled', label: 'Filled' }, { key: 'salary', label: 'Salary Range' },
        ],
        rows: rows.map((j) => ({
          title: j.title, client: j.client?.companyName || '—', status: j.status,
          positions: j.positionsCount, filled: j.filledCount,
          salary: j.salaryMin || j.salaryMax ? `${j.salaryMin ?? '—'}–${j.salaryMax ?? '—'} ${j.currency}` : '—',
        })),
      };
      const cappedNote = total > take ? ` (showing ${take} of ${total})` : '';
      return { summary: `Found ${total} job${total === 1 ? '' : 's'}${cappedNote}.`, table };
    },
  },
  {
    name: 'getJobFillRateReport',
    description: 'Get an aggregate fill-rate report across all job orders, grouped by status (positions vs. filled).',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
    allowedRoles: SUMMARY_ROLES,
    handler: async () => {
      const jobs = await prisma.job.findMany({ select: { status: true, positionsCount: true, filledCount: true } });
      const byStatus = JOB_STATUSES.map((status) => {
        const group = jobs.filter((j) => j.status === status);
        const positions = group.reduce((s, j) => s + j.positionsCount, 0);
        const filled = group.reduce((s, j) => s + j.filledCount, 0);
        return { status, jobs: group.length, positions, filled, fillRatePct: positions ? Math.round((filled / positions) * 1000) / 10 : 0 };
      });
      const totalPositions = jobs.reduce((s, j) => s + j.positionsCount, 0);
      const totalFilled = jobs.reduce((s, j) => s + j.filledCount, 0);
      const table = {
        columns: [
          { key: 'status', label: 'Status' }, { key: 'jobs', label: 'Jobs' }, { key: 'positions', label: 'Open Positions' },
          { key: 'filled', label: 'Filled' }, { key: 'fillRatePct', label: 'Fill Rate %' },
        ],
        rows: byStatus,
      };
      const overallRate = totalPositions ? Math.round((totalFilled / totalPositions) * 1000) / 10 : 0;
      return { summary: `${totalFilled} of ${totalPositions} positions filled overall (${overallRate}%).`, table };
    },
  },
  {
    name: 'getUpcomingInterviews',
    description: 'List upcoming scheduled interviews, optionally within a date range. Returns up to 100 rows.',
    parameters: {
      type: 'object',
      properties: {
        fromDate: { type: 'string', description: 'ISO date, defaults to now' },
        toDate: { type: 'string', description: 'ISO date, defaults to 30 days from fromDate' },
        limit: { type: 'integer', minimum: 1, maximum: MAX_ROWS },
      },
      additionalProperties: false,
    },
    allowedRoles: RECRUITMENT_ROLES,
    handler: async (args) => {
      const from = args.fromDate ? new Date(args.fromDate) : new Date();
      const to = args.toDate ? new Date(args.toDate) : new Date(from.getTime() + 30 * 24 * 60 * 60 * 1000);
      const take = Math.min(args.limit || MAX_ROWS, MAX_ROWS);
      const [rows, total] = await Promise.all([
        prisma.interview.findMany({
          where: { scheduledAt: { gte: from, lte: to } }, take, orderBy: { scheduledAt: 'asc' },
          include: { candidate: { select: { firstName: true, lastName: true } }, job: { select: { title: true } } },
        }),
        prisma.interview.count({ where: { scheduledAt: { gte: from, lte: to } } }),
      ]);
      const table = {
        columns: [
          { key: 'candidate', label: 'Candidate' }, { key: 'job', label: 'Job' }, { key: 'scheduledAt', label: 'Scheduled At' },
          { key: 'mode', label: 'Mode' }, { key: 'status', label: 'Status' },
        ],
        rows: rows.map((i) => ({
          candidate: `${i.candidate.firstName} ${i.candidate.lastName}`, job: i.job.title,
          scheduledAt: i.scheduledAt.toISOString(), mode: i.mode, status: i.status,
        })),
      };
      const cappedNote = total > take ? ` (showing ${take} of ${total})` : '';
      return { summary: `${total} interview${total === 1 ? '' : 's'} scheduled between ${from.toDateString()} and ${to.toDateString()}${cappedNote}.`, table };
    },
  },
  {
    name: 'getInterviewOutcomesReport',
    description: 'Get a count of interviews grouped by status, plus the average rating given.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
    allowedRoles: SUMMARY_ROLES,
    handler: async () => {
      const groups = await prisma.interview.groupBy({ by: ['status'], _count: { _all: true } });
      const ratingAgg = await prisma.interview.aggregate({ _avg: { rating: true }, where: { rating: { not: null } } });
      const total = groups.reduce((s, g) => s + g._count._all, 0);
      const table = {
        columns: [{ key: 'status', label: 'Status' }, { key: 'count', label: 'Count' }],
        rows: groups.map((g) => ({ status: g.status, count: g._count._all })),
      };
      const avgRating = ratingAgg._avg.rating != null ? Math.round(ratingAgg._avg.rating * 10) / 10 : null;
      return {
        summary: `${total} interviews recorded.${avgRating != null ? ` Average rating: ${avgRating}/5.` : ''}`,
        table,
      };
    },
  },
];

export default tools;
