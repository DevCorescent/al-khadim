/**
 * Seeds only what a fresh install cannot start without:
 *   1. one admin account to sign in with
 *   2. the email templates the app sends from code
 *
 * The templates are not optional. `getTemplateBySlug` throws when a slug is missing and
 * `sendOtp` awaits it, so without them the verification email fails and candidate and
 * company registration break outright.
 *
 * Everything else — clients, candidates, jobs, further staff — is created through the
 * admin UI, so a new environment starts empty rather than full of sample records.
 *
 * Idempotent: every write is an upsert keyed on a unique field, and existing rows are
 * never overwritten (so admin edits and changed passwords survive a re-run).
 *
 * Run with:  npx prisma db seed
 * Optional env:
 *   SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD   override the admin credentials
 *   SEED_REFERENCE_DATA=true                 also add the industry and category lists
 *   SEED_DEMO_DATA=true                      also add sample records and one login per
 *                                            role (for internal testing only — never
 *                                            for a customer environment)
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, UserRole } from '../src/generated/prisma/client';
import { EMAIL_TEMPLATES } from './seed-data/emailTemplates';
import { EMAIL_DESIGNS } from './seed-data/emailDesigns';
import { renderEmail } from '../src/lib/email/render';
import { DEFAULT_EMAIL_THEME } from '../src/lib/email/theme';
import { INVOICE_TEMPLATES } from './seed-data/invoiceTemplates';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

// A single admin account with full access (SUPER_ADMIN is required for AI settings,
// custom roles and deleting users). Further staff are created from /admin/users.
const STAFF = [
  {
    name: 'Admin',
    email: process.env.SEED_ADMIN_EMAIL || 'admin@alkhadim.ae',
    password: process.env.SEED_ADMIN_PASSWORD || 'Admin@123',
    role: UserRole.SUPER_ADMIN,
    phone: '+971500000000',
  },
];

// Industries with candidate tracking enabled. Their tracking sections are
// built by admins at /admin/settings/industries/[id]/template.
const TRACKING_INDUSTRIES = [
  { key: 'GENERAL', name: 'General', color: '#6366f1' },
  { key: 'CONSTRUCTION', name: 'Construction', color: '#f59e0b' },
  { key: 'OIL_GAS', name: 'Oil & Gas', color: '#0ea5e9' },
  { key: 'MEDICAL', name: 'Healthcare / Medical', color: '#ef4444' },
];

const PLAIN_INDUSTRIES = [
  { name: 'Technology', color: '#3b82f6' },
  { name: 'Finance', color: '#10b981' },
  { name: 'Aviation', color: '#8b5cf6' },
  { name: 'Retail', color: '#ec4899' },
  { name: 'Education', color: '#f97316' },
  { name: 'Hospitality', color: '#14b8a6' },
  { name: 'Legal', color: '#64748b' },
  { name: 'Automobile & Logistics', color: '#eab308' },
  { name: 'Manufacturing', color: '#78716c' },
  { name: 'Other', color: '#9ca3af' },
];

const CATEGORIES = [
  'Technology', 'Engineering', 'Finance', 'HR', 'Marketing',
  'Sales', 'Operations', 'Legal', 'Design', 'Other',
];

function slugify(name: string) {
  return name.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

async function seedStaff() {
  for (const s of STAFF) {
    const password = await bcrypt.hash(s.password, 12);
    await prisma.user.upsert({
      where: { email: s.email },
      update: {},
      create: { name: s.name, email: s.email, password, role: s.role, phone: s.phone, isActive: true },
    });
    console.log(`  ${s.role.padEnd(11)} ${s.email}`);
  }
}

async function seedTaxonomy() {
  const industries = [
    ...TRACKING_INDUSTRIES.map((t) => ({ ...t, hasTracking: true })),
    ...PLAIN_INDUSTRIES.map((p) => ({ ...p, key: slugify(p.name), hasTracking: false })),
  ];
  for (const [order, i] of industries.entries()) {
    await prisma.industry.upsert({
      where: { key: i.key },
      update: {},
      create: {
        key: i.key, name: i.name, color: i.color, order,
        hasTracking: i.hasTracking,
        ...(i.hasTracking && { trackingSections: [] }),
      },
    });
  }
  console.log(`  ${industries.length} industries`);

  for (const [order, name] of CATEGORIES.entries()) {
    await prisma.category.upsert({ where: { name }, update: {}, create: { name, order } });
  }
  console.log(`  ${CATEGORIES.length} categories`);
}

/** A seeded template plus its branded builder design (and the HTML rendered from it). */
function brandedTemplate(t: (typeof EMAIL_TEMPLATES)[number]) {
  const design = EMAIL_DESIGNS[t.slug];
  if (!design) return t;
  const html = renderEmail(design, DEFAULT_EMAIL_THEME, { assetBase: process.env.WEB_URL || 'http://localhost:3000', subject: t.subject });
  const tags = Array.isArray(t.mergeTags) ? [...(t.mergeTags as any[])] : [];
  if (html.includes('{{appUrl}}') && !tags.some(m => m.key === 'appUrl')) tags.push({ key: 'appUrl', label: 'Website address (automatic)', sample: 'https://alkhadim.ae' });
  return { ...t, html, design: design as any, mergeTags: tags };
}

