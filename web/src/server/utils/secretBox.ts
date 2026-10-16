/**
 * Small authenticated-encryption helper (AES-256-GCM) for secrets the app must
 * store but later show back to their owner — e.g. interview login credentials.
 *
 * Key: CREDENTIALS_SECRET (recommended, any long random string). Falls back to
 * a key derived from JWT_SECRET so it works out of the box; set a dedicated
 * CREDENTIALS_SECRET in production and never change it afterwards (existing
 * values could no longer be decrypted).
 */
import crypto from 'crypto';

function key(): Buffer {
  const secret = process.env.CREDENTIALS_SECRET || process.env.JWT_SECRET;
  if (!secret) throw new Error('CREDENTIALS_SECRET (or JWT_SECRET) must be set to store credentials');
  return crypto.createHash('sha256').update(`al-khadim/credentials:${secret}`).digest();
}

/** "v1.<iv>.<tag>.<ciphertext>" (base64url parts). */
export function seal(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ['v1', iv.toString('base64url'), tag.toString('base64url'), enc.toString('base64url')].join('.');
}

export function open(sealed: string | null | undefined): string | null {
  if (!sealed) return null;
  const [v, iv, tag, data] = sealed.split('.');
  if (v !== 'v1' || !iv || !tag || data === undefined) return null;
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64url'));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}
