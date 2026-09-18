// Ported from api/src/utils/cvId.js
/**
 * Auto-generate a unique, human-readable CV ID for a candidate,
 * e.g. "AK-CV-2026-00042". Sequential (based on the current candidate
 * count) with collision-safe retries so concurrent creates can't clash.
 */
import type { Prisma, PrismaClient } from '@/generated/prisma/client';

const PREFIX = process.env.CV_ID_PREFIX || 'AK-CV';

/** Accepts the shared client or a transaction client (`tx`). */
export async function generateCvId(prisma: PrismaClient | Prisma.TransactionClient): Promise<string> {
  const year = new Date().getFullYear();
  const base = await prisma.candidate.count();
  for (let i = 1; i <= 10; i++) {
    const cvId = `${PREFIX}-${year}-${String(base + i).padStart(5, '0')}`;
    const clash = await prisma.candidate.findUnique({ where: { cvId } });
    if (!clash) return cvId;
  }
  // Fallback — practically-unique suffix if the sequential slots are all taken.
  return `${PREFIX}-${year}-${Date.now().toString().slice(-6)}`;
}
