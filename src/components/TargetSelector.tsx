import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { dataset } from '../data';
import { useLocalized } from '../i18n';
import { usePlanStore } from '../store/planStore';
import { SearchSelect, type SearchGroup } from './SearchSelect';
import type { Item, ItemCategory } from '../types/domain';

const CATEGORY_ORDER: ItemCategory[] = [
  'smallArms',
  'heavyArms',
  'utilities',
  'medical',
  'supplies',
  'shippables',
  'vehicles',
  'naval',
  'aircraft',
  'trains',
  'uniforms',
];

type CategoryFilter = 'all' | 'materials' | ItemCategory;

/** A1.1 — multi-target production order: one searchable row per article. */
export function TargetSelector() {
  const { t } = useTranslation();
  const localized = useLocalized();
  const { targets, faction, addTarget, updateTarget, removeTarget } = usePlanStore();
  const [filter, setFilter] = useState<CategoryFilter>('all');

  const available = [...dataset.items.values()].filter(
    (item) => item.faction === 'Both' || item.faction === faction,
  );
  const byCategory = new Map<ItemCategory, Item[]>();
  for (const item of available) {
    const bucket = byCategory.get(item.category) ?? [];
    bucket.push(item);
    byCategory.set(item.category, bucket);
  }

  const materials = [...dataset.resources.values()].filter(
    (r) => r.kind === 'refined' && dataset.recipeByOutput.has(r.id),
  );

  const allGroups: (SearchGroup & { key: CategoryFilter })[] = [
    {
      key: 'materials',
      label: t('category.materials'),
      options: materials.map((r) => ({ value: r.id, label: localized(r.name) })),
    },
    ...CATEGORY_ORDER.filter((c) => byCategory.has(c)).map((category) => ({
      key: category as CategoryFilter,
      label: t(`category.${category}`),
      options: byCategory
        .get(category)!
        .map((item) => ({ value: item.id, label: localized(item.name) })),
    })),
  ];
  const groups = filter === 'all' ? allGroups : allGroups.filter((g) => g.key === filter);

  const chip = (key: CategoryFilter, label: string, count: number | null) => (
    <button
      key={key}
      type="button"
      onClick={() => setFilter(key)}
      className={
        filter === key
          ? 'text-xs px-2.5 py-1 rounded-full bg-amber-500 text-slate-900 font-semibold'
          : 'text-xs px-2.5 py-1 rounded-full bg-slate-900 border border-slate-600 text-slate-300 hover:border-amber-400 hover:text-amber-200'
      }
    >
      {label}
      {count !== null && <span className="opacity-60 ml-1">{count}</span>}
    </button>
  );

  return (
    <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4 space-y-3">
      {/* Category filter */}
      <div className="flex flex-wrap gap-1.5">
        {chip('all', t('target.allCategories'), null)}
        {allGroups.map((g) => chip(g.key, g.label, g.options.length))}
      </div>

      {/* Order rows */}
      <div className="space-y-2">
        {targets.map((target, i) => (
          <div key={i} className="flex items-center gap-2">
            <SearchSelect
              groups={groups}
              value={target.refId}
              onChange={(refId) => updateTarget(i, { ...target, refId })}
              placeholder={t('target.searchPlaceholder')}
              className="grow min-w-0"
            />
            <input
              type="number"
              min={1}
              value={target.qty}
              onChange={(e) =>
                updateTarget(i, { ...target, qty: Math.max(1, Number(e.target.value) || 1) })
              }
              className="bg-slate-900 border border-slate-600 rounded-md px-3 py-2 text-slate-100 w-24"
            />
            <button
              type="button"
              onClick={() => removeTarget(i)}
              className="text-red-400 hover:text-red-300 px-1"
              aria-label="remove"
            >
              ✕
            </button>
          </div>
        ))}
        {targets.length === 0 && (
          <>
            <SearchSelect
              groups={groups}
              value=""
              onChange={(refId) => refId && addTarget(refId)}
              placeholder={t('target.searchPlaceholder')}
            />
            <p className="text-xs text-slate-500">{t('target.emptyOrder')}</p>
          </>
        )}
      </div>

      <button
        type="button"
        onClick={() => addTarget('')}
        className="text-sm px-3 py-1.5 rounded-md bg-slate-700 hover:bg-slate-600 text-slate-100"
      >
        + {t('target.addRow')}
      </button>
    </div>
  );
}
