// Ported from api/src/utils/cvParser.js
/**
 * CV / Resume Parser
 * PDF: pdftotext (poppler, system binary) → pdf-parse fallback
 * DOCX: mammoth
 * Strategy: extract raw text → clean → identify sections → run extractors.
 *
 * `parseCV(filePath)` takes an ABSOLUTE disk path — callers pass
 * `absoluteUploadPath(storedPath)` from '@/server/upload'.
 */
// Import the library entry, not the package index: pdf-parse v1's index.js
// runs a debug self-test (reading a bundled sample PDF) when it isn't the
// main module, which is always the case under Next's bundler.
import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import mammoth from 'mammoth';
import fs from 'fs';
import path from 'path';
import { execFile, execFileSync } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export interface ParsedCV {
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  linkedIn: string | null;
  portfolio: string | null;
  nationality: string | null;
  currentLocation: string | null;
  experience: number | null;
  headline: string | null;
  skills: string[];
  languages: string[];
  education: string | null;
  summary: string | null;
  /** Debug info (not sent to client but logged) */
  _debug?: { textLength: number; sectionsFound: string[]; linesCount: number };
  /** Set when no readable text could be extracted (all other fields are empty). */
  _error?: string;
  /** Set (and NOTHING else) when the file could not be read at all. */
  error?: string;
}

/* ─── 1. Text extraction ──────────────────────────────────────── */

// Try to locate pdftotext binary
function findPdfToText(): string | null {
  const candidates = ['/opt/homebrew/bin/pdftotext', '/usr/local/bin/pdftotext', '/usr/bin/pdftotext'];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  try {
    const lookup = process.platform === 'win32' ? 'where' : 'which';
    const r = execFileSync(lookup, ['pdftotext'], { encoding: 'utf8' }).trim().split(/\r?\n/)[0];
    if (r) return r;
  } catch {}
  return null;
}

// Resolved lazily (once) rather than at import time, so merely importing this
// module (e.g. while Next collects route data at build time) spawns nothing.
let _pdfToTextBin: string | null | undefined;
function pdfToTextBin(): string | null {
  if (_pdfToTextBin === undefined) _pdfToTextBin = findPdfToText();
  return _pdfToTextBin;
}

async function extractTextFromPDF(filePath: string): Promise<string | null> {
  // Strategy 1: pdftotext (poppler) — handles most real-world PDFs
  const bin = pdfToTextBin();
  if (bin) {
    try {
      const { stdout } = await execFileAsync(bin, ['-layout', '-enc', 'UTF-8', filePath, '-'], {
        timeout: 15000,
        maxBuffer: 10 * 1024 * 1024,
      });
      if (stdout && stdout.replace(/\s/g, '').length > 20) {
        console.log('[cvParser] pdftotext extracted', stdout.length, 'chars');
        return stdout;
      }
    } catch (e: any) {
      console.warn('[cvParser] pdftotext failed:', e.message);
    }
  }

  // Strategy 2: pdf-parse v1 fallback
  try {
    const buffer = fs.readFileSync(filePath);
    const data = await pdfParse(buffer);
    if (data.text && data.text.replace(/\s/g, '').length > 20) {
      console.log('[cvParser] pdf-parse extracted', data.text.length, 'chars');
      return data.text;
    }
  } catch (e: any) {
    console.warn('[cvParser] pdf-parse failed:', e.message);
  }

  return null;
}

export async function extractText(filePath: string): Promise<string | null> {
  if (!fs.existsSync(filePath)) throw new Error(`File not found: ${filePath}`);
  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.pdf') {
    return await extractTextFromPDF(filePath);
  }

  const buffer = fs.readFileSync(filePath);

  if (ext === '.docx' || ext === '.doc') {
    try {
      const result = await mammoth.extractRawText({ buffer });
      if (result.value && result.value.replace(/\s/g, '').length > 20) {
        console.log('[cvParser] mammoth extracted', result.value.length, 'chars');
        return result.value;
      }
    } catch (e: any) {
      console.warn('[cvParser] mammoth failed:', e.message);
    }
    return null;
  }

  // Plain text fallback
  try { return buffer.toString('utf8'); } catch { return null; }
}

