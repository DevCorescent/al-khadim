/**
 * LLM-assisted CV field extraction.
 *
 * The deterministic parser in cvParser.ts is accurate on well-structured CVs
 * but brittle against layout variance — a developer CV that writes
 * "Languages: Java, JavaScript" inside Technical Skills, or banners its name in
 * ALL CAPS, defeats section and name heuristics that no amount of regex fully
 * fixes. This module sends the ALREADY-EXTRACTED text (never the file) to the
 * OpenAI client the project already configures in utils/aiClient.ts and asks
 * for the registration form's fields as strict JSON.
 *
 * It is a best-effort enhancement, never a dependency:
 *   - returns null when AI parsing is switched off, unconfigured, slow or broken
 *   - the caller (utils/cvExtract.ts) merges over the regex result, so a null
 *     simply means "regex only", which is the previous behaviour
 *
 * Privacy: enabling this sends candidate PII (name, contact details, employment
 * and education history) to OpenAI. It is therefore OFF unless
 * CV_AI_PARSING=true is set explicitly — having an API key for the chat
 * assistant is deliberately not enough to turn it on.
 */
import { getClient, providerBaseUrl } from './aiClient';

/** Models that support Structured Outputs (`response_format: json_schema`). */
const JSON_SCHEMA_MODELS = ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4.1-mini'];

/**
 * Latches once a provider has rejected a strict schema (Gemini's compatibility
 * layer does), so subsequent uploads go straight to `json_object` instead of
 * paying for a failed request first. Process-lifetime only, and reset by a
 * restart, which is when the provider could have changed anyway.
 */
let schemaUnsupported = false;

/**
 * Gemini's flash models return 503 "experiencing high demand" intermittently,
 * which would silently drop every affected upload back to the regex parser.
 * A short retry clears most of it; a lighter second model clears the rest,
 * since the smaller models are less contended.
 */
const RETRY_DELAY_MS = 700;
const FALLBACK_BY_PREFIX: Record<string, string> = { gemini: 'gemini-3.5-flash-lite' };

function fallbackModel(primary: string): string | null {
  if (process.env.CV_AI_FALLBACK_MODEL !== undefined) {
    return process.env.CV_AI_FALLBACK_MODEL.trim() || null;
  }
  for (const [prefix, model] of Object.entries(FALLBACK_BY_PREFIX)) {
    if (primary.startsWith(prefix) && primary !== model) return model;
  }
  return null;
}

