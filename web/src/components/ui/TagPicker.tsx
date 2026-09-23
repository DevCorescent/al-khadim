'use client';
/**
 * Multi-select for skills / languages: chips inside the field, a suggestion
 * dropdown as you type, and free text accepted for anything not listed.
 *
 * Keyboard: type to filter, ↑/↓ to move, Enter (or comma) to add, Backspace on
 * an empty input removes the last chip, Esc closes the list.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, X } from 'lucide-react';

interface Props {
  value: string[];
  onChange: (next: string[]) => void;
  /** Suggestion pool. Free text is always allowed on top of these. */
  options: string[];
  placeholder?: string;
  /** Quick-add buttons shown while the field is empty. */
  quickPicks?: string[];
  /** Chip colour. */
  tone?: 'primary' | 'neutral';
  max?: number;
  id?: string;
}

export default function TagPicker({
  value,
  onChange,
  options,
  placeholder = 'Type to search or add…',
  quickPicks = [],
  tone = 'primary',
  max,
  id,
}: Props) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const has = (v: string) => value.some((x) => x.toLowerCase() === v.toLowerCase());
  const atMax = max !== undefined && value.length >= max;

  const suggestions = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const pool = options.filter((o) => !has(o));
    if (!needle) return pool.slice(0, 50);
    const starts: string[] = [];
    const contains: string[] = [];
    for (const o of pool) {
      const l = o.toLowerCase();
      if (l.startsWith(needle)) starts.push(o);
      else if (l.includes(needle)) contains.push(o);
    }
    return [...starts, ...contains].slice(0, 50);
  }, [options, q, value]);

  const typed = q.trim();
  const canAddCustom = !!typed && !options.some((o) => o.toLowerCase() === typed.toLowerCase()) && !has(typed);
  const rows = canAddCustom ? [typed, ...suggestions] : suggestions;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  useEffect(() => setActive(0), [q]);

  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  function add(raw: string) {
    const t = raw.trim();
    if (!t || has(t) || atMax) return;
    onChange([...value, t]);
    setQ('');
    setActive(0);
    inputRef.current?.focus();
  }

  function remove(v: string) {
    onChange(value.filter((x) => x !== v));
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      if (rows[active]) add(rows[active]);
      else if (typed) add(typed);
    } else if (e.key === 'Backspace' && !q && value.length) {
      remove(value[value.length - 1]);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, rows.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  const chip =
    tone === 'primary'
      ? 'bg-primary-50 border-primary-100 text-primary-700'
      : 'bg-gray-100 border-gray-200 text-gray-700';

  return (
    <div ref={wrapRef} className="relative">
      <div
        onClick={() => {
          inputRef.current?.focus();
          setOpen(true);
        }}
        className="w-full min-h-[3rem] flex flex-wrap items-center gap-1.5 border border-gray-200 rounded-xl bg-gray-50 px-2.5 py-2 cursor-text transition-all focus-within:border-primary-400 focus-within:ring-2 focus-within:ring-primary-400/40"
      >
        {value.map((v) => (
          <span
            key={v}
            className={`flex items-center gap-1 border text-xs font-semibold pl-2.5 pr-1.5 py-1 rounded-full ${chip}`}
          >
            {v}
            <button
              type="button"
              aria-label={`Remove ${v}`}
              onClick={(e) => {
                e.stopPropagation();
                remove(v);
              }}
              className="hover:text-red-500 transition-colors"
            >
              <X size={11} />
            </button>
          </span>
        ))}

        <input
          ref={inputRef}
          id={id}
          value={q}
          disabled={atMax}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={atMax ? `Limit of ${max} reached` : value.length ? 'Add another…' : placeholder}
          className="flex-1 min-w-[9rem] bg-transparent px-1.5 py-1 text-sm outline-none placeholder:text-gray-400 disabled:cursor-not-allowed"
        />
      </div>

      {/* Quick picks only while nothing has been chosen — keeps the empty state useful. */}
      {!value.length && quickPicks.length > 0 && !open && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {quickPicks.filter((p) => !has(p)).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => add(p)}
              className="flex items-center gap-1 text-[11px] font-semibold text-gray-500 bg-white border border-gray-200 hover:border-primary-300 hover:text-primary-600 px-2 py-1 rounded-full transition-colors"
            >
              <Plus size={10} /> {p}
            </button>
          ))}
        </div>
      )}

      {open && rows.length > 0 && (
        <div
          ref={listRef}
          className="absolute z-50 mt-1.5 w-full max-h-56 overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-xl shadow-gray-900/10 py-1"
        >
          {rows.map((row, i) => (
            <button
              key={row + i}
              type="button"
              data-active={active === i}
              onMouseEnter={() => setActive(i)}
              onClick={() => add(row)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${
                active === i ? 'bg-primary-50' : ''
              } text-gray-700`}
            >
              {canAddCustom && i === 0 ? (
                <>
                  <Plus size={13} className="text-primary-500 shrink-0" />
                  <span className="truncate">
                    Add <span className="font-semibold">&ldquo;{row}&rdquo;</span>
                  </span>
                </>
              ) : (
                <span className="truncate">{row}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {max !== undefined && value.length > 0 && (
        <p className="text-[11px] text-gray-400 mt-1.5">
          {value.length} of {max} selected
        </p>
      )}
    </div>
  );
}
