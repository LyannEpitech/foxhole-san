import { useTranslation } from 'react-i18next';
import { dataset } from '../data';
import { useLocalized } from '../i18n';
import { refName } from '../lib/refs';
import { usePlanStore } from '../store/planStore';
import { SearchSelect, type SearchGroup } from './SearchSelect';

/**
 * A1.2 — declared on-hand stock: quantities deducted from the plan before
 * batches are computed. Covers resources (raw + refined) and items.
 */
export function StockPanel() {
  const { t } = useTranslation();
  const localized = useLocalized();
  const { stock, faction, setStock, removeStock } = usePlanStore();

  const groups: SearchGroup[] = [
    {
      label: t('category.materials'),
      options: [...dataset.resources.values()].map((r) => ({
        value: r.id,
        label: localized(r.name),
      })),
    },
    {
      label: t('stock.items'),
      options: [...dataset.items.values()]
        .filter((i) => i.faction === 'Both' || i.faction === faction)
        .map((i) => ({ value: i.id, label: localized(i.name) })),
    },
  ];

  const entries = Object.entries(stock);

  return (
    <div className="space-y-2">
      {entries.length === 0 && <p className="text-sm text-slate-500">{t('stock.empty')}</p>}
      {entries.map(([refId, qty]) => (
        <div key={refId} className="flex items-center gap-2 text-sm">
          <span className="grow text-slate-200 truncate">{localized(refName(refId))}</span>
          <input
            type="number"
            min={0}
            value={qty}
            onChange={(e) => setStock(refId, Math.max(0, Number(e.target.value) || 0))}
            className="bg-slate-900 border border-slate-600 rounded-md px-3 py-1.5 text-slate-100 w-28"
          />
          <button
            type="button"
            onClick={() => removeStock(refId)}
            className="text-red-400 hover:text-red-300 px-1"
            aria-label="remove"
          >
            ✕
          </button>
        </div>
      ))}
      <div className="flex items-center gap-2">
        <SearchSelect
          groups={groups}
          value=""
          onChange={(refId) => refId && setStock(refId, stock[refId] ?? 100)}
          placeholder={t('stock.add')}
          className="grow min-w-0"
        />
      </div>
    </div>
  );
}
