/**
 * Creating, normalising and editing page-builder trees. All functions are pure
 * (they return new objects) so the editor's undo history can keep snapshots.
 */
import { COLUMN_DEF, ELEMENT_BY_TYPE, SECTION_DEF } from './elements';
import { DEFAULT_SEO, DEFAULT_SETTINGS, type Device, type PBNode, type PageDoc, type StyleProps } from './types';

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

export function newId(): string {
  const r = Math.random().toString(36).slice(2, 8);
  return `${Date.now().toString(36).slice(-4)}${r}`;
}

export const ID_RE = /^[a-z0-9]{4,24}$/;

export function newNode(type: string, props: Record<string, any> = {}, style?: PBNode['style']): PBNode {
  const def = ELEMENT_BY_TYPE[type];
  return {
    id: newId(),
    type,
    props: { ...clone(def?.defaults || {}), ...props },
    style: clone(style ?? def?.style ?? {}),
    ...(type === 'section' || type === 'column' ? { children: [] } : {}),
  };
}

export function newColumn(widthPct: number, children: PBNode[] = []): PBNode {
  const c = newNode('column');
  c.style = { ...c.style, desktop: { ...(c.style?.desktop || {}), width: `${widthPct}%` } };
  c.children = children;
  return c;
}

/** A section with columns at the given percent widths. */
export function newSection(widths: number[] = [100], props: Record<string, any> = {}, style?: PBNode['style']): PBNode {
  const s = newNode('section', props, style ?? SECTION_DEF.style);
  s.children = widths.map(w => newColumn(w));
  return s;
}

/** Deep copy with fresh ids (for duplicate / paste / templates). */
export function withNewIds(node: PBNode): PBNode {
  const n = clone(node);
  const visit = (x: PBNode) => { x.id = newId(); x.children?.forEach(visit); };
  visit(n);
  return n;
}

export function emptyDoc(): PageDoc {
  return { version: 1, settings: { ...DEFAULT_SETTINGS }, seo: { ...DEFAULT_SEO }, sections: [] };
}

/* ─── Normalising (anything stored or pasted) ───────────────────────────── */

const DEVICES: Device[] = ['desktop', 'tablet', 'mobile'];

function cleanStyle(raw: any): PBNode['style'] {
  const out: PBNode['style'] = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const d of DEVICES) {
    const s = raw[d];
    if (!s || typeof s !== 'object') continue;
    const o: StyleProps = {};
    for (const [k, v] of Object.entries(s)) if (v !== '' && v != null && (typeof v === 'string' || typeof v === 'number')) (o as any)[k] = String(v).slice(0, 2000);
    if (Object.keys(o).length) out[d] = o;
  }
  return out;
}

/**
 * Makes any input a valid node of a known type at the right level (sections
 * hold columns, columns hold elements). Unknown types are dropped.
 */
export function normalizeNode(raw: any, level: 'section' | 'column' | 'element'): PBNode | null {
  if (!raw || typeof raw !== 'object') return null;
  const type = String(raw.type || '');
  if (level === 'section' && type !== 'section') return null;
  if (level === 'column' && type !== 'column') return null;
  if (level === 'element' && (type === 'section' || type === 'column' || !ELEMENT_BY_TYPE[type])) return null;
  const def = ELEMENT_BY_TYPE[type] || (level === 'section' ? SECTION_DEF : COLUMN_DEF);
  const node: PBNode = {
    id: typeof raw.id === 'string' && ID_RE.test(raw.id) ? raw.id : newId(),
    type,
    props: { ...clone(def.defaults), ...(raw.props && typeof raw.props === 'object' && !Array.isArray(raw.props) ? raw.props : {}) },
    style: cleanStyle(raw.style),
  };
  if (raw.hover && typeof raw.hover === 'object') node.hover = Object.fromEntries(Object.entries(raw.hover).filter(([, v]) => typeof v === 'string' && v)) as any;
  if (raw.adv && typeof raw.adv === 'object') node.adv = { ...raw.adv };
  if (level === 'section') {
    node.children = (Array.isArray(raw.children) ? raw.children : []).map((c: any) => normalizeNode(c, 'column')).filter(Boolean) as PBNode[];
    if (!node.children.length) node.children = [newColumn(100)];
  } else if (level === 'column') {
    node.children = (Array.isArray(raw.children) ? raw.children : []).map((c: any) => normalizeNode(c, 'element')).filter(Boolean) as PBNode[];
  }
  return node;
}

export function normalizeDoc(raw: any): PageDoc {
  const d = raw && typeof raw === 'object' ? raw : {};
  const seen = new Set<string>();
  const sections = (Array.isArray(d.sections) ? d.sections : []).map((s: any) => normalizeNode(s, 'section')).filter(Boolean) as PBNode[];
  // Ids must be unique: CSS classes and editor selection key on them.
  const dedupe = (n: PBNode) => { if (seen.has(n.id)) n.id = newId(); seen.add(n.id); n.children?.forEach(dedupe); };
  sections.forEach(dedupe);
  return {
    version: 1,
    settings: { ...DEFAULT_SETTINGS, ...(d.settings && typeof d.settings === 'object' ? d.settings : {}) },
    seo: { ...DEFAULT_SEO, ...(d.seo && typeof d.seo === 'object' ? d.seo : {}) },
    sections,
  };
}

