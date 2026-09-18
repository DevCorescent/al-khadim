// Ported from api/src/routes/enquiries.js
import { prisma } from '@/lib/prisma';
import { requirePermission } from '../permissions';
import { body, handler, json, query } from '../http';
import { pickFields } from '../validate';

/** Fields of the public enquiry form (src/app/enquiry/page.tsx). */
const PUBLIC_FIELDS = ['companyName', 'contactName', 'designation', 'email', 'phone', 'service', 'message'] as const;
/** Staff may also move the enquiry through its pipeline. */
const ADMIN_FIELDS = [...PUBLIC_FIELDS, 'status'] as const;
const STATUSES = ['NEW', 'IN_PROGRESS', 'CONVERTED', 'CLOSED'];
const REQUIRED = ['companyName', 'contactName', 'email', 'phone'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Picks the allowed keys, coerces them to trimmed strings ('' → null) and validates them. */
function enquiryData(raw: any, allowed: readonly string[], creating: boolean): { data?: any; error?: string } {
  const data: any = {};
  for (const [k, v] of Object.entries(pickFields(raw, allowed))) {
    const str = v === null ? '' : String(v).trim();
    data[k] = str === '' ? null : str;
  }
  for (const k of REQUIRED) {
    if ((creating || k in data) && !data[k]) return { error: 'Company name, contact name, email and phone are required' };
  }
  if (data.email && !EMAIL_RE.test(data.email)) return { error: 'Please enter a valid email address' };
  if ('status' in data && !STATUSES.includes(data.status)) return { error: `status must be one of ${STATUSES.join(', ')}` };
  return { data };
}

// Public endpoint for contact form
export const createPublic = handler(async (req) => {
  const { data, error } = enquiryData(await body(req), PUBLIC_FIELDS, true);
  if (error) return json({ error }, 400);
  try {
    const enquiry = await prisma.clientEnquiry.create({ data });
    return json({ message: 'Enquiry submitted successfully', id: enquiry.id }, 201);
  } catch (err: any) {
    return json({ error: err.message }, 400);
  }
});

export const list = handler(async (req) => {
  await requirePermission(req, 'enquiries', 'view');
  const { status } = query(req);
  const where: any = {};
  if (status) where.status = String(status);
  const enquiries = await prisma.clientEnquiry.findMany({
    where, orderBy: { createdAt: 'desc' },
    include: { client: { select: { id: true, companyName: true } } },
  });
  return json(enquiries);
});

export const update = handler<{ id: string }>(async (req, { params }) => {
  await requirePermission(req, 'enquiries', 'edit');
  const { data, error } = enquiryData(await body(req), ADMIN_FIELDS, false);
  if (error) return json({ error }, 400);
  const existing = await prisma.clientEnquiry.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!existing) return json({ error: 'Enquiry not found' }, 404);
  const enquiry = await prisma.clientEnquiry.update({ where: { id: params.id }, data });
  return json(enquiry);
});

/* Convert an enquiry into a Client (find-or-create by email) + a LEAD-stage Deal. */
export const convert = handler<{ id: string }>(async (req, { params }) => {
  const user = await requirePermission(req, 'enquiries', 'edit');
  await requirePermission(req, 'clients', 'create');
  try {
    const enquiry = await prisma.clientEnquiry.findUnique({ where: { id: params.id }, include: { deal: true } });
    if (!enquiry) return json({ error: 'Enquiry not found' }, 404);
    if (enquiry.deal) return json({ error: 'This enquiry has already been converted' }, 400);

    let clientId = enquiry.clientId;
    if (!clientId) {
      const existingClient = await prisma.client.findFirst({ where: { email: enquiry.email } });
      if (existingClient) {
        clientId = existingClient.id;
      } else {
        const newClient = await prisma.client.create({
          data: {
            companyName: enquiry.companyName,
            contactPerson: enquiry.contactName,
            email: enquiry.email,
            phone: enquiry.phone,
            source: 'Enquiry Form',
            status: 'APPROVED',
          },
        });
        clientId = newClient.id;
      }
      await prisma.clientEnquiry.update({ where: { id: enquiry.id }, data: { clientId } });
    }

    const deal = await prisma.deal.create({
      data: {
        title: `${enquiry.companyName} — ${enquiry.service || 'General Enquiry'}`,
        clientId,
        source: 'Enquiry Form',
        enquiryId: enquiry.id,
        stage: 'LEAD',
        probability: 10,
        ownerId: user.id,
        createdBy: user.id,
      },
    });
    await prisma.activity.create({
      data: { clientId, dealId: deal.id, type: 'SYSTEM', content: `Deal created from converted enquiry`, createdBy: user.id },
    });

    const updatedEnquiry = await prisma.clientEnquiry.update({ where: { id: enquiry.id }, data: { status: 'CONVERTED' } });
    const client = await prisma.client.findUnique({ where: { id: clientId } });

    return json({ client, deal, enquiry: updatedEnquiry });
  } catch (err: any) {
    return json({ error: err.message }, 400);
  }
});
