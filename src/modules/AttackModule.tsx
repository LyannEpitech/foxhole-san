import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BuildingList } from '../components/BuildingList';
import { BuildSequence } from '../components/BuildSequence';
import { HexMap } from '../components/HexMap';
import { ItemSelect } from '../components/ItemSelect';
import { Panel } from '../components/Panel';
import { ResourceTotals } from '../components/ResourceTotals';
import { dataset } from '../data';
import { regionName } from '../data/regions';
import { resolveMany, type MultiPlanResult } from '../engine/resolver';
import { useLocalized } from '../i18n';
import { aggregateAttackTargets } from '../lib/attack';
import { useAttackStore } from '../store/attackStore';
import { useLogiStore } from '../store/logiStore';
import { usePlanStore } from '../store/planStore';
import { useUiStore } from '../store/uiStore';

type MarkerMode = 'objective' | 'staging';

export function AttackModule() {
  const { t } = useTranslation();
  const localized = useLocalized();
  const faction = usePlanStore((s) => s.faction);
  const {
    soldiers,
    loadout,
    support,
    objectiveRegion,
    stagingRegion,
    setObjective,
    setStaging,
    setSoldiers,
    addLoadoutRow,
    updateLoadoutRow,
    removeLoadoutRow,
    addSupportRow,
    updateSupportRow,
    removeSupportRow,
    applyDefaultLoadout,
  } = useAttackStore();
  const logi = useLogiStore();
  const setActive = useUiStore((s) => s.setActive);
  const [mode, setMode] = useState<MarkerMode>('objective');

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

  const highlighted = new Map<string, string>();
  if (stagingRegion) highlighted.set(stagingRegion, 'rgba(56,189,248,0.30)');
  if (objectiveRegion) highlighted.set(objectiveRegion, 'rgba(239,68,68,0.35)');

  const markers = [
    ...(stagingRegion ? [{ regionId: stagingRegion, label: '🏕', color: '#38bdf8' }] : []),
    ...(objectiveRegion ? [{ regionId: objectiveRegion, label: '🎯', color: '#ef4444' }] : []),
  ];

  const route = stagingRegion && objectiveRegion ? [stagingRegion, objectiveRegion] : [];

  const onRegionClick = (region: { id: string }) => {
    if (mode === 'objective') {
      setObjective(region.id === objectiveRegion ? null : region.id);
    } else {
      setStaging(region.id === stagingRegion ? null : region.id);
    }
  };

  const sendToLogistics = () => {
    logi.setCargo(targets.map(({ refId, qty }) => ({ itemId: refId, qty })));
    // Seed the logistics route with staging -> objective when both are set.
    if (stagingRegion && objectiveRegion) {
      useLogiStore.setState({ waypoints: [stagingRegion, objectiveRegion] });
    }
    setActive('logistics');
  };

  const inputCls =
    'bg-slate-900 border border-slate-600 rounded-md px-3 py-2 text-slate-100';
  const modeBtn = (m: MarkerMode, active: string) =>
    mode === m
      ? `px-3 py-1.5 rounded-md text-sm font-semibold ${active}`
      : 'px-3 py-1.5 rounded-md text-sm bg-slate-800 text-slate-300 hover:bg-slate-700';

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-3">
        {/* Interactive map — the planning surface */}
        <div className="xl:col-span-2">
          <Panel title={t('attack.plan')}>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <button
                type="button"
                onClick={() => setMode('objective')}
                className={modeBtn('objective', 'bg-red-500/80 text-white')}
              >
                🎯 {t('attack.objective')}
              </button>
              <button
                type="button"
                onClick={() => setMode('staging')}
                className={modeBtn('staging', 'bg-sky-500/80 text-white')}
              >
                🏕 {t('attack.staging')}
              </button>
              {(objectiveRegion || stagingRegion) && (
                <button
                  type="button"
                  onClick={() => {
                    setObjective(null);
                    setStaging(null);
                  }}
                  className="px-3 py-1.5 rounded-md text-sm bg-slate-800 text-slate-400 hover:text-red-300 ml-auto"
                >
                  ✕ {t('attack.clearMarkers')}
                </button>
              )}
            </div>
            <p className="text-xs text-slate-500 mb-2">{t('attack.mapHint')}</p>
            <div className="rounded-lg overflow-hidden border border-slate-700 bg-slate-950">
              <HexMap
                onRegionClick={onRegionClick}
                highlighted={highlighted}
                route={route}
                routeColor="#ef4444"
                markers={markers}
                className="w-full h-[520px] cursor-grab active:cursor-grabbing select-none"
              />
            </div>
            <div className="flex flex-wrap gap-4 mt-3 text-sm">
              <span>
                <span className="text-sky-300">🏕 {t('attack.staging')}:</span>{' '}
                <span className="text-slate-100">
                  {stagingRegion ? regionName(stagingRegion) : '—'}
                </span>
              </span>
              <span>
                <span className="text-red-300">🎯 {t('attack.objective')}:</span>{' '}
                <span className="text-slate-100">
                  {objectiveRegion ? regionName(objectiveRegion) : '—'}
                </span>
              </span>
              {!stagingRegion && !objectiveRegion && (
                <span className="text-slate-500">{t('attack.noMarkers')}</span>
              )}
            </div>
          </Panel>
        </div>

        {/* Forces */}
        <div className="space-y-4">
          <Panel title={t('attack.loadout')}>
            <div className="flex items-end gap-3 mb-4">
              <label className="flex flex-col gap-1 text-sm text-slate-300">
                {t('attack.soldiers')}
                <input
                  type="number"
                  min={1}
                  value={soldiers}
                  onChange={(e) => setSoldiers(Number(e.target.value) || 1)}
                  className={`${inputCls} w-24`}
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
                    className={`${inputCls} grow min-w-0`}
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
                    className={`${inputCls} w-18`}
                  />
                  <button
                    type="button"
                    onClick={() => removeLoadoutRow(i)}
                    className="text-red-400 hover:text-red-300 px-1"
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

          <Panel title={t('attack.support')}>
            <div className="space-y-2">
              {support.map((row, i) => (
                <div key={i} className="flex items-center gap-2">
                  <ItemSelect
                    value={row.itemId}
                    onChange={(itemId) => updateSupportRow(i, { ...row, itemId })}
                    faction={faction}
                    className={`${inputCls} grow min-w-0`}
                  />
                  <input
                    type="number"
                    min={1}
                    value={row.qty}
                    onChange={(e) =>
                      updateSupportRow(i, {
                        ...row,
                        qty: Math.max(1, Number(e.target.value) || 1),
                      })
                    }
                    className={`${inputCls} w-18`}
                  />
                  <button
                    type="button"
                    onClick={() => removeSupportRow(i)}
                    className="text-red-400 hover:text-red-300 px-1"
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
      </div>

      {/* Production cost — secondary, collapsed */}
      {production.error && (
        <div className="border border-red-500/40 bg-red-500/10 text-red-300 rounded-xl p-4 text-sm">
          <strong>{t('error.title')}:</strong> {production.error}
        </div>
      )}
      {production.result && (
        <details className="group">
          <summary className="cursor-pointer text-lg font-semibold text-slate-200 list-none flex items-center gap-2">
            <span className="text-slate-500 transition-transform group-open:rotate-90">▸</span>
            {t('attack.cost')}
          </summary>
          <div className="grid gap-4 md:grid-cols-3 mt-3">
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
        </details>
      )}
    </div>
  );
}
