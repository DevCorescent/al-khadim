/**
 * Recipient segmentation layer for the email campaign manager. One resolver
 * per RecipientType, each translating a plain filter object into a Prisma
 * `where` clause and exposing count/preview/full-resolve + a static field
 * schema the frontend renders as a filter form.
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const MAX_CAMPAIGN_RECIPIENTS = Number(process.env.CAMPAIGN_MAX_RECIPIENTS) || 10000;

function searchOr(fields, search) {
  return fields.map((f) => ({ [f]: { contains: search, mode: 'insensitive' } }));
}

function candidateWhere(filters = {}) {
  const where = {};
  if (filters.status?.length) where.status = { in: filters.status };
  if (filters.nationality) where.nationality = { contains: filters.nationality, mode: 'insensitive' };
  if (filters.skills?.length) where.skills = { hasSome: filters.skills };
  if (filters.languages?.length) where.languages = { hasSome: filters.languages };
  if (filters.minExperience != null || filters.maxExperience != null) {
    where.experience = {};
    if (filters.minExperience != null) where.experience.gte = Number(filters.minExperience);
    if (filters.maxExperience != null) where.experience.lte = Number(filters.maxExperience);
  }
  if (filters.categoryId?.length) where.categoryId = { in: filters.categoryId };
  if (filters.industryId?.length) where.industryId = { in: filters.industryId };
  if (filters.isPublic != null) where.isPublic = !!filters.isPublic;
  if (filters.visaStatus) where.visaStatus = { contains: filters.visaStatus, mode: 'insensitive' };
  if (filters.source) where.source = { contains: filters.source, mode: 'insensitive' };
  if (filters.search) where.OR = searchOr(['firstName', 'lastName', 'email', 'cvId'], filters.search);
  return where;
}

function employeeWhere(filters = {}) {
  const where = {};
  if (filters.status?.length) where.status = { in: filters.status };
  if (filters.department) where.department = { contains: filters.department, mode: 'insensitive' };
  if (filters.designation) where.designation = { contains: filters.designation, mode: 'insensitive' };
  if (filters.clientId?.length) where.clientId = { in: filters.clientId };
  if (filters.nationality) where.nationality = { contains: filters.nationality, mode: 'insensitive' };
  if (filters.search) where.OR = searchOr(['firstName', 'lastName', 'email', 'employeeId'], filters.search);
  return where;
}

function clientWhere(filters = {}) {
  const where = {};
  if (filters.status?.length) where.status = { in: filters.status };
  if (filters.isActive != null) where.isActive = !!filters.isActive;
  if (filters.industryId?.length) where.industryId = { in: filters.industryId };
  if (filters.country) where.country = { contains: filters.country, mode: 'insensitive' };
  if (filters.city) where.city = { contains: filters.city, mode: 'insensitive' };
  if (filters.tags?.length) where.tags = { hasSome: filters.tags };
  if (filters.source) where.source = { contains: filters.source, mode: 'insensitive' };
  if (filters.search) where.OR = searchOr(['companyName', 'contactPerson', 'email'], filters.search);
  return where;
}

function clientUserWhere(filters = {}) {
  const where = {};
  if (filters.role?.length) where.role = { in: filters.role };
  if (filters.isActive != null) where.isActive = !!filters.isActive;
  if (filters.clientId?.length) where.clientId = { in: filters.clientId };
  if (filters.accepted != null) where.acceptedAt = filters.accepted ? { not: null } : null;
  if (filters.search) where.OR = searchOr(['name', 'email'], filters.search);
  return where;
}

function userWhere(filters = {}) {
  const where = {};
  if (filters.role?.length) where.role = { in: filters.role };
  if (filters.customRole) where.customRole = { contains: filters.customRole, mode: 'insensitive' };
  if (filters.department) where.department = { contains: filters.department, mode: 'insensitive' };
  if (filters.isActive != null) where.isActive = !!filters.isActive;
  if (filters.search) where.OR = searchOr(['name', 'email'], filters.search);
  return where;
}

const RESOLVERS = {
  CANDIDATES: {
    buildWhere: candidateWhere,
    model: () => prisma.candidate,
    nameOf: (r) => `${r.firstName} ${r.lastName}`.trim(),
    fields: [
      { key: 'status', label: 'Status', type: 'multiselect', options: ['NEW', 'SCREENING', 'SHORTLISTED', 'INTERVIEW_SCHEDULED', 'INTERVIEWED', 'OFFERED', 'JOINED', 'REJECTED', 'ON_HOLD'] },
      { key: 'nationality', label: 'Nationality', type: 'text' },
      { key: 'skills', label: 'Skills', type: 'tags' },
      { key: 'languages', label: 'Languages', type: 'tags' },
      { key: 'minExperience', label: 'Min. experience (yrs)', type: 'number' },
      { key: 'maxExperience', label: 'Max. experience (yrs)', type: 'number' },
      { key: 'categoryId', label: 'Category', type: 'multiselect-remote', source: '/categories' },
      { key: 'industryId', label: 'Industry', type: 'multiselect-remote', source: '/industries' },
      { key: 'isPublic', label: 'Public profile only', type: 'boolean' },
      { key: 'visaStatus', label: 'Visa status', type: 'text' },
      { key: 'search', label: 'Search name/email/CV ID', type: 'text' },
    ],
  },
  EMPLOYEES: {
    buildWhere: employeeWhere,
    model: () => prisma.employee,
    nameOf: (r) => `${r.firstName} ${r.lastName}`.trim(),
    fields: [
      { key: 'status', label: 'Status', type: 'multiselect', options: ['ACTIVE', 'INACTIVE', 'ON_LEAVE', 'TERMINATED', 'RESIGNED'] },
      { key: 'department', label: 'Department', type: 'text' },
      { key: 'designation', label: 'Designation', type: 'text' },
      { key: 'clientId', label: 'Outsourced to client', type: 'multiselect-remote', source: '/clients' },
      { key: 'nationality', label: 'Nationality', type: 'text' },
      { key: 'search', label: 'Search name/email/employee ID', type: 'text' },
    ],
  },
  CLIENTS: {
    buildWhere: clientWhere,
    model: () => prisma.client,
    nameOf: (r) => r.companyName,
    fields: [
      { key: 'status', label: 'Status', type: 'multiselect', options: ['PENDING', 'APPROVED', 'REJECTED'] },
      { key: 'isActive', label: 'Active only', type: 'boolean' },
      { key: 'industryId', label: 'Industry', type: 'multiselect-remote', source: '/industries' },
      { key: 'country', label: 'Country', type: 'text' },
      { key: 'city', label: 'City', type: 'text' },
      { key: 'tags', label: 'Tags', type: 'tags' },
      { key: 'source', label: 'Lead Source', type: 'text' },
      { key: 'search', label: 'Search company/contact/email', type: 'text' },
    ],
  },
  CLIENT_USERS: {
    buildWhere: clientUserWhere,
    model: () => prisma.clientUser,
    nameOf: (r) => r.name,
    fields: [
      { key: 'role', label: 'Role', type: 'multiselect', options: ['COMPANY_ADMIN', 'COMPANY_MEMBER'] },
      { key: 'isActive', label: 'Active only', type: 'boolean' },
      { key: 'clientId', label: 'Company', type: 'multiselect-remote', source: '/clients' },
      { key: 'accepted', label: 'Invite accepted', type: 'boolean' },
      { key: 'search', label: 'Search name/email', type: 'text' },
    ],
  },
  USERS: {
    buildWhere: userWhere,
    model: () => prisma.user,
    nameOf: (r) => r.name,
    fields: [
      { key: 'role', label: 'Role', type: 'multiselect', options: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'RECRUITER', 'HR', 'ACCOUNTANT', 'VIEWER'] },
      { key: 'customRole', label: 'Custom role', type: 'text' },
      { key: 'department', label: 'Department', type: 'text' },
      { key: 'isActive', label: 'Active only', type: 'boolean' },
      { key: 'search', label: 'Search name/email', type: 'text' },
    ],
  },
};

function resolverFor(recipientType) {
  const resolver = RESOLVERS[recipientType];
  if (!resolver) throw new Error(`Unknown recipient type "${recipientType}"`);
  return resolver;
}

async function countAudience(recipientType, filters) {
  const { buildWhere, model } = resolverFor(recipientType);
  return model().count({ where: buildWhere(filters) });
}

async function previewAudience(recipientType, filters, { page = 1, limit = 10 } = {}) {
  const { buildWhere, model, nameOf } = resolverFor(recipientType);
  const where = buildWhere(filters);
  const skip = (Number(page) - 1) * Number(limit);
  const [total, rows] = await Promise.all([
    model().count({ where }),
    model().findMany({ where, skip, take: Number(limit), orderBy: { createdAt: 'desc' } }),
  ]);
  return { total, sample: rows.map((r) => ({ id: r.id, name: nameOf(r), email: r.email })) };
}

/** Full recipient list for an actual send/schedule fan-out. Capped for safety. */
async function resolveAudienceForSend(recipientType, filters) {
  const { buildWhere, model, nameOf } = resolverFor(recipientType);
  const where = buildWhere(filters);
  const total = await model().count({ where });
  if (total > MAX_CAMPAIGN_RECIPIENTS) {
    const err = new Error(`Audience of ${total} exceeds the ${MAX_CAMPAIGN_RECIPIENTS}-recipient campaign limit — narrow your filters.`);
    err.status = 400;
    throw err;
  }
  const rows = await model().findMany({ where });
  return rows
    .filter((r) => !!r.email)
    .map((r) => ({ id: r.id, name: nameOf(r), email: r.email }));
}

