import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

export interface SearchOption {
  value: string;
  label: string;
}

export interface SearchGroup {
  label: string;
  options: SearchOption[];
}

interface Props {
  groups: SearchGroup[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

/** Accent- and case-insensitive normalization for matching. */
function fold(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

/**
 * Searchable dropdown (combobox): type to filter the grouped options,
 * navigate with ↑/↓, confirm with Enter, close with Escape.
 */
export function SearchSelect({ groups, value, onChange, placeholder, className }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selectedLabel = useMemo(() => {
    for (const g of groups) {
      const hit = g.options.find((o) => o.value === value);
      if (hit) return hit.label;
    }
    return '';
  }, [groups, value]);

  const filtered = useMemo(() => {
    const q = fold(query.trim());
    if (!q) return groups;
    return groups
      .map((g) => ({ ...g, options: g.options.filter((o) => fold(o.label).includes(q)) }))
      .filter((g) => g.options.length > 0);
  }, [groups, query]);

  const flat = useMemo(() => filtered.flatMap((g) => g.options), [filtered]);
  // Global option index per group, precomputed so render stays pure.
  const groupStartIndex = useMemo(() => {
    const starts: number[] = [];
    let acc = 0;
    for (const g of filtered) {
      starts.push(acc);
      acc += g.options.length;
    }
    return starts;
  }, [filtered]);

  // Close on outside click.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  // Keep the cursor row visible.
  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${cursor}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  const pick = (v: string) => {
    onChange(v);
    setOpen(false);
    setQuery('');
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      setOpen(true);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setCursor((c) => Math.min(c + 1, flat.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (flat[cursor]) pick(flat[cursor].value);
    } else if (e.key === 'Escape') {
      setOpen(false);
      setQuery('');
    }
  };

  return (
    <div ref={rootRef} className={`relative ${className ?? ''}`}>
      <input
        type="text"
        role="combobox"
        aria-expanded={open}
        value={open ? query : selectedLabel}
        placeholder={placeholder ?? t('search.placeholder')}
        onFocus={() => {
          setOpen(true);
          setQuery('');
          setCursor(0);
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setCursor(0);
          if (!open) setOpen(true);
        }}
        onKeyDown={onKeyDown}
        className="w-full bg-slate-900 border border-slate-600 rounded-md px-3 py-2 text-slate-100
          placeholder:text-slate-500 focus:border-amber-400 focus:outline-none"
      />
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs">
        {open ? '🔎' : '▾'}
      </span>

      {open && (
        <div
          ref={listRef}
          className="absolute z-30 mt-1 w-full max-h-72 overflow-y-auto rounded-lg border
            border-slate-600 bg-slate-900 shadow-2xl"
        >
          {flat.length === 0 && (
            <p className="px-3 py-2 text-sm text-slate-500">{t('search.noResults')}</p>
          )}
          {filtered.map((group, gi) => (
            <div key={group.label}>
              <div className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500 sticky top-0 bg-slate-900">
                {group.label}
              </div>
              {group.options.map((option, oi) => {
                const i = groupStartIndex[gi] + oi;
                return (
                  <button
                    key={option.value}
                    type="button"
                    data-index={i}
                    onMouseEnter={() => setCursor(i)}
                    onClick={() => pick(option.value)}
                    className={`block w-full text-left px-3 py-1.5 text-sm ${
                      i === cursor
                        ? 'bg-amber-500/20 text-amber-200'
                        : option.value === value
                          ? 'text-amber-300'
                          : 'text-slate-200'
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
