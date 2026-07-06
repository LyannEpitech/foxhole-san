import { useTranslation } from 'react-i18next';
import { dataset } from '../data';
import { useLocalized } from '../i18n';
import type { Faction, Item, ItemCategory } from '../types/domain';

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

interface Props {
  value: string;
  onChange: (itemId: string) => void;
  faction: Faction;
  /** Restrict the list to some categories (e.g. vehicles only). */
  categories?: ItemCategory[];
  className?: string;
}

/** Faction-filtered item dropdown, grouped by category. */
export function ItemSelect({ value, onChange, faction, categories, className }: Props) {
  const { t } = useTranslation();
  const localized = useLocalized();

  const available = [...dataset.items.values()].filter(
    (item) =>
      (item.faction === 'Both' || item.faction === faction) &&
      (!categories || categories.includes(item.category)),
  );
  const byCategory = new Map<ItemCategory, Item[]>();
  for (const item of available) {
    const bucket = byCategory.get(item.category) ?? [];
    bucket.push(item);
    byCategory.set(item.category, bucket);
  }

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={
        className ??
        'bg-slate-900 border border-slate-600 rounded-md px-3 py-2 text-slate-100'
      }
    >
      <option value="">{t('target.placeholder')}</option>
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
  );
}
