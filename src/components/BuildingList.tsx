import { useTranslation } from 'react-i18next';
import type { PlanSummary } from '../engine/resolver';
import { useLocalized } from '../i18n';
import { costEntries, refName } from '../lib/refs';
import type { MaterialCost } from '../types/domain';

function Cost({ cost }: { cost: MaterialCost }) {
  const localized = useLocalized();
  const entries = costEntries(cost);
  if (entries.length === 0) return <span className="text-slate-500">—</span>;
  return (
    <span className="font-mono text-amber-300">
      {entries.map(([refId, qty]) => `${qty} ${localized(refName(refId))}`).join(' + ')}
    </span>
  );
}

export function BuildingList({ result }: { result: PlanSummary }) {
  const { t } = useTranslation();
  const localized = useLocalized();

  if (result.buildings.length === 0) {
    return <p className="text-sm text-slate-500">{t('buildings.none')}</p>;
  }

  return (
    <div className="space-y-3 text-sm">
      {result.buildings.map((b) => (
        <div key={b.id} className="border border-slate-700 rounded-lg p-3 bg-slate-900/40">
          <div className="font-semibold text-slate-100">{localized(b.name)}</div>
          <div className="text-slate-400">
            {t('buildings.construction')}: <Cost cost={b.constructionCost} />
          </div>
          {b.prerequisites.length > 0 && (
            <div className="text-slate-400">
              {t('buildings.prerequisites')}:{' '}
              <span className="text-sky-300">
                {b.prerequisites.map((p) => localized(p.name)).join(', ')}
              </span>
            </div>
          )}
        </div>
      ))}
      <div className="flex justify-between border-t border-slate-700 pt-2">
        <span className="text-slate-300">{t('buildings.total')}</span>
        <Cost cost={result.constructionTotal} />
      </div>
    </div>
  );
}
