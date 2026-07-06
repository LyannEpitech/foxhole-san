import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { BuildingList } from '../components/BuildingList';
import { BuildSequence } from '../components/BuildSequence';
import { Drawer } from '../components/Drawer';
import { ItemSelect } from '../components/ItemSelect';
import { PlanMap } from '../components/PlanMap';
import { ResourceTotals } from '../components/ResourceTotals';
import { dataset, vehicles } from '../data';
import { regionName } from '../data/regions';
import { resolveMany, type MultiPlanResult } from '../engine/resolver';
import { useLocalized } from '../i18n';
import { planCargo } from '../lib/logistics';
import { useLogiStore } from '../store/logiStore';
import { usePlanStore } from '../store/planStore';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
        {title}
      </h3>
      {children}
    </section>
  );
}

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

  // Highlight route regions; number the stops on the map.
  const highlighted = new Map<string, string>();
  for (const id of waypoints) highlighted.set(id, 'rgba(245,158,11,0.28)');
  const markers = waypoints.map((regionId, i) => ({
    regionId,
    label: String(i + 1),
    color: '#f59e0b',
  }));

  const inputCls = 'bg-slate-900 border border-slate-600 rounded-md px-3 py-2 text-slate-100';

  return (
    <div className="relative h-[calc(100vh-7.25rem)] overflow-hidden">
      <PlanMap
        onRegionClick={(region) => addWaypoint(region.id)}
        highlighted={highlighted}
        route={waypoints}
        markers={markers}
      />

      <Drawer title={t('nav.logistics')}>
        <p className="text-xs text-slate-500">{t('logi.mapHint')}</p>

        {/* Route */}
        <Section title={t('logi.route')}>
          {waypoints.length === 0 ? (
            <p className="text-sm text-slate-500">{t('logi.emptyRoute')}</p>
          ) : (
            <ol className="space-y-1.5 text-sm">
              {waypoints.map((regionId, i) => (
                <li
                  key={`${regionId}-${i}`}
                  className="flex items-center gap-2 bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-1.5"
                >
                  <span className="font-mono text-amber-400 w-5">{i + 1}.</span>
                  <span className="text-slate-100 grow">{regionName(regionId)}</span>
                  <button
                    type="button"
                    onClick={() => moveWaypoint(i, -1)}
                    className="text-slate-400 hover:text-slate-200 px-1"
                    aria-label="earlier"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => moveWaypoint(i, 1)}
                    className="text-slate-400 hover:text-slate-200 px-1"
                    aria-label="later"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => removeWaypoint(i)}
                    className="text-red-400 hover:text-red-300 px-1"
                    aria-label="remove"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ol>
          )}
        </Section>

        {/* Cargo manifest */}
        <Section title={t('logi.cargo')}>
          {cargo.length === 0 && (
            <p className="text-sm text-slate-500 mb-2">{t('logi.emptyCargo')}</p>
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
                    className={`${inputCls} grow min-w-0 text-sm`}
                  />
                  <input
                    type="number"
                    min={1}
                    value={row.qty}
                    onChange={(e) =>
                      updateCargoRow(i, { ...row, qty: Math.max(1, Number(e.target.value) || 1) })
                    }
                    className={`${inputCls} w-18 text-sm`}
                  />
                  {crates !== null && (
                    <span className="text-xs text-slate-400 w-12 shrink-0">
                      {crates} {t('logi.crates')}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => removeCargoRow(i)}
                    className="text-red-400 hover:text-red-300 px-1"
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
            className="mt-2 text-sm px-3 py-1.5 rounded-md bg-slate-700 hover:bg-slate-600 text-slate-100"
          >
            + {t('logi.addRow')}
          </button>
        </Section>

        {/* Vehicle + trips */}
        <Section title={t('logi.vehicle')}>
          <select
            value={vehicleItemId ?? ''}
            onChange={(e) => setVehicle(e.target.value || null)}
            className={`${inputCls} w-full text-sm`}
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
          <dl className="mt-3 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-300">{t('logi.totalCrates')}</dt>
              <dd className="font-mono text-amber-300">{cargoPlan.totalCrates}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-300">{t('logi.trips')}</dt>
              <dd className="font-mono text-amber-300">{cargoPlan.trips ?? '—'}</dd>
            </div>
          </dl>
        </Section>

        {/* Production cost — collapsed details */}
        {production.error && (
          <div className="border border-red-500/40 bg-red-500/10 text-red-300 rounded-lg p-3 text-sm">
            <strong>{t('error.title')}:</strong> {production.error}
          </div>
        )}
        {production.result && (
          <details className="group border-t border-slate-800 pt-3">
            <summary className="cursor-pointer text-sm font-semibold text-slate-200 list-none flex items-center gap-2">
              <span className="text-slate-500 transition-transform group-open:rotate-90">▸</span>
              {t('logi.produceCargo')}
            </summary>
            <div className="space-y-4 mt-3">
              <Section title={t('panels.totals')}>
                <ResourceTotals result={production.result} />
              </Section>
              <Section title={t('panels.buildings')}>
                <BuildingList result={production.result} />
              </Section>
              <Section title={t('panels.sequence')}>
                <BuildSequence result={production.result} />
              </Section>
            </div>
          </details>
        )}
      </Drawer>
    </div>
  );
}
