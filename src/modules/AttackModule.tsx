import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { BuildingList } from '../components/BuildingList';
import { BuildSequence } from '../components/BuildSequence';
import { ItemSelect } from '../components/ItemSelect';
import { Panel } from '../components/Panel';
import { ResourceTotals } from '../components/ResourceTotals';
import { dataset } from '../data';
import { resolveMany, type MultiPlanResult } from '../engine/resolver';
import { useLocalized } from '../i18n';
import { aggregateAttackTargets } from '../lib/attack';
import { useAttackStore } from '../store/attackStore';
import { useLogiStore } from '../store/logiStore';
import { usePlanStore } from '../store/planStore';
import { useUiStore } from '../store/uiStore';

export function AttackModule() {
  const { t } = useTranslation();
  const localized = useLocalized();
  const faction = usePlanStore((s) => s.faction);
  const {
    soldiers,
    loadout,
    support,
    setSoldiers,
    addLoadoutRow,
    updateLoadoutRow,
    removeLoadoutRow,
    addSupportRow,
    updateSupportRow,
    removeSupportRow,
    applyDefaultLoadout,
  } = useAttackStore();
  const setCargo = useLogiStore((s) => s.setCargo);
  const setActive = useUiStore((s) => s.setActive);

  const targets = useMemo(
    () => aggregateAttackTargets(dataset, faction, soldiers, loadout, support),
    [faction, soldiers, loadout, support],
  );

  const production: { result: MultiPlanResult | null; error: string | null } = useMemo(() => {
    if (targets.length === 0) return { result: null, error: null };
    try {
      return { result: resolveMany(dataset, targets, faction), error: null };
    } catch (e) {
      return { result: null, error: e instanceof Error ? e.message : String(e) };
    }
  }, [targets, faction]);

  const inputCls =
    'bg-slate-900 border border-slate-600 rounded-md px-3 py-2 text-slate-100';

  const sendToLogistics = () => {
    setCargo(targets.map(({ refId, qty }) => ({ itemId: refId, qty })));
    setActive('logistics');
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Headcount + loadout */}
        <Panel title={t('attack.loadout')}>
          <div className="flex items-end gap-3 mb-4">
            <label className="flex flex-col gap-1 text-sm text-slate-300">
              {t('attack.soldiers')}
              <input
                type="number"
                min={1}
                value={soldiers}
                onChange={(e) => setSoldiers(Number(e.target.value) || 1)}
                className={`${inputCls} w-28`}
              />
            </label>
            <button
              type="button"
              onClick={() => applyDefaultLoadout(faction)}
              className="text-sm px-3 py-2 rounded-md bg-slate-700 hover:bg-slate-600 text-slate-100"
            >
              {t('attack.applyDefault')}
            </button>
          </div>
          {loadout.length === 0 && (
            <p className="text-sm text-slate-500 mb-3">{t('attack.emptyLoadout')}</p>
          )}
          <div className="space-y-2">
            {loadout.map((row, i) => (
              <div key={i} className="flex items-center gap-2">
                <ItemSelect
                  value={row.itemId}
                  onChange={(itemId) => updateLoadoutRow(i, { ...row, itemId })}
                  faction={faction}
                  className={`${inputCls} grow`}
                />
                <input
                  type="number"
                  min={1}
                  value={row.perSoldier}
                  onChange={(e) =>
                    updateLoadoutRow(i, {
                      ...row,
                      perSoldier: Math.max(1, Number(e.target.value) || 1),
                    })
                  }
                  className={`${inputCls} w-24`}
                />
                <span className="text-xs text-slate-400 shrink-0">{t('attack.perSoldier')}</span>
                <button
                  type="button"
                  onClick={() => removeLoadoutRow(i)}
                  className="text-red-400 hover:text-red-300 px-2"
                  aria-label="remove"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addLoadoutRow}
            className="mt-3 text-sm px-3 py-1.5 rounded-md bg-slate-700 hover:bg-slate-600 text-slate-100"
          >
            + {t('attack.addRow')}
          </button>
        </Panel>

        {/* Support + operation totals */}
        <Panel title={t('attack.support')}>
          <div className="space-y-2">
            {support.map((row, i) => (
              <div key={i} className="flex items-center gap-2">
                <ItemSelect
                  value={row.itemId}
                  onChange={(itemId) => updateSupportRow(i, { ...row, itemId })}
                  faction={faction}
                  className={`${inputCls} grow`}
                />
                <input
                  type="number"
                  min={1}
                  value={row.qty}
                  onChange={(e) =>
                    updateSupportRow(i, { ...row, qty: Math.max(1, Number(e.target.value) || 1) })
                  }
                  className={`${inputCls} w-24`}
                />
                <button
                  type="button"
                  onClick={() => removeSupportRow(i)}
                  className="text-red-400 hover:text-red-300 px-2"
                  aria-label="remove"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addSupportRow}
            className="mt-3 text-sm px-3 py-1.5 rounded-md bg-slate-700 hover:bg-slate-600 text-slate-100"
          >
            + {t('attack.addRow')}
          </button>

          {targets.length > 0 && (
            <>
              <h3 className="text-xs uppercase tracking-wide text-slate-400 mt-5 mb-2">
                {t('attack.totalNeeds')}
              </h3>
              <ul className="space-y-1 text-sm">
                {targets.map(({ refId, qty }) => (
                  <li key={refId} className="flex justify-between gap-4">
                    <span className="text-slate-200">
                      {localized(dataset.items.get(refId)!.name)}
                    </span>
                    <span className="font-mono text-amber-300">{qty}</span>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={sendToLogistics}
                className="mt-4 text-sm px-3 py-2 rounded-md bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold"
              >
                {t('attack.sendToLogistics')} →
              </button>
            </>
          )}
        </Panel>
      </div>

      {production.error && (
        <div className="border border-red-500/40 bg-red-500/10 text-red-300 rounded-xl p-4 text-sm">
          <strong>{t('error.title')}:</strong> {production.error}
        </div>
      )}
      {production.result && (
        <>
          <h2 className="text-lg font-semibold text-slate-200">{t('attack.cost')}</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <Panel title={t('panels.totals')}>
              <ResourceTotals result={production.result} />
            </Panel>
            <Panel title={t('panels.buildings')}>
              <BuildingList result={production.result} />
            </Panel>
            <Panel title={t('panels.sequence')}>
              <BuildSequence result={production.result} />
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}
