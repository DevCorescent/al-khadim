'use client';
/**
 * Searchable single-select dropdown, styled to match the `.input` class.
 *
 * Keyboard: type to filter, ↑/↓ to move, Enter to pick, Esc to close.
 * With `allowCustom`, whatever has been typed can be committed as-is, so a
 * candidate whose city or nationality isn't listed is never blocked.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';

export interface SelectOption {
  value: string;
  label?: string;
  /** Secondary text shown to the right of the label. */
  hint?: string;
  /** Emoji or short string shown before the label. */
  icon?: string;
  /** Listed above the divider. */
  priority?: boolean;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  /** Let the user commit free text that isn't in `options`. */
  allowCustom?: boolean;
  /** Show a clear (×) button once something is selected. */
  clearable?: boolean;
  id?: string;
  disabled?: boolean;
}

export default function SearchSelect({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  searchPlaceholder = 'Search…',
  allowCustom = false,
  clearable = true,
  id,
  disabled,
}: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);
  const labelOf = (o: SelectOption) => o.label ?? o.value;

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return options;
    return options.filter(
      (o) =>
        labelOf(o).toLowerCase().includes(needle) ||
        o.value.toLowerCase().includes(needle) ||
        (o.hint ?? '').toLowerCase().includes(needle),
    );
  }, [options, q]);

  // Offer the typed text when it isn't already an option.
  const custom =
    allowCustom && q.trim() && !options.some((o) => labelOf(o).toLowerCase() === q.trim().toLowerCase())
      ? q.trim()
      : null;

  const rows: (SelectOption | { custom: string })[] = custom
    ? [{ custom }, ...filtered]
    : filtered;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  useEffect(() => {
    if (open) {
      setQ('');
      setActive(0);
      // Let the panel mount before focusing, so the caret lands in the search box.
      requestAnimationFrame(() => searchRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [active, q]);

  function commit(row: (typeof rows)[number]) {
    onChange('custom' in row ? row.custom : row.value);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, rows.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (rows[active]) commit(rows[active]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    }
  }

  // Index of the first non-priority row, so the divider is drawn once.
  const firstRest = rows.findIndex((r) => !('custom' in r) && !r.priority);
  const hasPriority = rows.some((r) => !('custom' in r) && r.priority);

  return (
    <div ref={wrapRef} className="relative">
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={`input flex items-center gap-2 text-left ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'} ${
          open ? 'ring-2 ring-primary-400/40 border-primary-400' : ''
        }`}
      >
        {selected?.icon && <span className="text-base leading-none shrink-0">{selected.icon}</span>}
        <span className={`flex-1 truncate ${value ? 'text-gray-900' : 'text-gray-400'}`}>
          {selected ? labelOf(selected) : value || placeholder}
        </span>
        {clearable && value && !disabled && (
          <span
            role="button"
            tabIndex={-1}
            aria-label="Clear"
            onClick={(e) => {
              e.stopPropagation();
              onChange('');
            }}
            className="text-gray-300 hover:text-red-500 transition-colors shrink-0"
          >
            <X size={14} />
          </span>
        )}
        <ChevronDown
          size={15}
          className={`text-gray-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="absolute z-50 mt-1.5 w-full bg-white border border-gray-200 rounded-xl shadow-xl shadow-gray-900/10 overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-100 bg-gray-50/60">
            <Search size={14} className="text-gray-400 shrink-0" />
            <input
              ref={searchRef}
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setActive(0);
              }}
              onKeyDown={onKeyDown}
              placeholder={searchPlaceholder}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400"
            />
          </div>

          <div ref={listRef} className="max-h-60 overflow-y-auto py-1">
            {rows.length === 0 && (
              <p className="px-3 py-6 text-center text-xs text-gray-400">No matches</p>
            )}

            {rows.map((row, i) => {
              const isCustom = 'custom' in row;
              const key = isCustom ? `__custom_${row.custom}` : row.value + i;
              const text = isCustom ? row.custom : labelOf(row);
              const isSel = !isCustom && row.value === value;
              const divider = hasPriority && !isCustom && i === firstRest && firstRest > 0;

              return (
                <div key={key}>
                  {divider && <div className="my-1 border-t border-gray-100" />}
                  <button
                    type="button"
                    data-active={active === i}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => commit(row)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors ${
                      active === i ? 'bg-primary-50' : ''
                    } ${isSel ? 'font-semibold text-primary-700' : 'text-gray-700'}`}
                  >
                    {!isCustom && row.icon && (
                      <span className="text-base leading-none shrink-0">{row.icon}</span>
                    )}
                    <span className="flex-1 truncate">
                      {isCustom ? (
                        <>
                          Use <span className="font-semibold">&ldquo;{text}&rdquo;</span>
                        </>
                      ) : (
                        text
                      )}
                    </span>
                    {!isCustom && row.hint && (
                      <span className="text-[11px] text-gray-400 shrink-0">{row.hint}</span>
                    )}
                    {isSel && <Check size={14} className="text-primary-500 shrink-0" />}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