function filterMeta(recipientType) {
  const { fields } = resolverFor(recipientType);
  return { recipientType, fields };
}

/** Full member list of a saved group, from the snapshot fields (no cross-table joins). */
async function resolveGroupAudience(groupId) {
  const members = await prisma.emailGroupMember.findMany({ where: { groupId } });
  return members.map((m) => ({ id: m.recipientId, name: m.name, email: m.email }));
}

/** Live count + a page of a saved group's members, for the audience-preview UI. */
async function previewGroupAudience(groupId, { page = 1, limit = 10 } = {}) {
  const skip = (Number(page) - 1) * Number(limit);
  const [total, rows] = await Promise.all([
    prisma.emailGroupMember.count({ where: { groupId } }),
    prisma.emailGroupMember.findMany({ where: { groupId }, skip, take: Number(limit), orderBy: { addedAt: 'desc' } }),
  ]);
  return { total, sample: rows.map((m) => ({ id: m.recipientId, name: m.name, email: m.email })) };
}

/** Normalizes+paginates an already-resolved custom recipient list (no DB query needed). */
function previewCustomAudience(customRecipients = [], { page = 1, limit = 10 } = {}) {
  const list = Array.isArray(customRecipients) ? customRecipients : [];
  const start = (Number(page) - 1) * Number(limit);
  return { total: list.length, sample: list.slice(start, start + Number(limit)) };
}