/* ─── 2. Text normalisation ───────────────────────────────────── */

function cleanText(raw: string): string {
  return raw
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    // Replace multiple spaces (but not newlines) with a single space
    .replace(/[ \t]+/g, ' ')
    // Collapse 3+ blank lines to 2
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/* ─── 3. Contact info ─────────────────────────────────────────── */

function extractEmail(text: string): string | null {
  const m = text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
  return m ? m[0].toLowerCase().trim() : null;
}

function extractPhone(text: string): string | null {
  // Try most specific patterns first (UAE, India, Pakistan, international)
  const patterns = [
    /(?:\+971|00971)[\s\-.]?\d{2}[\s\-.]?\d{3}[\s\-.]?\d{4}/,
    /(?:\+91|0091|91)[\s\-.]?\d{5}[\s\-.]?\d{5}/,
    /(?:\+92|0092|92)[\s\-.]?\d{3}[\s\-.]?\d{7}/,
    /(?:\+63|0063|63)[\s\-.]?\d{3}[\s\-.]?\d{7}/,
    // Generic international
    /\+\d{1,3}[\s\-.]?\(?\d{2,4}\)?[\s\-.]?\d{3,4}[\s\-.]?\d{4}/,
    // 10-digit local
    /\b(?:\d{3}[\s\-.]?\d{3}[\s\-.]?\d{4}|\d{5}[\s\-.]?\d{5})\b/,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) {
      const phone = m[0].replace(/[\s\-.()]/g, '').replace(/^00/, '+');
      if (phone.replace(/\D/g, '').length >= 7) return m[0].trim();
    }
  }
  return null;
}

function extractLinkedIn(text: string): string | null {
  const m = text.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/([a-zA-Z0-9\-_%]+)/i);
  return m ? `https://linkedin.com/in/${m[1]}` : null;
}

function extractPortfolio(text: string): string | null {
  // Find URLs that are NOT email, linkedin, or company domains
  const m = text.match(/https?:\/\/(?!(?:www\.)?linkedin\.com)[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}(?:\/[^\s]*)*/i);
  return m ? m[0] : null;
}

/* ─── 4. Name extraction – multi-strategy ────────────────────── */

/**
 * Lines that look name-shaped but are section headings. Without this, a CV
 * whose name is ALL CAPS (so it fails the Title-Case test) falls through to
 * the first heading in the document — "Technical Skills" becomes the name.
 */
const HEADING_WORDS = [
  'technical', 'professional', 'personal', 'work', 'employment', 'career',
  'education', 'academic', 'qualification', 'qualifications', 'skills', 'skill',
  'experience', 'summary', 'objective', 'profile', 'projects', 'project',
  'certifications', 'certification', 'certificates', 'achievements', 'awards',
  'languages', 'language', 'interests', 'hobbies', 'references', 'declaration',
  'training', 'courses', 'publications', 'activities', 'strengths', 'expertise',
  'competencies', 'background', 'details', 'information', 'contact',
];

function looksLikeHeading(line: string): boolean {
  const words = line.toLowerCase().split(/\s+/).filter(Boolean);
  // A heading is short and built only from heading vocabulary ("Technical
  // Skills", "Work Experience"), unlike a real name.
  return words.length <= 3 && words.every((w) => HEADING_WORDS.includes(w.replace(/[^a-z]/g, '')));
}

