import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { dataset } from '../data';
import { REGIONS } from '../data/regions';
import { useLocalized } from '../i18n';
import { refName } from '../lib/refs';
import { usePlanStore } from '../store/planStore';
import { aggregateStockpiles, useStockpileStore } from '../store/stockpileStore';
import { formatDuration } from './PlanExtras';
import { SearchSelect, type SearchGroup } from './SearchSelect';

function Expiry({ expiresAt }: { expiresAt: number | null }) {
  const { t } = useTranslation();
  if (expiresAt === null) return null;
  const left = expiresAt - Date.now();
  if (left <= 0) return <span className="text-red-400 text-xs">{t('stockpiles.expired')}</span>;
  const cls = left < 6 * 3600 * 1000 ? 'text-red-300' : left < 12 * 3600 * 1000 ? 'text-yellow-300' : 'text-slate-400';
  return <span className={`text-xs ${cls}`}>⏳ {formatDuration(left / 1000)}</span>;
}

/** B1 — manual stockpile tracker: locations, contents, 50 h reservation
    timers, and one-click deduction into the production plan stock. */
export function StockpilePanel() {
  const { t } = useTranslation();
  const localized = useLocalized();
  const { stockpiles, add, remove, setRegion, setItem, refreshTimer } = useStockpileStore();
  const setStockBulk = usePlanStore((s) => s.setStockBulk);
  const faction = usePlanStore((s) => s.faction);
  const [name, setName] = useState('');

  const groups: SearchGroup[] = [
    {
      label: t('category.materials'),
      options: [...dataset.resources.values()].map((r) => ({ value: r.id, label: localized(r.name) })),
    },
    {
      label: t('stock.items'),
      options: [...dataset.items.values()]
        .filter((i) => i.faction === 'Both' || i.faction === faction)
        .map((i) => ({ value: i.id, label: localized(i.name) })),
    },
  ];

  return (
    <div className="space-y-3 text-sm">
      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('stockpiles.namePlaceholder')}
          className="grow min-w-0 bg-slate-900 border border-slate-600 rounded-md px-3 py-1.5 text-slate-100"
        />
        <button
          type="button"
          disabled={!name.trim()}
          onClick={() => { add(name.trim()); setName(''); }}
          className="px-3 py-1.5 rounded-md bg-slate-700 hover:bg-slate-600 text-slate-100 disabled:opacity-40"
        >
          + {t('stockpiles.add')}
        </button>
      </div>

      {stockpiles.map((p) => (
        <div key={p.id} className="border border-slate-700 rounded-lg p-3 bg-slate-900/40 space-y-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-100 grow truncate">{p.name}</span>
            <Expiry expiresAt={p.expiresAt} />
            <button
              type="button"
              onClick={() => refreshTimer(p.id)}
              title={t('stockpiles.refreshHint')}
              className="text-xs px-2 py-0.5 rounded bg-slate-700 hover:bg-slate-600 text-slate-100"
            >
              ⟳ 50h
            </button>
            <button type="button" onClick={() => remove(p.id)} className="text-red-400 hover:text-red-300" aria-label="delete">✕</button>
          </div>
          <select
            value={p.regionId ?? ''}
            onChange={(e) => setRegion(p.id, e.target.value || null)}
            className="w-full bg-slate-900 border border-slate-600 rounded-md px-2 py-1.5 text-xs text-slate-100"
          >
            <option value="">{t('stockpiles.noRegion')}</option>
            {REGIONS.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
          {Object.entries(p.items).map(([refId, qty]) => (
            <div key={refId} className="flex items-center gap-2">
              <span className="grow text-slate-200 truncate">{localized(refName(refId))}</span>
              <input
                type="number" min={0} value={qty}
                onChange={(e) => setItem(p.id, refId, Math.max(0, Number(e.target.value) || 0))}
                className="bg-slate-900 border border-slate-600 rounded-md px-2 py-1 text-slate-100 w-24 text-xs"
              />
              <button type="button" onClick={() => setItem(p.id, refId, 0)} className="text-red-400 hover:text-red-300" aria-label="remove">✕</button>
            </div>
          ))}
          <SearchSelect
            groups={groups}
            value=""
            onChange={(refId) => refId && setItem(p.id, refId, p.items[refId] ?? 100)}
            placeholder={t('stock.add')}
          />
        </div>
      ))}

      {stockpiles.length > 0 && (
        <button
          type="button"
          onClick={() => setStockBulk(aggregateStockpiles(stockpiles))}
          className="w-full px-3 py-2 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
        >
          📦 {t('stockpiles.useAsStock')}
        </button>
      )}
      {stockpiles.length === 0 && <p className="text-xs text-slate-500">{t('stockpiles.empty')}</p>}
    </div>
  );
}