/** Busy or rate-limited, rather than misconfigured — worth trying again. */
function isTransient(err: any): boolean {
  const status = err?.status ?? err?.response?.status;
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504
    || err?.code === 'ETIMEDOUT' || err?.name === 'APIConnectionTimeoutError';
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const FALLBACK_MODEL = 'gpt-4o-mini';

const DEFAULT_TIMEOUT_MS = 20_000;
/** CVs beyond this are truncated; 24k chars is ~6k tokens, far more than any real CV. */
const MAX_CHARS = 24_000;

export interface LlmParsedCV {
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  linkedIn: string | null;
  portfolio: string | null;
  nationality: string | null;
  currentLocation: string | null;
  experience: number | null;
  headline: string | null;
  summary: string | null;
  education: string | null;
  skills: string[];
  languages: string[];
}

/** Every field is nullable: the model is told to omit rather than invent. */
const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'firstName', 'lastName', 'email', 'phone', 'linkedIn', 'portfolio',
    'nationality', 'currentLocation', 'experience', 'headline', 'summary',
    'education', 'skills', 'languages',
  ],
  properties: {
    firstName: { type: ['string', 'null'], description: "Given name only, properly capitalised (e.g. 'Shalmon' from 'SHALMON GAIKWAD')." },
    lastName: { type: ['string', 'null'], description: 'Family name(s) only, properly capitalised.' },
    email: { type: ['string', 'null'] },
    phone: { type: ['string', 'null'], description: 'As written in the CV, including country code if present. Null if the CV has no phone number.' },
    linkedIn: { type: ['string', 'null'], description: 'Full LinkedIn profile URL.' },
    portfolio: { type: ['string', 'null'], description: 'Personal site, GitHub or portfolio URL. Not LinkedIn.' },
    nationality: { type: ['string', 'null'], description: "Nationality as a demonym (e.g. 'Indian'). Null unless the CV states it. Do NOT infer it from the city or from the language of the CV." },
    currentLocation: { type: ['string', 'null'], description: "Where the candidate currently lives, as 'City, Country' (e.g. 'Pune, India'). Add the country when the city makes it unambiguous." },
    experience: { type: ['integer', 'null'], description: 'Total years of professional work experience, rounded down. 0 for students or fresh graduates with no employment. Null if it cannot be judged. Do not count education years.' },
    headline: { type: ['string', 'null'], description: "One short professional title, max 80 chars (e.g. 'Backend Engineer — Java & Spring Boot'). Derive it from their profile if no explicit title exists." },
    summary: { type: ['string', 'null'], description: 'The professional summary/objective, verbatim if present, otherwise 1-2 sentences describing their profile.' },
    education: { type: ['string', 'null'], description: 'Qualifications as one readable string, newest first, e.g. "B.Tech Computer Science, XYZ University, 2024-28".' },
    skills: {
      type: 'array',
      description: 'Professional and technical skills only. Exclude spoken languages, section labels, and generic filler. Normalise names (e.g. "Apache Kafka" not "Apache"). Max 30.',
      items: { type: 'string' },
    },
    languages: {
      type: 'array',
      description: 'SPOKEN/human languages only (English, Arabic, Hindi…). A CV line such as "Languages: Java, JavaScript" refers to PROGRAMMING languages and must NOT appear here — put those in skills. Empty array if the CV lists no spoken languages.',
      items: { type: 'string' },
    },
  },
} as const;

const SYSTEM_PROMPT = [
  'You extract structured data from a candidate CV for a recruitment agency in the UAE.',
  'Return only what the CV supports. Never invent a value — use null (or an empty array) when the CV does not say.',
  'Pay particular attention to two common traps:',
  '1. A "Languages:" line inside a technical-skills block lists programming languages, not spoken languages.',
  '2. Section headings ("Technical Skills", "Professional Summary") are never the candidate\'s name.',
].join('\n');

/** Used only in json_object mode, where the provider never sees SCHEMA. */
const SHAPE_PROMPT = [
  'Reply with a single JSON object with exactly these keys:',
  '  firstName, lastName        strings or null, properly capitalised',
  '  email, phone               strings or null (phone as written, with country code if present)',
  '  linkedIn, portfolio        full URLs or null (portfolio = personal site/GitHub, never LinkedIn)',
  '  nationality                demonym such as "Indian", or null. Never infer it from a city.',
  '  currentLocation            "City, Country" or null',
  '  experience                 integer years of professional work, 0 for students, or null',
  '  headline                   one short professional title (max 80 chars) or null',
  '  summary, education         strings or null',
  '  skills                     array of strings, professional/technical only, max 30',
  '  languages                  array of SPOKEN languages only, max 15, [] if none listed',
  'Output JSON only — no prose, no markdown fences.',
].join('\n');

function pickModel(configured: string): string {
  if (process.env.CV_AI_MODEL) return process.env.CV_AI_MODEL;
  // Against a compatible provider (Gemini, Groq, OpenRouter…) the model names
  // are theirs, so never substitute an OpenAI one.
  if (providerBaseUrl()) return configured;
  return JSON_SCHEMA_MODELS.includes(configured) ? configured : FALLBACK_MODEL;
}

/** Whether LLM CV parsing is switched on (explicit opt-in — see the privacy note above). */
export function isCvAiEnabled(): boolean {
  return process.env.CV_AI_PARSING === 'true';
}