async function seedEmailTemplates() {
  let upgraded = 0;
  for (const raw of EMAIL_TEMPLATES) {
    const t = brandedTemplate(raw);
    const existing = await prisma.emailTemplate.findUnique({ where: { slug: t.slug } });
    if (!existing) {
      await prisma.emailTemplate.create({ data: t });
    } else if (existing.version === 1 && !existing.updatedBy && !existing.design && t.design) {
      // An original, never-edited template: move it onto the branded design.
      await prisma.emailTemplate.update({ where: { slug: t.slug }, data: { html: t.html, design: t.design, mergeTags: t.mergeTags as any } });
      upgraded++;
    }
  }
  console.log(`  ${EMAIL_TEMPLATES.length} email templates${upgraded ? ` (${upgraded} upgraded to the branded design)` : ''}`);
}

async function seedDemoData() {
  const industryId = async (key: string) =>
    (await prisma.industry.findUnique({ where: { key } }))?.id;
  const categoryId = async (name: string) =>
    (await prisma.category.findUnique({ where: { name } }))?.id;

  const clients = [
    {
      id: 'client1', companyName: 'Emirates Group', contactPerson: 'Ahmed Al Mansouri',
      email: 'hr@emirates.ae', phone: '+97142151111', industry: 'Aviation',
      industryId: await industryId('AVIATION'), city: 'Dubai',
    },
    {
      id: 'client2', companyName: 'ADNOC Group', contactPerson: 'Sarah Al Hassan',
      email: 'hr@adnoc.ae', phone: '+97126080000', industry: 'Oil & Gas',
      industryId: await industryId('OIL_GAS'), city: 'Abu Dhabi',
    },
  ];
  for (const c of clients) {
    await prisma.client.upsert({ where: { id: c.id }, update: {}, create: { ...c, country: 'UAE' } });
  }

  const jobs = [
    {
      id: 'job1', title: 'Senior Software Engineer', clientId: 'client1',
      description: 'Full-stack development role', location: 'Dubai',
      salaryMin: 15000, salaryMax: 25000, positionsCount: 3, experience: '5+ years',
      categoryId: await categoryId('Technology'),
    },
    {
      id: 'job2', title: 'HR Manager', clientId: 'client2',
      description: 'Manage HR operations', location: 'Abu Dhabi',
      salaryMin: 12000, salaryMax: 18000, positionsCount: 1, experience: '7+ years',
      categoryId: await categoryId('HR'),
    },
    {
      id: 'job3', title: 'Civil Engineer', clientId: 'client1',
      description: 'Infrastructure projects', location: 'Dubai',
      salaryMin: 8000, salaryMax: 14000, positionsCount: 5, experience: '3+ years',
      categoryId: await categoryId('Engineering'),
    },
  ];
  for (const j of jobs) {
    await prisma.job.upsert({
      where: { id: j.id },
      update: {},
      create: { ...j, country: 'UAE', currency: 'AED', status: 'OPEN', publishedAt: new Date() },
    });
  }

  const candidates = [
    {
      firstName: 'Rajesh', lastName: 'Kumar', email: 'rajesh.kumar@example.com',
      phone: '+919876543210', nationality: 'Indian', currentLocation: 'India', experience: 6,
      skills: ['React', 'Node.js', 'PostgreSQL'], status: 'SHORTLISTED' as const, source: 'WEBSITE',
    },
    {
      firstName: 'Maria', lastName: 'Santos', email: 'maria.santos@example.com',
      phone: '+639171234567', nationality: 'Filipino', currentLocation: 'UAE', experience: 8,
      skills: ['HR Management', 'Recruitment', 'Payroll'], status: 'INTERVIEW_SCHEDULED' as const,
      source: 'REFERRAL',
    },
  ];
  const cvPrefix = `${process.env.CV_ID_PREFIX || 'AK-CV'}-${new Date().getFullYear()}`;
  for (const [i, c] of candidates.entries()) {
    const cvId = `${cvPrefix}-${String(i + 1).padStart(5, '0')}`;
    await prisma.candidate.upsert({ where: { email: c.email }, update: {}, create: { ...c, cvId } });
  }
  console.log(`  ${clients.length} clients, ${jobs.length} jobs, ${candidates.length} candidates`);
}

