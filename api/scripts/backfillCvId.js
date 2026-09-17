/**
 * One-off: assign a cvId to any existing candidate that doesn't have one.
 * Run with:  node scripts/backfillCvId.js
 */
const { PrismaClient } = require('@prisma/client');
const { generateCvId } = require('../src/utils/cvId');

const prisma = new PrismaClient();

async function main() {
  const missing = await prisma.candidate.findMany({
    where: { cvId: null },
    select: { id: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });
  console.log(`Found ${missing.length} candidate(s) without a CV ID.`);

  for (const c of missing) {
    const cvId = await generateCvId(prisma);
    await prisma.candidate.update({ where: { id: c.id }, data: { cvId } });
    console.log(`  ${c.id} -> ${cvId}`);
  }
  console.log('Done.');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