function timeoutMs(): number {
  const raw = Number(process.env.CV_AI_TIMEOUT_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_TIMEOUT_MS;
}

const str = (v: unknown): string | null => {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t ? t : null;
};

const strArray = (v: unknown, max: number): string[] => {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of v) {
    const s = str(item);
    if (!s || s.length > 60) continue;
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
    if (out.length >= max) break;
  }
  return out;
};

/**
 * Coerces the model's JSON into our shape. The response is untrusted input:
 * unknown keys are dropped, types are checked, arrays are capped.
 */
function normalise(raw: any): LlmParsedCV {
  const yearsRaw = raw?.experience;
  const years = typeof yearsRaw === 'number' && Number.isFinite(yearsRaw)
    ? Math.max(0, Math.min(60, Math.floor(yearsRaw)))
    : null;

  return {
    firstName: str(raw?.firstName),
    lastName: str(raw?.lastName),
    email: str(raw?.email)?.toLowerCase() ?? null,
    phone: str(raw?.phone),
    linkedIn: str(raw?.linkedIn),
    portfolio: str(raw?.portfolio),
    nationality: str(raw?.nationality),
    currentLocation: str(raw?.currentLocation),
    experience: years,
    headline: str(raw?.headline)?.slice(0, 120) ?? null,
    summary: str(raw?.summary)?.slice(0, 2000) ?? null,
    education: str(raw?.education)?.slice(0, 1000) ?? null,
    skills: strArray(raw?.skills, 30),
    languages: strArray(raw?.languages, 15),
  };
}

/**
 * Asks the model for the CV's fields. Returns null on any failure — the caller
 * then keeps the deterministic result.
 */
