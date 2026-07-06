import { useTranslation } from 'react-i18next';
import { dataset } from '../data';
import { useLocalized } from '../i18n';
import { usePlanStore } from '../store/planStore';
import type { Item, ItemCategory } from '../types/domain';

const CATEGORY_ORDER: ItemCategory[] = [
  'smallArms',
  'heavyArms',
  'utilities',
  'medical',
  'supplies',
  'shippables',
  'vehicles',
  'uniforms',
];

export function TargetSelector() {
  const { t } = useTranslation();
  const localized = useLocalized();
  const { targetId, quantity, faction, setTarget, setQuantity } = usePlanStore();

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

  return (
    <div className="flex flex-wrap items-end gap-4 bg-slate-800/60 border border-slate-700 rounded-xl p-4">
      <label className="flex flex-col gap-1 text-sm text-slate-300 min-w-56 grow">
        {t('target.label')}
        <select
          value={targetId ?? ''}
          onChange={(e) => setTarget(e.target.value || null)}
          className="bg-slate-900 border border-slate-600 rounded-md px-3 py-2 text-slate-100"
        >
          <option value="">{t('target.placeholder')}</option>
          <optgroup label={t('category.materials')}>
            {materials.map((r) => (
              <option key={r.id} value={r.id}>
                {localized(r.name)}
              </option>
            ))}
          </optgroup>
          {CATEGORY_ORDER.filter((c) => byCategory.has(c)).map((category) => (
            <optgroup key={category} label={t(`category.${category}`)}>
              {byCategory.get(category)!.map((item) => (
                <option key={item.id} value={item.id}>
                  {localized(item.name)}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
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
  );
}
