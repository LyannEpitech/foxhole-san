import { useTranslation } from 'react-i18next';
import { dataset } from '../data';
import type { PlanTarget } from '../engine/resolver';
import { useLocalized } from '../i18n';
import { mpfQuote } from '../lib/mpf';
import { costEntries, refName } from '../lib/refs';
import type { MaterialCost } from '../types/domain';

function Cost({ cost }: { cost: MaterialCost }) {
  const localized = useLocalized();
  const entries = costEntries(cost);
  if (entries.length === 0) return <span className="text-slate-500">—</span>;
  return (
    <span className="font-mono">
      {entries.map(([refId, qty]) => `${qty} ${localized(refName(refId))}`).join(' + ')}
    </span>
  );
}

/**
 * B7 — Factory vs MPF cost per targeted article (queue discount included),
 * with the crate split into successive MPF orders.
 */
export function MpfComparison({ targets }: { targets: PlanTarget[] }) {
  const { t } = useTranslation();
  const localized = useLocalized();

  const rows = targets
    .map((target) => {
      const item = dataset.items.get(target.refId);
      if (!item?.isMfpCraftable || costEntries(item.cost).length === 0) return null;
      const crates = Math.ceil(target.qty / item.amountProduced);
      return { item, crates, quote: mpfQuote(item, crates) };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  if (rows.length === 0) {
    return <p className="text-sm text-slate-500">{t('mpf.none')}</p>;
  }

  return (
    <div className="space-y-3 text-sm">
      {rows.map(({ item, crates, quote }) => (
        <div key={item.id} className="border border-slate-700 rounded-lg p-3 bg-slate-900/40">
          <div className="flex justify-between gap-2">
            <span className="font-semibold text-slate-100">{localized(item.name)}</span>
            <span className="text-xs text-slate-400">
              {crates} {t('logi.crates')} · {t('mpf.orders')}: {quote.orders.join(' + ')}
            </span>
          </div>
          <div className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
            <span className="text-slate-400">{t('mpf.factory')}</span>
            <span className="text-slate-200"><Cost cost={quote.factoryCost} /></span>
            <span className="text-slate-400">{t('mpf.mpf')}</span>
            <span className="text-amber-300"><Cost cost={quote.mpfCost} /></span>
            <span className="text-slate-400">{t('mpf.savings')}</span>
            <span className="text-emerald-300">
              <Cost cost={quote.savings} />{' '}
              <span className="text-xs">(−{Math.round(quote.discount * 100)} %)</span>
            </span>
          </div>
        </div>
      ))}
      <p className="text-xs text-slate-500">{t('mpf.note')}</p>
    </div>
  );
}
