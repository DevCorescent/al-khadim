// Serves uploaded files (replaces Express `app.use('/uploads', express.static(...))`).
import { readFile } from 'fs/promises';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { absoluteUploadPath } from '@/server/upload';

export const dynamic = 'force-dynamic';

const TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp',
  '.pdf': 'application/pdf', '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

export async function GET(_req: NextRequest, { params }: { params: { path: string[] } }) {
  try {
    const file = absoluteUploadPath(params.path.join('/'));
    const data = await readFile(file);
    // Files are reachable only by their random (uuid) name. Keep them out of search
    // engines and shared caches, and stop browsers from sniffing them as HTML.
    return new NextResponse(data, {
      headers: {
        'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
        'Cache-Control': 'private, max-age=3600',
        'X-Robots-Tag': 'noindex, nofollow',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Route not found' }, { status: 404 });
  }
}
