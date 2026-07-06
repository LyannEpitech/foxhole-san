import { useTranslation } from 'react-i18next';
import type { PlanSummary } from '../engine/resolver';
import { useLocalized } from '../i18n';
import { refName } from '../lib/refs';

function TotalsBlock({ title, totals }: { title: string; totals: Record<string, number> }) {
  const { t } = useTranslation();
  const localized = useLocalized();
  const entries = Object.entries(totals);

  return (
    <div>
      <h3 className="text-xs uppercase tracking-wide text-slate-400 mb-2">{title}</h3>
      {entries.length === 0 ? (
        <p className="text-sm text-slate-500">{t('totals.empty')}</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {entries.map(([refId, qty]) => (
            <li key={refId} className="flex justify-between gap-4">
              <span className="text-slate-200">{localized(refName(refId))}</span>
              <span className="font-mono text-amber-300">{qty}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ResourceTotals({ result }: { result: PlanSummary }) {
  const { t } = useTranslation();
  const localized = useLocalized();
  const stockEntries = Object.entries(result.stockUsed);
  return (
    <div className="space-y-4">
      <TotalsBlock title={t('totals.raw')} totals={result.totals.raw} />
      <TotalsBlock title={t('totals.refined')} totals={result.totals.refined} />
      {stockEntries.length > 0 && (
        <div>
          <h3 className="text-xs uppercase tracking-wide text-emerald-400 mb-2">
            {t('totals.fromStock')}
          </h3>
          <ul className="space-y-1 text-sm">
            {stockEntries.map(([refId, qty]) => (
              <li key={refId} className="flex justify-between gap-4">
                <span className="text-slate-300">{localized(refName(refId))}</span>
                <span className="font-mono text-emerald-300">− {qty}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
