// Copies every file in web/uploads/ to the Cloudflare R2 bucket, under the same
// key the app uses ("uploads/<folder>/<file>"), so existing database paths keep
// working. Safe to re-run: files already in the bucket are skipped.
//
//   node scripts/migrate-uploads-to-r2.mjs            copy
//   node scripts/migrate-uploads-to-r2.mjs --dry-run  only list what would be copied
//
// Local files are left in place; delete web/uploads/ yourself once the app is
// confirmed to be serving everything from R2.
import 'dotenv/config';
import { readdir, readFile, stat } from 'fs/promises';
import path from 'path';
import { HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = process.env;
const R2_BUCKET = process.env.R2_BUCKET || process.env.R2_BUCKET_NAME;
if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) {
  console.error('Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and R2_BUCKET in web/.env first.');
  process.exit(1);
}
const dryRun = process.argv.includes('--dry-run');

const TYPES = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp',
  '.pdf': 'application/pdf', '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
});

const root = path.join(process.cwd(), 'uploads');

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (entry.isFile() && !entry.name.startsWith('.')) yield full;
  }
}

async function exists(Key) {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key }));
    return true;
  } catch (err) {
    if (err?.$metadata?.httpStatusCode === 404 || err?.name === 'NotFound') return false;
    throw err;
  }
}

let copied = 0, skipped = 0, failed = 0, bytes = 0;
try {
  await stat(root);
} catch {
  console.log('No web/uploads folder: nothing to copy.');
  process.exit(0);
}

for await (const file of walk(root)) {
  const Key = `uploads/${path.relative(root, file).split(path.sep).join('/')}`;
  try {
    if (await exists(Key)) { skipped++; continue; }
    if (dryRun) { console.log('would copy', Key); copied++; continue; }
    const Body = await readFile(file);
    await s3.send(new PutObjectCommand({
      Bucket: R2_BUCKET, Key, Body,
      ContentType: TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
    }));
    copied++;
    bytes += Body.length;
    if (copied % 25 === 0) console.log(`  ${copied} copied…`);
  } catch (err) {
    failed++;
    console.error('FAILED', Key, err.message);
  }
}

console.log(`${dryRun ? 'Dry run: would copy' : 'Copied'} ${copied} file(s)${dryRun ? '' : ` (${(bytes / 1048576).toFixed(1)} MB)`}, `
  + `${skipped} already in R2, ${failed} failed.`);
process.exit(failed ? 1 : 0);
