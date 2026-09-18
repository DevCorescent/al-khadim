/**
 * Request/response helpers shared by every controller. They mirror the Express
 * conventions the frontend was built against: JSON bodies, `{ error }` payloads
 * on failure, and query strings exposed as a plain object.
 */
import { NextRequest, NextResponse } from 'next/server';

export class HttpError extends Error {
  constructor(public status: number, message: string, public extra?: Record<string, unknown>) {
    super(message);
  }
}

export type RouteContext<P = Record<string, string>> = { params: P };
export type Controller<P = Record<string, string>> = (req: NextRequest, ctx: RouteContext<P>) => Promise<Response>;

export function json(data: unknown, status = 200, headers?: HeadersInit) {
  return NextResponse.json(data, { status, headers });
}

/** Wraps a controller so thrown HttpErrors become `{ error }` responses and anything else a 500. */
export function handler<P = Record<string, string>>(fn: Controller<P>): Controller<P> {
  return async (req, ctx) => {
    try {
      return await fn(req, ctx);
    } catch (err: any) {
      if (err instanceof HttpError) return json({ error: err.message, ...err.extra }, err.status);
      console.error(`[api] ${req.method} ${req.nextUrl.pathname}`, err);
      return json(
        {
          error: err?.message || 'Internal server error',
          ...(process.env.NODE_ENV === 'development' && { stack: err?.stack }),
        },
        500,
      );
    }
  };
}

/** Query string as an object, like Express `req.query` (repeated keys become arrays). */
export function query(req: NextRequest): Record<string, any> {
  const out: Record<string, any> = {};
  req.nextUrl.searchParams.forEach((value, key) => {
    const k = key.endsWith('[]') ? key.slice(0, -2) : key;
    if (k in out) out[k] = [].concat(out[k], value);
    else out[k] = key.endsWith('[]') ? [value] : value;
  });
  return out;
}

/**
 * Text fields of a form submission as an object. Like multer/body-parser, a
 * repeated key (or one ending in `[]`) becomes an array.
 */
export function formFields(form: FormData): Record<string, any> {
  const out: Record<string, any> = {};
  form.forEach((value, key) => {
    if (typeof value !== 'string') return;
    const k = key.endsWith('[]') ? key.slice(0, -2) : key;
    if (k in out) out[k] = [].concat(out[k], value);
    else out[k] = key.endsWith('[]') ? [value] : value;
  });
  return out;
}

/**
 * Request body like Express `req.body`: parsed JSON, or the text fields of a
 * form/multipart submission. Returns `{}` when there is no body.
 */
export async function body(req: NextRequest): Promise<any> {
  const type = req.headers.get('content-type') || '';
  if (type.includes('multipart/form-data') || type.includes('application/x-www-form-urlencoded')) {
    return formFields(await req.formData());
  }
  const text = await req.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, 'Invalid JSON body');
  }
}

/** Client IP for rate limiting and audit logs. */
export function clientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    req.headers.get('x-real-ip') ||
    req.ip ||
    'local'
  );
}
