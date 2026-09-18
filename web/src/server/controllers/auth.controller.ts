// Ported from api/src/routes/auth.js
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';
import { requireStaff } from '../auth';
import { body, clientIp, handler, json } from '../http';
import { rateLimit } from '../rateLimit';
import { effectivePermissions } from '../permissions';

/* ── express-validator stand-ins (also used by users.controller) ──
 * Mirror validator.js defaults for isEmail / isLength / normalizeEmail and
 * express-validator v7's error objects, so `{ errors: [...] }` responses keep
 * their original shape. */

export type FieldError = { type: 'field'; value: any; msg: string; path: string; location: 'body' };

export function fieldError(b: any, path: string, msg = 'Invalid value'): FieldError {
  return { type: 'field', value: b?.[path], msg, path, location: 'body' };
}

/** express-validator's toString: null/undefined → '' */
export function str(v: any): string {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

/** validator.js isLength counting (surrogate pairs / variation selectors count once). */
export function charLength(s: string) {
  const presentation = s.match(/(️|︎)/g) || [];
  const surrogates = s.match(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g) || [];
  return s.length - presentation.length - surrogates.length;
}

function byteLength(s: string) {
  return encodeURI(s).split(/%..|./).length - 1;
}

function isFQDN(s: string) {
  const parts = s.split('.');
  const tld = parts[parts.length - 1];
  if (parts.length < 2) return false;
  if (!/^([a-z¡-¨ª-퟿豈-﷏ﷰ-￯]{2,}|xn[a-z0-9-]{2,})$/i.test(tld)) return false;
  if (/\s/.test(tld)) return false;
  return parts.every((part) => {
    if (part.length > 63) return false;
    if (!/^[a-z_¡-￿0-9-]+$/i.test(part)) return false;
    if (/[！-～]/.test(part)) return false;
    if (/^-|-$/.test(part)) return false;
    if (/_/.test(part)) return false;
    return true;
  });
}

const emailUserUtf8Part = /^[a-z\d!#\$%&'\*\+\-\/=\?\^_`{\|}~¡-퟿豈-﷏ﷰ-￯]+$/i;
const quotedEmailUserUtf8 =
  /^([\s\x01-\x08\x0b\x0c\x0e-\x1f\x7f\x21\x23-\x5b\x5d-\x7e¡-퟿豈-﷏ﷰ-￯]|(\\[\x01-\x09\x0b\x0c\x0d-\x7f¡-퟿豈-﷏ﷰ-￯]))*$/i;

export function isEmail(s: string): boolean {
  if (s.length > 254) return false;
  const parts = s.split('@');
  const domain = parts.pop()!;
  let user = parts.join('@');
  if (byteLength(user) > 64 || byteLength(domain) > 254) return false;
  if (!isFQDN(domain)) return false;
  if (user[0] === '"') {
    user = user.slice(1, user.length - 1);
    return quotedEmailUserUtf8.test(user);
  }
  return user.split('.').every((p) => emailUserUtf8Part.test(p));
}

const ICLOUD = ['icloud.com', 'me.com'];
const OUTLOOK = [
  'hotmail.at', 'hotmail.be', 'hotmail.ca', 'hotmail.cl', 'hotmail.co.il', 'hotmail.co.nz', 'hotmail.co.th',
  'hotmail.co.uk', 'hotmail.com', 'hotmail.com.ar', 'hotmail.com.au', 'hotmail.com.br', 'hotmail.com.gr',
  'hotmail.com.mx', 'hotmail.com.pe', 'hotmail.com.tr', 'hotmail.com.vn', 'hotmail.cz', 'hotmail.de',
  'hotmail.dk', 'hotmail.es', 'hotmail.fr', 'hotmail.hu', 'hotmail.id', 'hotmail.ie', 'hotmail.in',
  'hotmail.it', 'hotmail.jp', 'hotmail.kr', 'hotmail.lv', 'hotmail.my', 'hotmail.ph', 'hotmail.pt',
  'hotmail.sa', 'hotmail.sg', 'hotmail.sk', 'live.be', 'live.co.uk', 'live.com', 'live.com.ar',
  'live.com.mx', 'live.de', 'live.es', 'live.eu', 'live.fr', 'live.it', 'live.nl', 'msn.com',
  'outlook.at', 'outlook.be', 'outlook.cl', 'outlook.co.il', 'outlook.co.nz', 'outlook.co.th',
  'outlook.com', 'outlook.com.ar', 'outlook.com.au', 'outlook.com.br', 'outlook.com.gr', 'outlook.com.pe',
  'outlook.com.tr', 'outlook.com.vn', 'outlook.cz', 'outlook.de', 'outlook.dk', 'outlook.es', 'outlook.fr',
  'outlook.hu', 'outlook.id', 'outlook.ie', 'outlook.in', 'outlook.it', 'outlook.jp', 'outlook.kr',
  'outlook.lv', 'outlook.my', 'outlook.ph', 'outlook.pt', 'outlook.sa', 'outlook.sg', 'outlook.sk',
  'passport.com',
];
const YAHOO = ['rocketmail.com', 'yahoo.ca', 'yahoo.co.uk', 'yahoo.com', 'yahoo.de', 'yahoo.fr', 'yahoo.in', 'yahoo.it', 'ymail.com'];
const YANDEX = ['yandex.ru', 'yandex.ua', 'yandex.kz', 'yandex.com', 'yandex.by', 'ya.ru'];

/**
 * validator.js normalizeEmail with default options: lowercases, and for gmail strips
 * dots and +tags (so "John.Doe+x@gmail.com" → "johndoe@gmail.com"). Returns false
 * when nothing is left of the local part, as validator does.
 */
export function normalizeEmail(email: string): any {
  const raw = email.split('@');
  const domain = raw.pop()!;
  const parts = [raw.join('@'), domain.toLowerCase()];
  if (parts[1] === 'gmail.com' || parts[1] === 'googlemail.com') {
    parts[0] = parts[0].split('+')[0];
    parts[0] = parts[0].replace(/\.+/g, (m) => (m.length > 1 ? m : ''));
    if (!parts[0].length) return false;
    parts[0] = parts[0].toLowerCase();
    parts[1] = 'gmail.com';
  } else if (ICLOUD.includes(parts[1]) || OUTLOOK.includes(parts[1])) {
    parts[0] = parts[0].split('+')[0];
    if (!parts[0].length) return false;
    parts[0] = parts[0].toLowerCase();
  } else if (YAHOO.includes(parts[1])) {
    const c = parts[0].split('-');
    parts[0] = c.length > 1 ? c.slice(0, -1).join('-') : c[0];
    if (!parts[0].length) return false;
    parts[0] = parts[0].toLowerCase();
  } else if (YANDEX.includes(parts[1])) {
    parts[0] = parts[0].toLowerCase();
    parts[1] = 'yandex.ru';
  } else {
    parts[0] = parts[0].toLowerCase();
  }
  return parts.join('@');
}

/* ── Routes ── */

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many login attempts, please try again later.',
});