function titleCase(s: string): string {
  return s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function extractName(text: string, lines: string[]): string | null {
  // Strategy A: look for "Name: John Smith" label
  const labeled = text.match(/(?:^|\n)\s*(?:name|full\s*name)\s*[:\-]\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})/im);
  if (labeled) return labeled[1].trim();

  const candidates = lines.slice(0, 12).map((l) => l.trim()).filter((l) => l.length >= 3 && l.length <= 60);

  // Strategy B: an ALL CAPS line at the very top is the strongest signal — most
  // resumes bannerise the name. Checked BEFORE the Title-Case scan, because an
  // ALL CAPS name fails that test and would otherwise lose to a later heading.
  for (const line of candidates.slice(0, 5)) {
    if (
      line === line.toUpperCase() &&
      /^[A-Z]+(?:[ .'-]+[A-Z]+){1,4}$/.test(line) &&
      line.length <= 40 &&
      !looksLikeHeading(line)
    ) {
      return titleCase(line);
    }
  }

  // Strategy C: scan the first 12 lines for a Title-Case name-like line
  for (const line of candidates) {
    // Skip lines with obvious non-name content
    if (/[@|:\/\\<>{}[\]0-9#*]/.test(line)) continue;
    if (/(?:resume|curriculum|vitae|cv\b|profile|summary|objective|address|phone|email|linkedin|github|http|www\.)/i.test(line)) continue;
    // Skip lines that are all uppercase and long (likely section headers like "PROFESSIONAL EXPERIENCE")
    if (line === line.toUpperCase() && line.split(' ').length > 3) continue;
    if (looksLikeHeading(line)) continue;

    const words = line.split(/\s+/).filter(Boolean);
    if (words.length < 2 || words.length > 5) continue;

    // Each word should look like a name part: starts uppercase, mostly letters.
    // ALL CAPS words are allowed up to a realistic name length (the old cap of
    // 5 rejected "SHALMON"/"GAIKWAD").
    const isNameLike = words.every((w) => /^[A-Z][a-z'\-.]+$|^[A-Z]{2,15}$/.test(w));
    if (isNameLike) return line.trim();
  }

  return null;
}

/* ─── 5. Location & nationality ──────────────────────────────── */

function extractLocation(text: string): string | null {
  const UAE_CITIES = ['Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'Fujairah', 'Ras Al Khaimah', 'Umm Al Quwain'];
  for (const city of UAE_CITIES) {
    if (text.toLowerCase().includes(city.toLowerCase())) {
      return `${city}, UAE`;
    }
  }
  // "Location: City, Country" pattern
  const m = text.match(/(?:location|address|based in|residing|city)\s*[:\-]\s*([A-Za-z\s,]+?)(?:\n|$)/i);
  if (m) return m[1].replace(/\s+/g, ' ').trim().replace(/,\s*$/, '');

  // City, Country pattern in text
  const cityCountry = text.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?),?\s*(UAE|United Arab Emirates|India|Pakistan|Philippines|UK|USA|Canada|Australia)\b/);
  if (cityCountry) return `${cityCountry[1]}, ${cityCountry[2]}`;

  return null;
}

const NATIONALITIES = [
  'Emirati','Indian','Pakistani','Bangladeshi','Sri Lankan','Nepali','Filipino','Indonesian',
  'Malaysian','Singaporean','Chinese','Egyptian','Lebanese','Jordanian','Syrian',
  'Yemeni','Iraqi','Kuwaiti','Saudi','Qatari','Bahraini','Omani',
  'British','American','Canadian','Australian','French','German','Nigerian',
  'Ghanaian','Kenyan','Ethiopian','Sudanese','Moroccan','Tunisian','Algerian',
  'South African','Zimbabwean','Ugandan','Tanzanian','Rwandan',
  'Russian','Ukrainian','Polish','Romanian','Italian','Spanish','Portuguese',
  'Thai','Vietnamese','Korean','Japanese','Myanmar',
];

const NATIONALITY_LOWER = new Map(NATIONALITIES.map((n) => [n.toLowerCase(), n] as [string, string]));

function extractNationality(text: string): string | null {
  // Same-line only: `\s` would run past the blank line after "Nationality: Indian"
  // and swallow the next section heading ("Indian\n\nPROFESSIONAL").
  const m = text.match(/(?:nationality|citizenship|citizen)[ \t]*[:\-]?[ \t]*([A-Za-z]+(?:[ \t]+[A-Za-z]+)?)/i);
  if (m) {
    const captured = m[1].trim();
    // "South African" is two words, "Indian Passport" is one plus noise: prefer a
    // known nationality, trying the full capture before its first word.
    const full = NATIONALITY_LOWER.get(captured.toLowerCase());
    if (full) return full;
    const first = captured.split(/[ \t]+/)[0];
    return NATIONALITY_LOWER.get(first.toLowerCase()) ?? first;
  }

  const lower = text.toLowerCase();
  for (const n of NATIONALITIES) {
    if (lower.includes(n.toLowerCase())) return n;
  }
  return null;
}

/* ─── 6. Experience ───────────────────────────────────────────── */

function extractExperience(text: string): number | null {
  // Explicit mentions: "8 years of experience", "8+ yrs exp", "over 5 years"
  const explicit = [
    /(\d{1,2})\+?\s*(?:years?|yrs?)[\s\+]*(?:of\s+)?(?:relevant\s+)?(?:professional\s+)?experience/i,
    /(?:over|more\s+than|nearly|almost)\s+(\d{1,2})\+?\s*(?:years?|yrs?)/i,
    /experience\s*[:\-]?\s*(\d{1,2})\+?\s*(?:years?|yrs?)/i,
    /(\d{1,2})\s*(?:years?|yrs?)\s+(?:of\s+)?(?:work|industry|relevant|professional|total)/i,
  ];
  for (const p of explicit) {
    const m = text.match(p);
    if (m) {
      const v = parseInt(m[1]);
      if (v > 0 && v < 60) return v;
    }
  }

  // Count from date ranges: "Jan 2018 – Present", "2019 - 2022", "03/2020 – 06/2023"
  const yearRanges = Array.from(text.matchAll(/\b(20\d{2}|19[89]\d)\b\s*[-–—to]+\s*\b(20\d{2}|19[89]\d|present|current|now|date)\b/gi));
  if (yearRanges.length > 0) {
    const thisYear = new Date().getFullYear();
    let total = 0;
    for (const match of yearRanges) {
      const start = parseInt(match[1]);
      const rawEnd = match[2].toLowerCase();
      const end = /present|current|now|date/.test(rawEnd) ? thisYear : parseInt(rawEnd);
      const diff = end - start;
      if (diff > 0 && diff < 50) total += diff;
    }
    if (total > 0) return Math.min(total, 45);
  }

  // Count job entries as rough proxy
  const jobCount = (text.match(/\b(?:20\d{2}|19[89]\d)\b/g) || []).length;
  if (jobCount >= 4) return Math.min(Math.floor(jobCount / 2), 20);

  return null;
}

/* ─── 7. Section splitter ─────────────────────────────────────── */

const SECTION_HEADERS: Record<string, RegExp[]> = {
  summary: [
    /^(?:professional\s+)?(?:summary|profile|about\s+me|career\s+objective|objective|overview|introduction|professional\s+background)/i,
  ],
  experience: [
    /^(?:(?:professional\s+|work\s+|relevant\s+)?experience|employment(?:\s+history)?|work\s+history|career\s+history|professional\s+background|positions?\s+held)/i,
  ],
  education: [
    /^(?:education(?:al\s+(?:background|qualifications?))?|academic(?:\s+qualifications?|\s+background)?|qualifications?|degrees?|certifications?\s+(?:and\s+)?education)/i,
  ],
  skills: [
    /^(?:(?:technical\s+|core\s+|key\s+|professional\s+)?skills?|competenc(?:y|ies)|expertise|technologies|tech(?:nical\s+)?stack|proficienc(?:y|ies)|areas?\s+of\s+expertise|tools?\s+(?:and\s+technologies?)?)/i,
  ],
  languages: [
    /^(?:languages?(?:\s+(?:known|spoken|proficiency))?|linguistic\s+(?:skills?|abilities?))/i,
  ],
  certifications: [
    /^(?:certifications?|certificates?|courses?|training|professional\s+development|licenses?\s+(?:and\s+certifications?)?)/i,
  ],
  projects: [
    /^(?:projects?|key\s+projects?|notable\s+projects?|personal\s+projects?)/i,
  ],
};

type Sections = Record<string, string>;

function splitSections(text: string): Sections {
  const lines   = text.split('\n');
  const result: Record<string, string[]> = {};
  let current   = '__preamble__';
  result[current] = [];

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { result[current]?.push(''); continue; }

    // A potential section header: short, no punctuation ending, check against patterns
    if (line.length < 80 && !/[.!?,;]$/.test(line)) {
      let matched = false;
      for (const [name, patterns] of Object.entries(SECTION_HEADERS)) {
        if (patterns.some((p) => p.test(line))) {
          current = name;
          if (!result[current]) result[current] = [];
          matched = true;
          break;
        }
      }
      if (matched) continue;
    }

    if (!result[current]) result[current] = [];
    result[current].push(raw);
  }

  // Convert arrays to trimmed strings
  const sections: Sections = {};
  for (const [k, v] of Object.entries(result)) {
    const joined = v.join('\n').trim();
    if (joined) sections[k] = joined;
  }
  return sections;
}

/* ─── 8. Skills extraction ────────────────────────────────────── */

// ~300 skills across domains
const SKILL_DICTIONARY = [
  // Programming languages
  'JavaScript','TypeScript','Python','Java','C#','C++','C','Go','Rust','Swift','Kotlin','Ruby','PHP','Scala','R','MATLAB','Shell','Bash','PowerShell','Perl','Lua','Dart','Elixir','Haskell','Clojure','F#','VBA','COBOL','Fortran',
  // Frontend
  'React','Vue','Angular','Next.js','Nuxt.js','Svelte','HTML','CSS','SASS','LESS','Tailwind','Bootstrap','jQuery','Redux','MobX','GraphQL','REST','SOAP','WebSockets','TypeScript',
  // Backend
  'Node.js','Express','Django','Flask','FastAPI','Spring','Spring Boot','Laravel','Rails','ASP.NET','Symfony','NestJS','Gin','Echo','Fiber','Actix','Rocket',
  // Mobile
  'React Native','Flutter','iOS','Android','Xamarin','Ionic','Cordova','Swift','Kotlin','Objective-C',
  // Cloud & DevOps
  'AWS','Azure','GCP','Google Cloud','Kubernetes','Docker','Terraform','Ansible','Jenkins','GitLab CI','GitHub Actions','CircleCI','Travis CI','Helm','Prometheus','Grafana','Datadog','New Relic','CloudFormation','Pulumi',
  // Databases
  'MySQL','PostgreSQL','MongoDB','Redis','Elasticsearch','Cassandra','Oracle','SQL Server','SQLite','DynamoDB','Firebase','Supabase','Neo4j','InfluxDB','CockroachDB','MariaDB','Snowflake','BigQuery','Redshift',
  // AI/ML
  'Machine Learning','Deep Learning','TensorFlow','PyTorch','Keras','scikit-learn','OpenCV','NLP','Computer Vision','Data Science','Data Analysis','Pandas','NumPy','Matplotlib','Seaborn','Jupyter','BERT','GPT','LLM','Hugging Face','Langchain','RAG',
  // Tools
  'Git','GitHub','GitLab','Bitbucket','JIRA','Confluence','Slack','Figma','Sketch','Adobe XD','Postman','Insomnia','VS Code','IntelliJ','Eclipse','Vim','Linux','Unix','macOS','Windows','Nginx','Apache',
  // HR / Business / ERP
  'SAP','Oracle ERP','Workday','BambooHR','Zoho HR','PeopleSoft','ADP','Kronos','Taleo','SuccessFactors','Greenhouse','Lever','Workable','HRIS','Payroll','Recruitment','Talent Acquisition','Performance Management','L&D','Onboarding','Employee Relations',
  // Finance / Accounting
  'Excel','Advanced Excel','Power BI','Tableau','Financial Analysis','Accounting','Taxation','Audit','Bloomberg','Reuters','QuickBooks','Tally','IFRS','GAAP','Financial Modeling','Budgeting','Forecasting','CFA','ACCA','CA',
  // Engineering / Construction
  'AutoCAD','Revit','BIM','STAAD Pro','ETABS','SAP2000','Primavera','MS Project','Civil 3D','SolidWorks','CATIA','Ansys','MATLAB','Procore','Navisworks','SketchUp',
  // Marketing / Sales
  'SEO','SEM','Google Ads','Facebook Ads','Instagram','LinkedIn Marketing','Email Marketing','HubSpot','Salesforce','Mailchimp','Hootsuite','Google Analytics','CRM','Content Marketing','Brand Strategy','Market Research','B2B Sales','B2C Sales','Key Account Management',
  // Management / Soft Skills
  'Project Management','PMP','Agile','Scrum','Kanban','Six Sigma','Lean','Prince2','Leadership','Team Management','Stakeholder Management','Communication','Negotiation','Problem Solving','Critical Thinking','Strategic Planning','Business Development','Operations Management',
  // Supply Chain / Logistics
  'Supply Chain Management','Procurement','Logistics','Inventory Management','SAP SCM','Warehouse Management','ERP','Lean Manufacturing','Quality Control','ISO 9001','Six Sigma',
  // Legal / Compliance
  'UAE Law','Labour Law','Corporate Law','Contracts','Compliance','Legal Research','Litigation','Arbitration','GDPR','Risk Management','Regulatory Affairs',
  // Design
  'Figma','Adobe Photoshop','Adobe Illustrator','InDesign','After Effects','Premiere Pro','UX Design','UI Design','User Research','Prototyping','Design Systems','Wireframing','Branding','Typography',
  // Healthcare
  'Nursing','Patient Care','Clinical Research','Pharmacy','Radiology','Laboratory','EMR','EHR','Medical Coding','ICD-10',
  // Languages (professional context)
  'Translation','Interpretation','Arabic','English','Hindi','French','German','Spanish','Urdu',
];

// Normalised lookup for case-insensitive matching
const SKILL_LOWER = new Map(SKILL_DICTIONARY.map((s) => [s.toLowerCase(), s] as [string, string]));

function extractSkills(sections: Sections, fullText: string): string[] {
  const found = new Set<string>();
  const source = [sections.skills || '', sections.certifications || '', fullText].join('\n').toLowerCase();

  // 1. Match known skills
  for (const [lower, canonical] of Array.from(SKILL_LOWER)) {
    // Use word boundary check to avoid partial matches
    const escaped = lower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(?:^|[\\s,;/|•·\\-\\(])${escaped}(?:$|[\\s,;/|•·\\-\\)])`, 'i');
    if (re.test(source)) found.add(canonical);
  }

  // 2. If we have a skills section, also extract comma/bullet separated tokens
  if (sections.skills) {
    const items = sections.skills
      .replace(/[•●▪►▸→✓✔\-]/g, ',')
      .split(/[,|\n\/\\]/)
      .map((s) => s.trim())
      .filter((s) => s.length > 1 && s.length < 50 && /[a-zA-Z]/.test(s));

    for (const item of items) {
      // Clean up common artifacts
      const clean = item.replace(/^\d+\.\s*/, '').replace(/\s+/g, ' ').trim();
      if (clean && clean.split(' ').length <= 5 && !found.has(clean)) {
        // Only add if it looks like a skill (not a sentence)
        if (!/(?:years?|responsible|experience|ability|knowledge|famil)/i.test(clean)) {
          found.add(clean);
        }
      }
    }
  }

  // Return up to 25, prioritising matched dictionary skills
  const all = Array.from(found);
  const dict = all.filter((s) => SKILL_LOWER.has(s.toLowerCase()));
  const custom = all.filter((s) => !SKILL_LOWER.has(s.toLowerCase()));
  return [...dict, ...custom].slice(0, 25);
}

/* ─── 9. Languages ────────────────────────────────────────────── */

const LANGUAGES = [
  'English','Arabic','Hindi','Urdu','French','German','Spanish','Tagalog','Filipino',
  'Malayalam','Tamil','Telugu','Bengali','Punjabi','Sinhala','Nepali','Marathi','Gujarati',
  'Kannada','Odia','Sindhi','Pashto','Persian','Farsi','Turkish','Russian','Chinese',
  'Mandarin','Cantonese','Japanese','Korean','Thai','Vietnamese','Malay','Indonesian',
  'Italian','Portuguese','Dutch','Greek','Polish','Romanian','Ukrainian','Swahili','Amharic',
];

/**
 * True when a detected "languages" block is really a technical-skills list.
 *
 * Developer CVs write "Languages: Java, JavaScript" as a sub-label inside
 * Technical Skills, and the section splitter takes that as the start of the
 * spoken-languages section — so every following line (Backend, Frontend,
 * Databases…) got reported as a language. A block with several known skills
 * and no known spoken language is a tech list, not languages.
 */
function isTechList(block: string): boolean {
  const lower = block.toLowerCase();
  const langHits = LANGUAGES.filter((l) => lower.includes(l.toLowerCase())).length;
  if (langHits > 0) return false;
  let skillHits = 0;
  for (const lower_ of Array.from(SKILL_LOWER.keys())) {
    if (lower.includes(lower_)) skillHits++;
    if (skillHits >= 2) return true;
  }
  return false;
}

function extractLanguages(sections: Sections, text: string): string[] {
  const found = new Set<string>();
  // Fall back to whole-document dictionary matching when the "languages"
  // section turns out to be a tech list.
  const section = sections.languages && !isTechList(sections.languages) ? sections.languages : null;
  const lower = (section || text).toLowerCase();

  for (const lang of LANGUAGES) {
    if (lower.includes(lang.toLowerCase())) found.add(lang);
  }

  // Also pull free-text entries from a genuine language section, so languages
  // outside the dictionary ("Konkani", "Tigrinya") still come through.
  if (section) {
    const items = section
      .split(/[\n,;•●▪►\-|]/)
      .map((s) => s.trim())
      .filter((s) => s.length > 2 && s.length < 40 && /^[A-Za-z\s]+$/.test(s));

    for (const item of items) {
      // Remove proficiency descriptors
      const clean = item.replace(/\b(?:native|fluent|proficient|intermediate|basic|beginner|advanced|mother\s*tongue|bilingual|conversational|working\s*knowledge)\b/gi, '').trim();
      // Never accept something the skill dictionary already knows, or an
      // acronym like HTML/CSS/SQL — those are technologies, not languages.
      if (clean.length < 2) continue;
      if (SKILL_LOWER.has(clean.toLowerCase())) continue;
      if (/^[A-Z]{2,}$/.test(clean)) continue;
      if (clean.split(/\s+/).length > 2) continue;
      found.add(clean);
    }
  }

  return Array.from(found).slice(0, 10);
}

/* ─── 10. Education ───────────────────────────────────────────── */

function extractEducation(sections: Sections): string | null {
  if (!sections.education) return null;
  return sections.education
    .split('\n')
    .slice(0, 6)
    .filter((l) => l.trim())
    .join(' | ')
    .substring(0, 400);
}

/* ─── 11. Headline ────────────────────────────────────────────── */

const JOB_TITLE_WORDS = [
  'engineer','developer','manager','director','analyst','consultant','designer',
  'architect','specialist','officer','executive','coordinator','administrator',
  'accountant','auditor','recruiter','hr','lead','head','senior','junior','associate',
  'supervisor','technician','assistant','advisor','officer','controller','planner',
  'nurse','doctor','pharmacist','legal','counsel','lawyer','intern','trainee',
];

// `experience` and `sections` are unused (as in the original) but kept for signature parity.
function extractHeadline(text: string, lines: string[], _experience: number | null, _sections: Sections): string | null {
  // Labelled pattern
  const labeled = text.match(/(?:^|\n)\s*(?:title|position|designation|role|headline)\s*[:\-]\s*(.{5,80}?)(?:\n|$)/im);
  if (labeled) return labeled[1].trim();

  // Scan first 8 lines for a short professional title line (NOT a full sentence)
  for (const line of lines.slice(0, 8)) {
    if (line.length < 5 || line.length > 80) continue;
    if (/[@|:\/\\<>{}[\]0-9#*]/.test(line)) continue;
    if (/(?:resume|curriculum|vitae|cv\b|address|phone|email|linkedin|github|http|www\.)/i.test(line)) continue;
    // Must NOT be a full sentence (no period ending after more than 30 chars)
    if (line.length > 40 && /[.!?]$/.test(line)) continue;
    // Must contain a job-title keyword
    const lower = line.toLowerCase();
    if (JOB_TITLE_WORDS.some((w) => lower.includes(w))) {
      return line.trim();
    }
  }

  return null;
}

/* ─── 12. Summary ─────────────────────────────────────────────── */

function extractSummary(sections: Sections): string | null {
  const src = sections.summary || sections.__preamble__;
  if (!src) return null;
  // Take up to 600 chars, strip blank lines
  return src
    .split('\n')
    .filter((l) => l.trim())
    .join(' ')
    .substring(0, 600)
    .trim() || null;
}

/* ─── 12. Main entry point ────────────────────────────────────── */

/** Removes terms already reported as languages from the skills list. */
function withoutLanguages(skills: string[], languages: string[]): string[] {
  if (!languages.length) return skills;
  const langs = new Set(languages.map((l) => l.toLowerCase()));
  return skills.filter((s) => !langs.has(s.toLowerCase()));
}

/**
 * Parse a CV from an absolute disk path. Never throws: an unreadable file
 * yields `{ error }`, and a file with no extractable text yields empty fields
 * plus `_error`.
 */
export async function parseCV(filePath: string): Promise<ParsedCV> {
  let raw: string | null;
  try {
    raw = await extractText(filePath);
  } catch (err: any) {
    // Only `error` is set here (as in the original); typed as ParsedCV so callers
    // can check `result.error` without narrowing.
    return { error: `Could not read file: ${err.message}` } as ParsedCV;
  }
  return parseCvFromText(raw);
}

/** True when a file yielded too little text to be a readable CV. */
export function hasUsableText(raw: string | null | undefined): boolean {
  return !!raw && raw.replace(/\s/g, '').length >= 30;
}

export const NO_TEXT_MESSAGE =
  'Could not extract readable text from this file. If it is a scanned/image PDF please convert it to a text-based PDF or DOCX and re-upload.';

/**
 * Runs the deterministic extractors over already-extracted text. Split out of
 * `parseCV` so the LLM layer (server/utils/cvExtract.ts) can reuse one text
 * extraction for both itself and this regex fallback.
 */
export function parseCvFromText(raw: string | null): ParsedCV {
  if (!hasUsableText(raw)) {
    return {
      _error: NO_TEXT_MESSAGE,
      firstName: '', lastName: '', email: null, phone: null,
      skills: [], languages: [], nationality: null, currentLocation: null,
      experience: null, headline: null, summary: null, education: null,
      linkedIn: null, portfolio: null,
    };
  }

  const text     = cleanText(raw as string);
  const lines    = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const sections = splitSections(text);

  // Log section detection for debugging
  console.log('[cvParser] Sections found:', Object.keys(sections));
  console.log('[cvParser] Text length:', text.length);

  const name     = extractName(text, lines);
  const nameParts = name ? name.trim().split(/\s+/) : [];

  const experience = extractExperience(text);
  const languages  = extractLanguages(sections, text);
  const parsed: ParsedCV = {
    firstName:       nameParts[0]   || '',
    lastName:        nameParts.slice(1).join(' ') || '',
    email:           extractEmail(text),
    phone:           extractPhone(text),
    linkedIn:        extractLinkedIn(text),
    portfolio:       extractPortfolio(text),
    nationality:     extractNationality(text),
    currentLocation: extractLocation(text),
    experience,
    headline:        extractHeadline(text, lines, experience, sections),
    // Several languages ('English', 'Arabic', 'Hindi', 'Urdu') are also in the
    // skill dictionary, since some CVs list them under Skills. When a term was
    // already picked up as a language, don't repeat it as a skill too.
    skills:          withoutLanguages(extractSkills(sections, text), languages),
    languages,
    education:       extractEducation(sections),
    summary:         extractSummary(sections),
    // Debug info (not sent to client but logged)
    _debug: {
      textLength:    text.length,
      sectionsFound: Object.keys(sections),
      linesCount:    lines.length,
    },
  };

  console.log('[cvParser] Result:', {
    name: `${parsed.firstName} ${parsed.lastName}`,
    email: parsed.email,
    phone: parsed.phone,
    experience: parsed.experience,
    skillsCount: parsed.skills.length,
    sectionsFound: parsed._debug.sectionsFound,
  });

  return parsed;
}
