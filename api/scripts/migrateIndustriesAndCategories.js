/**
 * One-off: seed the new dynamic Category/Industry tables, backfill
 * CandidateTracking.industryId from the old TrackingIndustry enum value,
 * and best-effort backfill Client.industryId from its free-text industry.
 * Run with:  node scripts/migrateIndustriesAndCategories.js
 */
const { PrismaClient } = require('@prisma/client');
const { INDUSTRY_TRACKING_TEMPLATES } = require('../src/constants/industryTracking');

const prisma = new PrismaClient();

function slugify(name) {
  return name.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

// Tracking-enabled industries: key MUST match the old TrackingIndustry enum values exactly.
const TRACKING_INDUSTRIES = [
  { key: 'GENERAL', name: 'General', color: '#6366f1' },
  { key: 'CONSTRUCTION', name: 'Construction', color: '#f59e0b' },
  { key: 'OIL_GAS', name: 'Oil & Gas', color: '#0ea5e9' },
  { key: 'MEDICAL', name: 'Healthcare / Medical', color: '#ef4444' },
];

// Deduplicated union of the old admin CRM + company-register hardcoded INDUSTRIES arrays,
// minus the 4 above (already covered with tracking).
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

async function main() {
  console.log('--- Seeding tracking-enabled industries ---');
  const industryByKey = {};
  for (let i = 0; i < TRACKING_INDUSTRIES.length; i++) {
    const t = TRACKING_INDUSTRIES[i];
    const sections = INDUSTRY_TRACKING_TEMPLATES[t.key]?.sections || [];
    const row = await prisma.industry.upsert({
      where: { key: t.key },
      update: {},
      create: {
        key: t.key, name: t.name, color: t.color, order: i,
        hasTracking: true, trackingSections: sections,
      },
    });
    industryByKey[t.key] = row;
    console.log(`  ${t.key} -> ${row.id} (${sections.length} sections)`);
  }

  console.log('--- Seeding plain (non-tracking) industries ---');
  for (let i = 0; i < PLAIN_INDUSTRIES.length; i++) {
    const p = PLAIN_INDUSTRIES[i];
    const key = slugify(p.name);
    const row = await prisma.industry.upsert({
      where: { key },
      update: {},
      create: { key, name: p.name, color: p.color, order: TRACKING_INDUSTRIES.length + i },
    });
    industryByKey[key] = row;
    console.log(`  ${key} -> ${row.id}`);
  }

  console.log('--- Seeding categories ---');
  for (let i = 0; i < CATEGORIES.length; i++) {
    const name = CATEGORIES[i];
    await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name, order: i },
    });
    console.log(`  ${name}`);
  }

  console.log('--- Backfilling CandidateTracking.industryId from the old enum ---');
  const trackingRows = await prisma.candidateTracking.findMany({ select: { id: true, industry: true, industryId: true } });
  let trackingUpdated = 0;
  for (const row of trackingRows) {
    if (row.industryId) continue;
    const industry = industryByKey[row.industry];
    if (!industry) {
      console.error(`  ! No Industry row found for old enum value "${row.industry}" on CandidateTracking ${row.id}`);
      continue;
    }
    await prisma.candidateTracking.update({ where: { id: row.id }, data: { industryId: industry.id } });
    trackingUpdated++;
  }
  console.log(`  Updated ${trackingUpdated}/${trackingRows.length} CandidateTracking rows.`);

  const stillNull = await prisma.candidateTracking.count({ where: { industryId: null } });
  console.log(`  Remaining rows with null industryId: ${stillNull}`);

  console.log('--- Best-effort backfilling Client.industryId from free-text industry ---');
  const allIndustries = await prisma.industry.findMany();
  const clients = await prisma.client.findMany({ where: { industry: { not: null }, industryId: null }, select: { id: true, industry: true } });
  let clientsMatched = 0;
  for (const c of clients) {
    const match = allIndustries.find((ind) => ind.name.toLowerCase() === String(c.industry).toLowerCase());
    if (match) {
      await prisma.client.update({ where: { id: c.id }, data: { industryId: match.id } });
      clientsMatched++;
    }
  }
  console.log(`  Matched ${clientsMatched}/${clients.length} clients by name.`);

  console.log('Done.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