// Demo logins for manual testing: one staff user per role, a candidate-portal account
// and a company-portal account. Part of the demo data (skipped with SEED_DEMO_DATA=false).
// Each account has its own password (listed in docs/PANEL_TESTING_GUIDE.md).
const DEMO_STAFF: { role: UserRole; name: string; password: string }[] = [
  { role: UserRole.ADMIN, name: 'Demo Admin', password: 'Admin#Khadim26' },
  { role: UserRole.MANAGER, name: 'Demo Manager', password: 'Manager#Khadim26' },
  { role: UserRole.RECRUITER, name: 'Demo Recruiter', password: 'Recruiter#Khadim26' },
  { role: UserRole.HR, name: 'Demo HR', password: 'HrTeam#Khadim26' },
  { role: UserRole.ACCOUNTANT, name: 'Demo Accountant', password: 'Accounts#Khadim26' },
  { role: UserRole.VIEWER, name: 'Demo Viewer', password: 'Viewer#Khadim26' },
];
const DEMO_CANDIDATE_PASSWORD = 'Candidate#Khadim26';
const DEMO_COMPANY_PASSWORD = 'Company#Khadim26';

async function seedDemoAccounts() {
  for (const s of DEMO_STAFF) {
    const email = `${s.role.toLowerCase()}@demo.alkhadim.ae`;
    await prisma.user.upsert({
      where: { email },
      update: {},
      create: { name: s.name, email, password: await bcrypt.hash(s.password, 12), role: s.role, isActive: true },
    });
  }

  const candidate = await prisma.candidate.findUnique({ where: { email: 'rajesh.kumar@example.com' } });
  if (candidate) {
    await prisma.candidateAccount.upsert({
      where: { candidateId: candidate.id },
      update: {},
      create: { candidateId: candidate.id, password: await bcrypt.hash(DEMO_CANDIDATE_PASSWORD, 12), isActive: true },
    });
  }

  await prisma.clientUser.upsert({
    where: { email: 'company@demo.alkhadim.ae' },
    update: {},
    create: {
      clientId: 'client1', name: 'Emirates HR (demo)', email: 'company@demo.alkhadim.ae',
      password: await bcrypt.hash(DEMO_COMPANY_PASSWORD, 12), role: 'COMPANY_ADMIN', isActive: true, acceptedAt: new Date(),
    },
  });
  console.log(`  ${DEMO_STAFF.length} staff logins, 1 candidate login, 1 company login (see docs/PANEL_TESTING_GUIDE.md)`);
}

async function seedInvoiceTemplates() {
  // Created once by name and never overwritten; becomes the default only if none is set.
  const hasDefault = await prisma.invoiceTemplate.count({ where: { isDefault: true } });
  for (const t of INVOICE_TEMPLATES) {
    await prisma.invoiceTemplate.upsert({
      where: { name: t.name }, update: {},
      create: { ...t, isDefault: t.isDefault && !hasDefault, data: t.data as any },
    });
  }
  console.log(`  ${INVOICE_TEMPLATES.length} invoice template(s)`);
}

async function main() {
  console.log('Admin account:');
  await seedStaff();

  console.log('Email templates (required — the app sends these from code):');
  await seedEmailTemplates();

  console.log('Invoice templates:');
  await seedInvoiceTemplates();

  // Off by default: the industry and category lists are business configuration, set up
  // from Settings once the customer's own list is known.
  if (process.env.SEED_REFERENCE_DATA === 'true') {
    console.log('Reference data:');
    await seedTaxonomy();
  }

  // Off by default. Only for internal testing — never seed sample companies, candidates
  // or shared role logins into an environment a customer will use.
  if (process.env.SEED_DEMO_DATA === 'true') {
    console.log('Demo data:');
    await seedDemoData();
    await seedDemoAccounts();
  }

  console.log('\nSeeding completed. Sign in at /login and build the rest from the admin panel.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
