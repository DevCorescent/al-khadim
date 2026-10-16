/**
 * Drag & drop for the page builder, on native HTML5 drag events. What is being
 * dragged lives in a module-level ref (dataTransfer can't be read during
 * dragover); drop targets are worked out from the canvas DOM, which carries
 * data-pb-id / data-pb-level on every section, column and element.
 */
import type { PBNode } from '@/lib/pageBuilder/types';

export type DragPayload =
  | { kind: 'new'; type: string }
  | { kind: 'block'; label: string; build: () => PBNode }
  | { kind: 'move'; id: string; level: 'section' | 'column' | 'element' };

let current: DragPayload | null = null;
export const getDrag = () => current;
export const setDrag = (p: DragPayload | null) => { current = p; };

export function payloadLevel(p: DragPayload): 'section' | 'column' | 'element' {
  if (p.kind === 'new') return 'element';
  if (p.kind === 'block') return 'section';
  return p.level;
}

export function startDrag(e: React.DragEvent, p: DragPayload, label?: string) {
  setDrag(p);
  e.dataTransfer.effectAllowed = p.kind === 'move' ? 'move' : 'copy';
  e.dataTransfer.setData('text/plain', 'pb');
  if (label) {
    // A compact drag image instead of a ghost of the whole element.
    const ghost = document.createElement('div');
    ghost.textContent = label;
    ghost.style.cssText = 'position:fixed;top:-100px;left:-100px;padding:6px 12px;border-radius:999px;background:#0F5468;color:#fff;font:600 12px system-ui;box-shadow:0 8px 24px rgba(0,0,0,.25);white-space:nowrap';
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 12, 14);
    setTimeout(() => ghost.remove(), 0);
  }
}

export interface DropTarget {
  /** Parent to insert into; null = top level (sections). */
  parentId: string | null;
  index: number;
  /** Wrap the dropped element in a new section at `index` among sections. */
  asSection?: boolean;
  /** Indicator geometry relative to the canvas content box. */
  line: { x: number; y: number; w: number; h: number };
  /** Highlight a whole box (empty column) instead of a line. */
  box?: boolean;
}

const LEVEL = (el: Element | null) => (el as HTMLElement | null)?.dataset?.pbLevel;

/** Works out where a drop at (x, y) would land. `base` is the overlay container's rect. */
export function computeDrop(x: number, y: number, target: Element | null, root: HTMLElement, base: DOMRect, level: 'section' | 'column' | 'element'): DropTarget | null {
  const rel = (r: DOMRect) => ({ x: r.left - base.left, y: r.top - base.top, w: r.width, h: r.height });
  const sections = Array.from(root.querySelectorAll<HTMLElement>(':scope > [data-pb-level="section"]'));
  const rootRect = root.getBoundingClientRect();

  const sectionSlot = (): DropTarget => {
    for (let i = 0; i < sections.length; i++) {
      const r = sections[i].getBoundingClientRect();
      if (y < r.top + r.height / 2) return { parentId: null, index: i, asSection: level === 'element', line: { ...rel(r), y: r.top - base.top - 2, h: 4 } };
    }
    const last = sections[sections.length - 1]?.getBoundingClientRect();
    const yy = last ? last.bottom - base.top - 2 : rootRect.top - base.top + 8;
    return { parentId: null, index: sections.length, asSection: level === 'element', line: { x: rootRect.left - base.left, y: yy, w: rootRect.width, h: 4 } };
  };

  if (level === 'section') return sectionSlot();

  const hit = target?.closest<HTMLElement>('[data-pb-id]') || null;
  if (!hit || !root.contains(hit)) return level === 'element' ? sectionSlot() : null;

  if (level === 'column') {
    const col = hit.closest<HTMLElement>('[data-pb-level="column"]');
    const section = col?.closest<HTMLElement>('[data-pb-level="section"]');
    if (!col || !section) return null;
    const cols = Array.from(section.querySelectorAll<HTMLElement>(':scope .pb-row > [data-pb-level="column"]'));
    for (let i = 0; i < cols.length; i++) {
      const r = cols[i].getBoundingClientRect();
      if (x < r.left + r.width / 2) return { parentId: section.dataset.pbId!, index: i, line: { x: r.left - base.left - 2, y: r.top - base.top, w: 4, h: r.height } };
    }
    const r = cols[cols.length - 1].getBoundingClientRect();
    return { parentId: section.dataset.pbId!, index: cols.length, line: { x: r.right - base.left - 2, y: r.top - base.top, w: 4, h: r.height } };
  }

  // Element drops.
  const intoColumn = (col: HTMLElement): DropTarget => {
    const kids = Array.from(col.querySelectorAll<HTMLElement>(':scope > .pb-col-inner > [data-pb-level="element"]'));
    if (!kids.length) {
      const inner = col.querySelector<HTMLElement>(':scope > .pb-col-inner') || col;
      return { parentId: col.dataset.pbId!, index: 0, box: true, line: rel(inner.getBoundingClientRect()) };
    }
    for (let i = 0; i < kids.length; i++) {
      const r = kids[i].getBoundingClientRect();
      if (y < r.top + r.height / 2) return { parentId: col.dataset.pbId!, index: i, line: { x: r.left - base.left, y: r.top - base.top - 2, w: r.width, h: 4 } };
    }
    const r = kids[kids.length - 1].getBoundingClientRect();
    return { parentId: col.dataset.pbId!, index: kids.length, line: { x: r.left - base.left, y: r.bottom - base.top - 2, w: r.width, h: 4 } };
  };

  const lv = LEVEL(hit);
  if (lv === 'element') {
    const col = hit.closest<HTMLElement>('[data-pb-level="column"]');
    return col ? intoColumn(col) : null;
  }
  if (lv === 'column') return intoColumn(hit);
  if (lv === 'section') {
    const r = hit.getBoundingClientRect();
    const idx = sections.indexOf(hit);
    // Near the top/bottom edge of a section: start a new section there.
    if (y - r.top < 18) return { parentId: null, index: idx, asSection: true, line: { ...rel(r), y: r.top - base.top - 2, h: 4 } };
    if (r.bottom - y < 18) return { parentId: null, index: idx + 1, asSection: true, line: { ...rel(r), y: r.bottom - base.top - 2, h: 4 } };
    const cols = Array.from(hit.querySelectorAll<HTMLElement>(':scope .pb-row > [data-pb-level="column"]'));
    if (!cols.length) return sectionSlot();
    let best = cols[0], bestD = Infinity;
    for (const c of cols) {
      const cr = c.getBoundingClientRect();
      const d = x < cr.left ? cr.left - x : x > cr.right ? x - cr.right : 0;
      const dy = y < cr.top ? cr.top - y : y > cr.bottom ? y - cr.bottom : 0;
      if (d + dy < bestD) { bestD = d + dy; best = c; }
    }
    return intoColumn(best);
  }
  return sectionSlot();
}
