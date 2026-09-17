/**
 * Auto-discovers every domain tool file in this directory (anything except
 * itself and files prefixed "_") and flattens their default-exported tool
 * arrays into one registry.
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
const fs = require('fs');
const path = require('path');

class ToolError extends Error {}

function loadAllTools() {
  const files = fs.readdirSync(__dirname).filter((f) => f.endsWith('.js') && !f.startsWith('_'));
  const all = [];
  const seenNames = new Set();

  for (const file of files) {
    const exported = require(path.join(__dirname, file));
    const tools = Array.isArray(exported) ? exported : exported.default;
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

// Loaded once at process start; tool definitions are static code, not admin-editable data.
const ALL_TOOLS = loadAllTools();
const TOOL_MAP = new Map(ALL_TOOLS.map((t) => [t.name, t]));

/** OpenAI-shaped tool list, filtered to only what this role may call. */
function getToolsForRole(role) {
  return ALL_TOOLS
    .filter((t) => t.allowedRoles.includes(role))
    .map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } }));
}

/** Run a tool by name, re-checking role authorization independently of getToolsForRole(). */
async function executeTool(name, args, user, ctx = {}) {
  const tool = TOOL_MAP.get(name);
  if (!tool) throw new ToolError(`Unknown tool: ${name}`);
  if (!tool.allowedRoles.includes(user.role)) {
    throw new ToolError(`Role ${user.role} may not call ${name}`);
  }
  return tool.handler(args || {}, { ...ctx, user });
}

/** Tools with no role restriction at all — used by the unauthenticated public route. */
function getPublicTools() {
  return ALL_TOOLS
    .filter((t) => t.allowedRoles.includes('PUBLIC'))
    .map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } }));
}

async function executePublicTool(name, args, ctx = {}) {
  const tool = TOOL_MAP.get(name);
  if (!tool || !tool.allowedRoles.includes('PUBLIC')) throw new ToolError(`Unknown tool: ${name}`);
  return tool.handler(args || {}, ctx);
}

module.exports = { getToolsForRole, executeTool, getPublicTools, executePublicTool, ToolError, ALL_TOOLS };