const generateTokens = (user: { id: string; email: string; role: string }) => {
  const access = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET!,
    { expiresIn: '15m' },
  );
  const refresh = jwt.sign({ id: user.id }, process.env.JWT_REFRESH_SECRET!, { expiresIn: '7d' });
  return { access, refresh };
};

export const login = handler(async (req) => {
  authLimiter(req);
  const b = await body(req);
  const errors: FieldError[] = [];
  if (!isEmail(str(b.email))) errors.push(fieldError(b, 'email'));
  const email = normalizeEmail(str(b.email));
  if (!str(b.password)) errors.push(fieldError(b, 'password'));
  if (errors.length) return json({ errors }, 400);

  const { password } = b;
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) {
      return json({ error: 'Invalid credentials' }, 401);
    }

    const valid = await bcrypt.compare(String(password), user.password);
    if (!valid) return json({ error: 'Invalid credentials' }, 401);

    const { access, refresh } = generateTokens(user);
    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: refresh, lastLogin: new Date() },
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'LOGIN',
        module: 'AUTH',
        ipAddress: clientIp(req),
        userAgent: req.headers.get('user-agent') ?? undefined,
      },
    });

    return json({
      accessToken: access,
      refreshToken: refresh,
      user: {
        id: user.id, name: user.name, email: user.email, role: user.role, avatar: user.avatar,
        customRole: user.customRole, permissions: await effectivePermissions(user),
      },
    });
  } catch (err) {
    console.error(err);
    return json({ error: 'Server error' }, 500);
  }
});

export const refresh = handler(async (req) => {
  const { refreshToken } = await body(req);
  if (!refreshToken) return json({ error: 'Refresh token required' }, 401);

  try {
    const decoded: any = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!);
    const user = await prisma.user.findUnique({ where: { id: decoded.id } });

    if (!user || user.refreshToken !== refreshToken || !user.isActive) {
      return json({ error: 'Invalid refresh token' }, 401);
    }

    const { access, refresh } = generateTokens(user);
    await prisma.user.update({ where: { id: user.id }, data: { refreshToken: refresh } });

    return json({ accessToken: access, refreshToken: refresh });
  } catch {
    return json({ error: 'Invalid refresh token' }, 401);
  }
});

export const logout = handler(async (req) => {
  const staff = await requireStaff(req);
  await prisma.user.update({
    where: { id: staff.id },
    data: { refreshToken: null },
  });
  return json({ message: 'Logged out successfully' });
});

export const me = handler(async (req) => {
  const staff = await requireStaff(req);
  const user = await prisma.user.findUnique({
    where: { id: staff.id },
    select: { id: true, name: true, email: true, role: true, phone: true, avatar: true, lastLogin: true, customRole: true },
  });
  return json({ ...user, permissions: await effectivePermissions(staff) });
});

export const changePassword = handler(async (req) => {
  const staff = await requireStaff(req);
  const b = await body(req);
  const errors: FieldError[] = [];
  if (!str(b.currentPassword)) errors.push(fieldError(b, 'currentPassword'));
  if (charLength(str(b.newPassword)) < 8) errors.push(fieldError(b, 'newPassword'));
  if (errors.length) return json({ errors }, 400);

  const { currentPassword, newPassword } = b;
  try {
    const user = await prisma.user.findUnique({ where: { id: staff.id } });
    const valid = await bcrypt.compare(String(currentPassword), user.password);
    if (!valid) return json({ error: 'Current password is incorrect' }, 400);

    const hashed = await bcrypt.hash(String(newPassword), 12);
    // Revoke the refresh token so other sessions must log in again with the new password.
    await prisma.user.update({ where: { id: staff.id }, data: { password: hashed, refreshToken: null } });

    return json({ message: 'Password changed successfully' });
  } catch {
    return json({ error: 'Server error' }, 500);
  }
});
