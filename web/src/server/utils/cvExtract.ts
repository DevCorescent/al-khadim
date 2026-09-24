/**
 * Single entry point for CV parsing: extract text once, run the deterministic
 * parser, then let the LLM (when enabled) improve on it.
 *
 * The regex parser is the floor, not the ceiling. The LLM is better at the
 * things heuristics get wrong — name vs section heading, spoken vs programming
 * languages, inferring a headline — while the regexes are better at the things
 * pattern matching is exactly right for, namely email, phone and URLs. So the
 * merge is per-field rather than "one wins":
 *
 *   email / phone / linkedIn / portfolio  regex preferred, LLM fills gaps
 *   everything else                        LLM preferred, regex fills gaps
 *
 * With CV_AI_PARSING unset this behaves exactly as before.
 */
import {
  NO_TEXT_MESSAGE,
  extractText,
  hasUsableText,
  parseCvFromText,
  type ParsedCV,
} from './cvParser';
import { isCvAiEnabled, parseCvWithLlm, type LlmParsedCV } from './cvLlm';
import { demonymForLocation } from '@/lib/formOptions';

/** How each field was resolved — logged, and surfaced for debugging. */
export interface CvParseMeta {
  /** 'regex' when the LLM was off or failed, 'llm+regex' when both contributed. */
  source: 'regex' | 'llm+regex';
  llmAttempted: boolean;
  llmUsed: boolean;
  fieldsFromLlm: string[];
}

export type ExtractedCV = ParsedCV & {
  _meta?: CvParseMeta;
  /**
   * A *suggested* nationality derived from the parsed location — never an
   * extracted one. Kept in its own field so nothing can mistake a guess for
   * something the CV actually said: the form pre-selects it and asks the person
   * to confirm, and it is not what gets saved unless they do.
   */
  nationalityGuess?: string;
  /** The location the guess came from, so the form can say where it got it. */
  nationalityGuessFrom?: string;
};

const isBlank = (v: unknown): boolean =>
  v === null || v === undefined || (typeof v === 'string' && v.trim() === '');

/**
 * Residence is not citizenship, so this only ever fills the separate
 * `nationalityGuess` field, and only when the CV stated no nationality at all.
 */
function withNationalityGuess(result: ExtractedCV): ExtractedCV {
  if (!isBlank(result.nationality) || isBlank(result.currentLocation)) return result;
  const guess = demonymForLocation(result.currentLocation);
  if (!guess) return result;
  return { ...result, nationalityGuess: guess, nationalityGuessFrom: result.currentLocation as string };
}

/**
 * Merges an LLM result over a regex result.
 *
 * `preferRegex` fields keep the deterministic value whenever it found one: a
 * regex match on an email or phone number is exact, whereas a model may
 * reformat or normalise it.
 */
export function mergeCvResults(regex: ParsedCV, llm: LlmParsedCV): { result: ParsedCV; fieldsFromLlm: string[] } {
  const used: string[] = [];
  const out: ParsedCV = { ...regex };

  const preferRegex = ['email', 'phone', 'linkedIn', 'portfolio'] as const;
  for (const key of preferRegex) {
    if (isBlank(regex[key]) && !isBlank(llm[key])) {
      (out as any)[key] = llm[key];
      used.push(key);
    }
  }

  const preferLlm = [
    'firstName', 'lastName', 'nationality', 'currentLocation',
    'headline', 'summary', 'education',
  ] as const;
  for (const key of preferLlm) {
    if (!isBlank(llm[key])) {
      if (llm[key] !== regex[key]) used.push(key);
      (out as any)[key] = llm[key];
    }
  }

  // Years of experience: 0 is meaningful (a fresher), so only null is "missing".
  if (llm.experience !== null) {
    if (llm.experience !== regex.experience) used.push('experience');
    out.experience = llm.experience;
  }

  // The model's lists are better curated (no section labels, no languages
  // leaking into skills), so they replace rather than merge — but never with
  // nothing, since an empty array would silently lose the regex findings.
  if (llm.skills.length) {
    out.skills = llm.skills;
    used.push('skills');
  }
  if (llm.languages.length) {
    out.languages = llm.languages;
    used.push('languages');
  } else {
    // An explicit empty list is a real answer ("this CV lists no spoken
    // languages"), but only trust it to clear a regex guess when the model
    // otherwise looks healthy — i.e. it found a name.
    if (!isBlank(llm.firstName) && regex.languages.length) {
      out.languages = [];
      used.push('languages');
    }
  }

  return { result: out, fieldsFromLlm: used };
}

/**
 * Parses a CV from an absolute upload path. Never throws for a bad CV: an
 * unreadable file comes back as `{ error }`, a text-less one as `{ _error }`,
 * exactly as `parseCV` did.
 */
export async function extractCv(filePath: string): Promise<ExtractedCV> {
  let raw: string | null;
  try {
    raw = await extractText(filePath);
  } catch (err: any) {
    return { error: `Could not read file: ${err.message}` } as ExtractedCV;
  }

  const regex = parseCvFromText(raw);

  // Nothing readable — the LLM has nothing to work with either.
  if (!hasUsableText(raw)) {
    return { ...regex, _error: regex._error || NO_TEXT_MESSAGE };
  }

  const llmAttempted = isCvAiEnabled();
  const llm = llmAttempted ? await parseCvWithLlm(raw as string) : null;

  if (!llm) {
    return withNationalityGuess({
      ...regex,
      _meta: { source: 'regex', llmAttempted, llmUsed: false, fieldsFromLlm: [] },
    });
  }

  const { result, fieldsFromLlm } = mergeCvResults(regex, llm);
  console.log('[cvExtract] llm improved fields:', fieldsFromLlm.join(', ') || '(none)');

  return withNationalityGuess({
    ...result,
    _meta: { source: 'llm+regex', llmAttempted, llmUsed: true, fieldsFromLlm },
  });
}
