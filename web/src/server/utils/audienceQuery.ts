// Ported from api/src/utils/audienceQuery.js
/**
 * Recipient segmentation layer for the email campaign manager. One resolver
 * per RecipientType, each translating a plain filter object into a Prisma
 * `where` clause and exposing count/preview/full-resolve + a static field
 * schema the frontend renders as a filter form.
 */
import { prisma } from '@/lib/prisma';
import { HttpError } from '../http';
import { pagination } from '../validate';

/** Safe skip/take for the preview helpers (defaults to 10 rows, at most 100). */
function pageOf({ page, limit }: PageOpts = {}) {
  return pagination({ page, limit }, { defaultLimit: 10, maxLimit: 100 });
}

export const MAX_CAMPAIGN_RECIPIENTS = Number(process.env.CAMPAIGN_MAX_RECIPIENTS) || 10000;

type Filters = Record<string, any>;
type Where = Record<string, any>;

export interface AudienceRecipient {
  id: string;
  name: string;
  email: string;
}

export interface AudienceFilterField {
  key: string;
  label: string;
  type: string;
  options?: string[];
  source?: string;
}

export interface AudienceResolver {
  buildWhere: (filters?: Filters) => Where;
  /**
   * The Prisma delegate for this recipient type. Typed loosely because the
   * five delegates share only the count/findMany calls used here.
   */
  model: () => any;
  nameOf: (r: any) => string;
  fields: AudienceFilterField[];
}

interface PageOpts {
  page?: number | string;
  limit?: number | string;
}

function searchOr(fields: string[], search: string) {
  return fields.map((f) => ({ [f]: { contains: search, mode: 'insensitive' } }));
}