export async function parseCvWithLlm(text: string): Promise<LlmParsedCV | null> {
  if (!isCvAiEnabled()) return null;
  if (!text || text.replace(/\s/g, '').length < 30) return null;

  let ai;
  try {
    ai = await getClient();
  } catch (err: any) {
    console.warn('[cvLlm] could not resolve AI client:', err?.message);
    return null;
  }
  if (!ai.configured || !ai.client) {
    console.warn('[cvLlm] CV_AI_PARSING=true but no OpenAI key is configured — using regex only.');
    return null;
  }

  const model = pickModel(ai.model);
  const body = text.length > MAX_CHARS ? text.slice(0, MAX_CHARS) : text;

  // CV_AI_TIMEOUT_MS is the budget for the whole attempt chain, not per call —
  // otherwise a retry plus a fallback model could hold the upload for three
  // times the configured timeout.
  const deadline = Date.now() + timeoutMs();
  const remaining = () => deadline - Date.now();
  /** Below this there isn't time for another round trip to be worth it. */
  const MIN_ATTEMPT_MS = 3_000;

  const ask = (mode: 'json_schema' | 'json_object', useModel: string = model) =>
    ai.client!.chat.completions.create(
      {
        model: useModel,
        // Extraction, not creativity.
        temperature: 0,
        messages: [
          {
            role: 'system',
            // In json_object mode the model isn't handed the schema, so the
            // shape has to be spelled out in the prompt instead.
            content: mode === 'json_schema' ? SYSTEM_PROMPT : `${SYSTEM_PROMPT}\n\n${SHAPE_PROMPT}`,
          },
          { role: 'user', content: `CV text:\n\n${body}` },
        ],
        response_format:
          mode === 'json_schema'
            ? { type: 'json_schema', json_schema: { name: 'cv_fields', strict: true, schema: SCHEMA as any } }
            : { type: 'json_object' },
      },
      {
        timeout: Math.max(MIN_ATTEMPT_MS, remaining()),
        // The SDK retries 5xx twice by default with its own backoff, which
        // stacks under the retry layer below and blows the budget (measured:
        // 24.7s against a 20s setting). One HTTP call per attempt, retried
        // explicitly, keeps the whole chain inside `deadline`.
        maxRetries: 0,
      },
    );

  const started = Date.now();
  let res;
  let usedModel = model;
  let mode: 'json_schema' | 'json_object' = schemaUnsupported ? 'json_object' : 'json_schema';
  try {
    res = await ask(mode);
  } catch (err: any) {
    // Many OpenAI-compatible providers accept `json_object` but not strict
    // `json_schema`. Retry once in the simpler mode before giving up.
    if (mode === 'json_schema' && looksLikeUnsupportedSchema(err)) {
      console.warn('[cvLlm] provider rejected json_schema, retrying as json_object');
      // Remember it, so later uploads don't pay for the failed attempt again.
      schemaUnsupported = true;
      mode = 'json_object';
      try {
        res = await ask(mode);
      } catch (err2: any) {
        console.warn('[cvLlm] parse failed, falling back to regex:', err2?.message);
        return null;
      }
    } else if (isTransient(err) && remaining() > MIN_ATTEMPT_MS + RETRY_DELAY_MS) {
      // Busy, not broken. Same model once after a pause, then a lighter model,
      // then give up to the regex parser — all inside the one budget.
      console.warn(`[cvLlm] ${model} busy (${err?.status}), retrying`);
      await sleep(RETRY_DELAY_MS);
      try {
        res = await ask(mode);
      } catch (err2: any) {
        const alt = isTransient(err2) && remaining() > MIN_ATTEMPT_MS ? fallbackModel(model) : null;
        if (!alt) {
          console.warn('[cvLlm] parse failed, falling back to regex:', err2?.message);
          return null;
        }
        console.warn(`[cvLlm] still busy, trying ${alt}`);
        try {
          res = await ask(mode, alt);
          usedModel = alt;
        } catch (err3: any) {
          console.warn('[cvLlm] parse failed, falling back to regex:', err3?.message);
          return null;
        }
      }
    } else {
      // Bad key, bad model name — degrade to the regex parser rather than
      // failing the upload.
      console.warn('[cvLlm] parse failed, falling back to regex:', err?.message);
      return null;
    }
  }

  try {
    const content = res.choices?.[0]?.message?.content;
    if (!content) {
      console.warn('[cvLlm] empty completion');
      return null;
    }
    const parsed = normalise(JSON.parse(stripFence(content)));
    console.log(
      `[cvLlm] ${usedModel} (${mode}) parsed in ${Date.now() - started}ms`,
      { tokens: res.usage?.total_tokens, name: `${parsed.firstName ?? ''} ${parsed.lastName ?? ''}`.trim(), skills: parsed.skills.length, languages: parsed.languages.length },
    );
    return parsed;
  } catch (err: any) {
    console.warn('[cvLlm] could not read the model response, falling back to regex:', err?.message);
    return null;
  }
}

/**
 * A 4xx complaining about response_format / json_schema, rather than auth or
 * rate limits. Gemini's compatibility layer accepts `json_object` but rejects
 * parts of a strict schema (`additionalProperties`, nullable type unions) with
 * a "Unknown name" or "Invalid JSON payload" message, so those count too.
 */
function looksLikeUnsupportedSchema(err: any): boolean {
  const status = err?.status ?? err?.response?.status;
  if (status && status !== 400 && status !== 404 && status !== 422) return false;
  const msg = String(err?.message ?? '').toLowerCase();
  return /json_schema|response_format|structured output|schema|additionalproperties|invalid json payload|unknown name|not supported|unsupported/.test(msg);
}

/**
 * Some providers wrap JSON in a markdown fence even when asked not to, which
 * JSON.parse will not accept. Take the outermost object if one is there.
 */
export function stripFence(content: string): string {
  const trimmed = content.trim();
  if (trimmed.startsWith('{')) return trimmed;
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]?.trim().startsWith('{')) return fenced[1].trim();
  const first = trimmed.indexOf('{');
  const last = trimmed.lastIndexOf('}');
  return first !== -1 && last > first ? trimmed.slice(first, last + 1) : trimmed;
}
