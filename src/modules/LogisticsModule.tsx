import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BuildingList } from '../components/BuildingList';
import { BuildSequence } from '../components/BuildSequence';
import { ItemSelect } from '../components/ItemSelect';
import { Panel } from '../components/Panel';
import { ResourceTotals } from '../components/ResourceTotals';
import { dataset, vehicles } from '../data';
import { resolveMany, type MultiPlanResult } from '../engine/resolver';
import { useLocalized } from '../i18n';
import { planCargo } from '../lib/logistics';
import { REGIONS, regionName } from '../data/regions';
import { useLogiStore } from '../store/logiStore';
import { usePlanStore } from '../store/planStore';

export function LogisticsModule() {
  const { t } = useTranslation();
  const localized = useLocalized();
  const faction = usePlanStore((s) => s.faction);
  const {
    cargo,
    vehicleItemId,
    waypoints,
    addCargoRow,
    updateCargoRow,
    removeCargoRow,
    setVehicle,
    addWaypoint,
    removeWaypoint,
    moveWaypoint,
  } = useLogiStore();
  const [pendingRegion, setPendingRegion] = useState('');

  const factionVehicles = vehicles.filter((v) => {
    const item = dataset.items.get(v.itemId)!;
    return item.faction === 'Both' || item.faction === faction;
  });
  const vehicle = factionVehicles.find((v) => v.itemId === vehicleItemId);

  const cargoPlan = planCargo(dataset, cargo, vehicle);

  const production: { result: MultiPlanResult | null; error: string | null } = useMemo(() => {
    const targets = cargoPlan.rows.map((r) => ({ refId: r.itemId, qty: r.qty }));
    if (targets.length === 0) return { result: null, error: null };
    try {
      return { result: resolveMany(dataset, targets, faction), error: null };
    } catch (e) {
      return { result: null, error: e instanceof Error ? e.message : String(e) };
    }
  }, [cargoPlan.rows, faction]);

  const inputCls =
    'bg-slate-900 border border-slate-600 rounded-md px-3 py-2 text-slate-100';

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Cargo manifest */}
        <Panel title={t('logi.cargo')}>
          {cargo.length === 0 && (
            <p className="text-sm text-slate-500 mb-3">{t('logi.emptyCargo')}</p>
          )}
          <div className="space-y-2">
            {cargo.map((row, i) => {
              const item = dataset.items.get(row.itemId);
              const crates = item ? Math.ceil(row.qty / item.amountProduced) : null;
              return (
                <div key={i} className="flex items-center gap-2">
                  <ItemSelect
                    value={row.itemId}
                    onChange={(itemId) => updateCargoRow(i, { ...row, itemId })}
                    faction={faction}
                    className={`${inputCls} grow`}
                  />
                  <input
                    type="number"
                    min={1}
                    value={row.qty}
                    onChange={(e) =>
                      updateCargoRow(i, { ...row, qty: Math.max(1, Number(e.target.value) || 1) })
                    }
                    className={`${inputCls} w-24`}
                  />
                  {crates !== null && (
                    <span className="text-xs text-slate-400 w-20 shrink-0">
                      {crates} {t('logi.crates')}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => removeCargoRow(i)}
                    className="text-red-400 hover:text-red-300 px-2"
                    aria-label="remove"
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
          <button
            type="button"
            onClick={addCargoRow}
            className="mt-3 text-sm px-3 py-1.5 rounded-md bg-slate-700 hover:bg-slate-600 text-slate-100"
          >
            + {t('logi.addRow')}
          </button>
        </Panel>

        {/* Vehicle + trips */}
        <Panel title={t('logi.vehicle')}>
          <select
            value={vehicleItemId ?? ''}
            onChange={(e) => setVehicle(e.target.value || null)}
            className={`${inputCls} w-full`}
          >
            <option value="">{t('logi.noVehicle')}</option>
            {factionVehicles.map((v) => {
              const item = dataset.items.get(v.itemId)!;
              return (
                <option key={v.itemId} value={v.itemId}>
                  {localized(item.name)} — {t('logi.capacity', { count: v.capacityCrates })}
                </option>
              );
            })}
          </select>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-300">{t('logi.totalCrates')}</dt>
              <dd className="font-mono text-amber-300">{cargoPlan.totalCrates}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-300">{t('logi.trips')}</dt>
              <dd className="font-mono text-amber-300">{cargoPlan.trips ?? '—'}</dd>
            </div>
          </dl>
        </Panel>
      </div>

      {/* Route */}
      <Panel title={t('logi.route')}>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <select
            value={pendingRegion}
            onChange={(e) => setPendingRegion(e.target.value)}
            className={inputCls}
          >
            <option value="">{t('logi.addWaypoint')}</option>
            {REGIONS.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!pendingRegion}
            onClick={() => {
              if (pendingRegion) {
                addWaypoint(pendingRegion);
                setPendingRegion('');
              }
            }}
            className="text-sm px-3 py-1.5 rounded-md bg-slate-700 hover:bg-slate-600 text-slate-100 disabled:opacity-40"
          >
            +
          </button>
        </div>
        {waypoints.length === 0 ? (
          <p className="text-sm text-slate-500">{t('logi.emptyRoute')}</p>
        ) : (
          <ol className="flex flex-wrap items-center gap-2 text-sm">
            {waypoints.map((regionId, i) => (
              <li
                key={`${regionId}-${i}`}
                className="flex items-center gap-1 bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-1.5"
              >
                <span className="font-mono text-slate-500">{i + 1}.</span>
                <span className="text-slate-100">{regionName(regionId)}</span>
                <button
                  type="button"
                  onClick={() => moveWaypoint(i, -1)}
                  className="text-slate-400 hover:text-slate-200 px-1"
                  aria-label="up"
                >
                  ←
                </button>
                <button
                  type="button"
                  onClick={() => moveWaypoint(i, 1)}
                  className="text-slate-400 hover:text-slate-200 px-1"
                  aria-label="down"
                >
                  →
                </button>
                <button
                  type="button"
                  onClick={() => removeWaypoint(i)}
                  className="text-red-400 hover:text-red-300 px-1"
                  aria-label="remove"
                >
                  ✕
                </button>
                {i < waypoints.length - 1 && <span className="text-slate-500 ml-1">→</span>}
              </li>
            ))}
          </ol>
        )}
      </Panel>

      {/* Production cost of the cargo */}
      {production.error && (
        <div className="border border-red-500/40 bg-red-500/10 text-red-300 rounded-xl p-4 text-sm">
          <strong>{t('error.title')}:</strong> {production.error}
        </div>
      )}
      {production.result && (
        <>
          <h2 className="text-lg font-semibold text-slate-200">{t('logi.produceCargo')}</h2>
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