function candidateWhere(filters: Filters = {}): Where {
  const where: Where = {};
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

function employeeWhere(filters: Filters = {}): Where {
  const where: Where = {};
  if (filters.status?.length) where.status = { in: filters.status };
  if (filters.department) where.department = { contains: filters.department, mode: 'insensitive' };
  if (filters.designation) where.designation = { contains: filters.designation, mode: 'insensitive' };
  if (filters.clientId?.length) where.clientId = { in: filters.clientId };
  if (filters.nationality) where.nationality = { contains: filters.nationality, mode: 'insensitive' };
  if (filters.search) where.OR = searchOr(['firstName', 'lastName', 'email', 'employeeId'], filters.search);
  return where;
}

function clientWhere(filters: Filters = {}): Where {
  const where: Where = {};
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

function clientUserWhere(filters: Filters = {}): Where {
  const where: Where = {};
  if (filters.role?.length) where.role = { in: filters.role };
  if (filters.isActive != null) where.isActive = !!filters.isActive;
  if (filters.clientId?.length) where.clientId = { in: filters.clientId };
  if (filters.accepted != null) where.acceptedAt = filters.accepted ? { not: null } : null;
  if (filters.search) where.OR = searchOr(['name', 'email'], filters.search);
  return where;
}

function userWhere(filters: Filters = {}): Where {
  const where: Where = {};
  if (filters.role?.length) where.role = { in: filters.role };
  if (filters.customRole) where.customRole = { contains: filters.customRole, mode: 'insensitive' };
  if (filters.department) where.department = { contains: filters.department, mode: 'insensitive' };
  if (filters.isActive != null) where.isActive = !!filters.isActive;
  if (filters.search) where.OR = searchOr(['name', 'email'], filters.search);
  return where;
}

export const RESOLVERS: Record<string, AudienceResolver> = {
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

function resolverFor(recipientType: string): AudienceResolver {
  const resolver = RESOLVERS[recipientType];
  if (!resolver) throw new Error(`Unknown recipient type "${recipientType}"`);
  return resolver;
}

export async function countAudience(recipientType: string, filters?: Filters): Promise<number> {
  const { buildWhere, model } = resolverFor(recipientType);
  return model().count({ where: buildWhere(filters) });
}

export async function previewAudience(recipientType: string, filters?: Filters, opts: PageOpts = {}): Promise<{ total: number; sample: AudienceRecipient[] }> {
  const { buildWhere, model, nameOf } = resolverFor(recipientType);
  const where = buildWhere(filters);
  const { skip, limit } = pageOf(opts);
  const [total, rows] = await Promise.all([
    model().count({ where }),
    model().findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
  ]);
  return { total, sample: rows.map((r: any) => ({ id: r.id, name: nameOf(r), email: r.email })) };
}

/** Full recipient list for an actual send/schedule fan-out. Capped for safety. */
export async function resolveAudienceForSend(recipientType: string, filters?: Filters): Promise<AudienceRecipient[]> {
  const { buildWhere, model, nameOf } = resolverFor(recipientType);
  const where = buildWhere(filters);
  const total = await model().count({ where });
  if (total > MAX_CAMPAIGN_RECIPIENTS) {
    throw new HttpError(400, `Audience of ${total} exceeds the ${MAX_CAMPAIGN_RECIPIENTS}-recipient campaign limit — narrow your filters.`);
  }
  const rows = await model().findMany({ where });
  return rows
    .filter((r: any) => !!r.email)
    .map((r: any) => ({ id: r.id, name: nameOf(r), email: r.email }));
}

export function filterMeta(recipientType: string): { recipientType: string; fields: AudienceFilterField[] } {
  const { fields } = resolverFor(recipientType);
  return { recipientType, fields };
}

/** Full member list of a saved group, from the snapshot fields (no cross-table joins). */
export async function resolveGroupAudience(groupId: string): Promise<AudienceRecipient[]> {
  const members = await prisma.emailGroupMember.findMany({ where: { groupId } });
  return members.map((m) => ({ id: m.recipientId, name: m.name, email: m.email }));
}

/** Live count + a page of a saved group's members, for the audience-preview UI. */
export async function previewGroupAudience(groupId: string, opts: PageOpts = {}): Promise<{ total: number; sample: AudienceRecipient[] }> {
  const { skip, limit } = pageOf(opts);
  const [total, rows] = await Promise.all([
    prisma.emailGroupMember.count({ where: { groupId } }),
    prisma.emailGroupMember.findMany({ where: { groupId }, skip, take: limit, orderBy: { addedAt: 'desc' } }),
  ]);
  return { total, sample: rows.map((m) => ({ id: m.recipientId, name: m.name, email: m.email })) };
}

/** Normalizes+paginates an already-resolved custom recipient list (no DB query needed). */
export function previewCustomAudience(customRecipients: any[] = [], opts: PageOpts = {}): { total: number; sample: any[] } {
  const list = Array.isArray(customRecipients) ? customRecipients : [];
  const { skip, limit } = pageOf(opts);
  return { total: list.length, sample: list.slice(skip, skip + limit) };
}

/**
 * Dispatches a live audience-preview across all three campaign targeting
 * modes, so the frontend can call one endpoint regardless of how the
 * campaign is being targeted.
 */
export async function previewCampaignAudience(
  { targetMode, recipientType, filters, groupId, customRecipients }: {
    targetMode?: string;
    recipientType?: string | null;
    filters?: Filters | null;
    groupId?: string | null;
    customRecipients?: any;
  },
  opts: PageOpts = {},
): Promise<{ total: number; sample: any[] }> {
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
export async function resolveCampaignAudience(campaign: {
  targetMode?: string;
  recipientType?: string | null;
  filters?: any;
  groupId?: string | null;
  customRecipients?: any;
}): Promise<AudienceRecipient[]> {
  if (campaign.targetMode === 'GROUP') {
    if (!campaign.groupId) return [];
    return resolveGroupAudience(campaign.groupId);
  }
  if (campaign.targetMode === 'CUSTOM') {
    const list: any[] = Array.isArray(campaign.customRecipients) ? campaign.customRecipients : [];
    return list.filter((r) => !!r?.email).map((r) => ({ id: r.recipientId || r.id, name: r.name, email: r.email }));
  }
  if (!campaign.recipientType) return [];
  return resolveAudienceForSend(campaign.recipientType, campaign.filters || {});
}