/**
 * Dispatches a live audience-preview across all three campaign targeting
 * modes, so the frontend can call one endpoint regardless of how the
 * campaign is being targeted.
 */
async function previewCampaignAudience({ targetMode, recipientType, filters, groupId, customRecipients }, opts = {}) {
  if (targetMode === 'GROUP') {
    if (!groupId) return { total: 0, sample: [] };
    return previewGroupAudience(groupId, opts);
  }
  if (targetMode === 'CUSTOM') {
    return previewCustomAudience(customRecipients, opts);
  }
  if (!recipientType) return { total: 0, sample: [] };
  return previewAudience(recipientType, filters || {}, opts);
}

/**
 * Dispatches the FULL recipient list to actually fan out a send/schedule,
 * across all three campaign targeting modes.
 */
async function resolveCampaignAudience(campaign) {
  if (campaign.targetMode === 'GROUP') {
    if (!campaign.groupId) return [];
    return resolveGroupAudience(campaign.groupId);
  }
  if (campaign.targetMode === 'CUSTOM') {
    const list = Array.isArray(campaign.customRecipients) ? campaign.customRecipients : [];
    return list.filter((r) => !!r?.email).map((r) => ({ id: r.recipientId || r.id, name: r.name, email: r.email }));
  }
  if (!campaign.recipientType) return [];
  return resolveAudienceForSend(campaign.recipientType, campaign.filters || {});
}

module.exports = {
  RESOLVERS,
  MAX_CAMPAIGN_RECIPIENTS,
  countAudience,
  previewAudience,
  resolveAudienceForSend,
  filterMeta,
  resolveGroupAudience,
  previewGroupAudience,
  previewCustomAudience,
  previewCampaignAudience,
  resolveCampaignAudience,
};
