import { useTranslation } from 'react-i18next';
import { dataset } from '../data';
import { useLocalized } from '../i18n';
import { SearchSelect, type SearchGroup } from './SearchSelect';
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

/** Faction-filtered searchable item picker, grouped by category. */
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

  const groups: SearchGroup[] = CATEGORY_ORDER.filter((c) => byCategory.has(c)).map(
    (category) => ({
      label: t(`category.${category}`),
      options: byCategory
        .get(category)!
        .map((item) => ({ value: item.id, label: localized(item.name) })),
    }),
  );

  return (
    <SearchSelect
      groups={groups}
      value={value}
      onChange={onChange}
      placeholder={t('target.searchPlaceholder')}
      className={className}
    />
  );
}
