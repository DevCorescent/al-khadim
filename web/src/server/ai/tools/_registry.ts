// Ported from api/src/ai/tools/_registry.js
/**
 * Collects every domain tool file in this directory and flattens their
 * default-exported tool arrays into one registry. (The Express version
 * auto-discovered files with fs.readdirSync; a bundled Next.js server can't
 * require files dynamically, so the list below is explicit — add new domain
 * files here, in alphabetical order to keep the original ordering.)
 *
 * This is the AI assistant's actual security boundary — never the system
 * prompt. `getToolsForRole()` filters which tool *definitions* (name +
 * description + parameter schema) are even sent to OpenAI for a given
 * request, so a role the model was never given a tool for cannot discover
 * that tool exists at all. `executeTool()` re-checks the same allowlist
 * independently before running a handler, so even a hallucinated or
 * maliciously-crafted tool call (e.g. from a prompt-injection payload
 * embedded in untrusted user-submitted text) cannot reach Prisma for a tool
 * outside the caller's role.
 */
import crm from './crm';
import finance from './finance';
import hr from './hr';
import publicTools from './public';
import recruitment from './recruitment';
import reports from './reports';

export interface AiToolTable {
  columns: { key: string; label: string }[];
  rows: Record<string, any>[];
}

export interface AiToolResult {
  summary: string;
  table?: AiToolTable;
  [key: string]: any;
}

export interface AiTool {
  name: string;
  description: string;
  parameters: Record<string, any>;
  /** UserRole values, or the literal 'PUBLIC' sentinel for the anonymous widget. */
  allowedRoles: string[];
  handler: (args: any, ctx?: any) => Promise<AiToolResult>;
}

export class ToolError extends Error {}

const TOOL_FILES: [string, AiTool[]][] = [
  ['crm.ts', crm],
  ['finance.ts', finance],
  ['hr.ts', hr],
  ['public.ts', publicTools],
  ['recruitment.ts', recruitment],
  ['reports.ts', reports],
];

function loadAllTools() {
  const all: (AiTool & { file: string })[] = [];
  const seenNames = new Set<string>();

  for (const [file, tools] of TOOL_FILES) {
    if (!Array.isArray(tools)) {
      throw new Error(`[ai/tools] ${file} must default-export an array of tool definitions`);
    }
    for (const tool of tools) {
      if (!tool.name || !tool.description || !tool.parameters || !Array.isArray(tool.allowedRoles) || typeof tool.handler !== 'function') {
        throw new Error(`[ai/tools] ${file} has a malformed tool definition (missing name/description/parameters/allowedRoles/handler)`);
      }
      if (seenNames.has(tool.name)) {
        throw new Error(`[ai/tools] duplicate tool name "${tool.name}" (found in ${file})`);
      }
      seenNames.add(tool.name);
      all.push({ ...tool, file });
    }
  }
  return all;
}

// Loaded once at module load; tool definitions are static code, not admin-editable data.
export const ALL_TOOLS = loadAllTools();
const TOOL_MAP = new Map(ALL_TOOLS.map((t) => [t.name, t]));

function toOpenAiTool(t: AiTool) {
  return { type: 'function' as const, function: { name: t.name, description: t.description, parameters: t.parameters } };
}

/** OpenAI-shaped tool list, filtered to only what this role may call. */
export function getToolsForRole(role: string) {
  return ALL_TOOLS.filter((t) => t.allowedRoles.includes(role)).map(toOpenAiTool);
}

/** Run a tool by name, re-checking role authorization independently of getToolsForRole(). */
export async function executeTool(name: string, args: any, user: { role: string; [key: string]: any }, ctx: Record<string, any> = {}) {
  const tool = TOOL_MAP.get(name);
  if (!tool) throw new ToolError(`Unknown tool: ${name}`);
  if (!tool.allowedRoles.includes(user.role)) {
    throw new ToolError(`Role ${user.role} may not call ${name}`);
  }
  return tool.handler(args || {}, { ...ctx, user });
}

/** Tools with no role restriction at all — used by the unauthenticated public route. */
export function getPublicTools() {
  return ALL_TOOLS.filter((t) => t.allowedRoles.includes('PUBLIC')).map(toOpenAiTool);
}

export async function executePublicTool(name: string, args: any, ctx: Record<string, any> = {}) {
  const tool = TOOL_MAP.get(name);
  if (!tool || !tool.allowedRoles.includes('PUBLIC')) throw new ToolError(`Unknown tool: ${name}`);
  return tool.handler(args || {}, ctx);
}