/* ─── Tree queries ──────────────────────────────────────────────────────── */

export interface Located { node: PBNode; parent: PBNode | null; index: number; path: PBNode[] }

export function findNode(sections: PBNode[], id: string): Located | null {
  const visit = (list: PBNode[], parent: PBNode | null, path: PBNode[]): Located | null => {
    for (let i = 0; i < list.length; i++) {
      const n = list[i];
      if (n.id === id) return { node: n, parent, index: i, path };
      if (n.children) {
        const hit = visit(n.children, n, [...path, n]);
        if (hit) return hit;
      }
    }
    return null;
  };
  return visit(sections, null, []);
}

export function levelOf(node: PBNode): 'section' | 'column' | 'element' {
  return node.type === 'section' ? 'section' : node.type === 'column' ? 'column' : 'element';
}

/** Applies `fn` to the node with `id`, returning a new tree. */
export function updateNode(sections: PBNode[], id: string, fn: (n: PBNode) => PBNode): PBNode[] {
  const visit = (list: PBNode[]): PBNode[] => list.map(n => {
    if (n.id === id) return fn(n);
    if (n.children) {
      const next = visit(n.children);
      return next === n.children ? n : { ...n, children: next };
    }
    return n;
  });
  return visit(sections);
}

export function removeNode(sections: PBNode[], id: string): PBNode[] {
  const visit = (list: PBNode[]): PBNode[] => list.filter(n => n.id !== id).map(n => (n.children ? { ...n, children: visit(n.children) } : n));
  return visit(sections);
}

/** Inserts `node` into the parent with `parentId` (null = top level) at `index`. */
export function insertNode(sections: PBNode[], parentId: string | null, index: number, node: PBNode): PBNode[] {
  if (parentId === null) {
    const next = [...sections];
    next.splice(Math.max(0, Math.min(index, next.length)), 0, node);
    return next;
  }
  return updateNode(sections, parentId, p => {
    const kids = [...(p.children || [])];
    kids.splice(Math.max(0, Math.min(index, kids.length)), 0, node);
    return { ...p, children: kids };
  });
}

/** Moves a node to a new parent/index (index counted before removal is handled). */
export function moveNode(sections: PBNode[], id: string, parentId: string | null, index: number): PBNode[] {
  const from = findNode(sections, id);
  if (!from) return sections;
  // Can't drop a node inside itself.
  if (parentId && (parentId === id || findNode(from.node.children || [], parentId))) return sections;
  const sameParent = (from.parent?.id ?? null) === parentId;
  const target = sameParent && from.index < index ? index - 1 : index;
  return insertNode(removeNode(sections, id), parentId, target, from.node);
}

export function duplicateNode(sections: PBNode[], id: string): { sections: PBNode[]; newId: string | null } {
  const at = findNode(sections, id);
  if (!at) return { sections, newId: null };
  const copy = withNewIds(at.node);
  return { sections: insertNode(sections, at.parent?.id ?? null, at.index + 1, copy), newId: copy.id };
}

/** Re-spreads a section's columns to the given widths (adding or merging columns). */
export function applyLayout(section: PBNode, widths: number[]): PBNode {
  const cols = [...(section.children || [])];
  while (cols.length < widths.length) cols.push(newColumn(0));
  if (cols.length > widths.length) {
    const last = cols[widths.length - 1];
    const extra = cols.splice(widths.length);
    last.children = [...(last.children || []), ...extra.flatMap(c => c.children || [])];
  }
  return {
    ...section,
    children: cols.map((c, i) => ({ ...c, style: { ...c.style, desktop: { ...(c.style?.desktop || {}), width: `${widths[i]}%` } } })),
  };
}

export function countNodes(sections: PBNode[]): number {
  let n = 0;
  const v = (x: PBNode) => { n++; x.children?.forEach(v); };
  sections.forEach(v);
  return n;
}

/** Short human name for a node in the layers panel. */
export function nodeTitle(n: PBNode): string {
  if (n.adv?.label) return n.adv.label;
  if (n.type === 'section') {
    // Name a section after its first heading-like element.
    let found = '';
    const visit = (x: PBNode) => { if (found) return; if (x.type !== 'section' && x.type !== 'column') { const t = nodeTitle(x); if (t && (x.type === 'heading' || x.type === 'hero' || x.type === 'cta' || x.type === 'form')) found = t; } x.children?.forEach(visit); };
    visit(n);
    return found ? `Section · ${found}` : 'Section';
  }
  const def = ELEMENT_BY_TYPE[n.type];
  const p = n.props || {};
  const raw = p.title || p.text || p.label || p.eyebrow || (typeof p.html === 'string' ? p.html.replace(/<[^>]+>/g, ' ') : '') || p.query || '';
  const s = String(raw).replace(/[*_]/g, '').replace(/\s+/g, ' ').trim();
  return s ? s.slice(0, 40) : def?.label || n.type;
}
