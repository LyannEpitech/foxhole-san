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

export function TargetSelector() {
  const { t } = useTranslation();
  const localized = useLocalized();
  const { targetId, quantity, faction, setTarget, setQuantity } = usePlanStore();
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

  // Producible refined resources (bmats, diesel, cmats…) are valid targets too.
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

      <div className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1 text-sm text-slate-300 min-w-56 grow">
          {t('target.label')}
          <SearchSelect
            groups={groups}
            value={targetId ?? ''}
            onChange={(v) => setTarget(v || null)}
            placeholder={t('target.searchPlaceholder')}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-slate-300">
          {t('target.quantity')}
          <input
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
            className="bg-slate-900 border border-slate-600 rounded-md px-3 py-2 text-slate-100 w-28"
          />
        </label>
      </div>
    </div>
  );
}
