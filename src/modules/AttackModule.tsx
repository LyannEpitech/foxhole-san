import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArtilleryCalculator } from '../components/ArtilleryCalculator';
import { artilleryForFaction } from '../lib/artillery';
import { KM_PER_WORLD_UNIT } from '../lib/logistics';
import { BuildingList } from '../components/BuildingList';
import { BuildSequence } from '../components/BuildSequence';
import { Drawer } from '../components/Drawer';
import { ItemSelect } from '../components/ItemSelect';
import { PlanMap } from '../components/PlanMap';
import { ResourceTotals } from '../components/ResourceTotals';
import { dataset } from '../data';
import { regionName } from '../data/regions';
import { resolveMany, type MultiPlanResult } from '../engine/resolver';
import { useLocalized } from '../i18n';
import { aggregateAttackTargets } from '../lib/attack';
import { refName } from '../lib/refs';
import { useAttackStore } from '../store/attackStore';
import { useLogiStore } from '../store/logiStore';
import { usePlanStore } from '../store/planStore';
import { useUiStore } from '../store/uiStore';

type MarkerMode = 'objective' | 'staging';

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
    artyGun,
    artyTarget,
    setObjective,
    setStaging,
    setArtyGun,
    setArtyTarget,
    setSoldiers,
    addLoadoutRow,
    updateLoadoutRow,
    removeLoadoutRow,
    addSupportRow,
    updateSupportRow,
    removeSupportRow,
    applyDefaultLoadout,
    presets,
    savePreset,
    applyPreset,
    deletePreset,
  } = useAttackStore();
  const [presetName, setPresetName] = useState('');
  const logi = useLogiStore();
  const setActive = useUiStore((s) => s.setActive);
  const [mode, setMode] = useState<MarkerMode>('objective');

  // --- B4 map mode: place & drag gun/target, live firing solution -------
  const M_PER_UNIT = KM_PER_WORLD_UNIT * 1000;
  const pieces = artilleryForFaction(faction);
  const [artyPieceId, setArtyPieceId] = useState(pieces[0]?.id ?? '');
  const artyPiece = pieces.find((p) => p.id === artyPieceId) ?? pieces[0];
  const [artyPlacing, setArtyPlacing] = useState<null | 'gun' | 'target'>(null);
  const mapWrapRef = useRef<HTMLDivElement>(null);

  const artySolution = useMemo(() => {
    if (!artyGun || !artyTarget) return null;
    const dx = artyTarget[0] - artyGun[0];
    const dy = artyTarget[1] - artyGun[1];
    const distance = Math.hypot(dx, dy) * M_PER_UNIT;
    // World y grows southwards, so north is -dy in compass terms.
    const azimuth = ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360;
    return { distance, azimuth };
  }, [artyGun, artyTarget, M_PER_UNIT]);
  const artyInRange =
    artySolution && artyPiece
      ? artySolution.distance >= artyPiece.min && artySolution.distance <= artyPiece.max
      : false;

  const worldFromPointer = (ev: PointerEvent): [number, number] | null => {
    const svg = mapWrapRef.current?.querySelector('svg');
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return null;
    const p = new DOMPoint(ev.clientX, ev.clientY).matrixTransform(ctm.inverse());
    return [p.x, p.y];
  };

  /** True drag & drop: grab a marker and slide it across the map. */
  const startArtyDrag = (kind: 'gun' | 'target') => (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const setter = kind === 'gun' ? setArtyGun : setArtyTarget;
    const move = (ev: PointerEvent) => {
      const p = worldFromPointer(ev);
      if (p) setter(p);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

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

  // Armed artillery placement wins over region selection.
  const onMapClick = (pos: [number, number]) => {
    if (!artyPlacing) return;
    (artyPlacing === 'gun' ? setArtyGun : setArtyTarget)(pos);
    setArtyPlacing(null);
  };

  // B4 map overlay: range donut around the gun, gun/target markers
  // (draggable), firing line with the live solution.
  const artyOverlay = ({ vw }: { vw: number }) => {
    const r = vw * 0.012;
    const label = artySolution
      ? `${artySolution.distance.toFixed(0)} m · ${artySolution.azimuth.toFixed(1)}°`
      : '';
    return (
      <g>
        {artyGun && artyPiece && (
          <g pointerEvents="none">
            <circle cx={artyGun[0]} cy={artyGun[1]} r={artyPiece.max / M_PER_UNIT}
              fill="rgba(167,139,250,0.08)" stroke="#a78bfa" strokeWidth={vw * 0.0015}
              strokeDasharray={`${vw * 0.008} ${vw * 0.006}`} />
            <circle cx={artyGun[0]} cy={artyGun[1]} r={artyPiece.min / M_PER_UNIT}
              fill="rgba(2,6,23,0.25)" stroke="#a78bfa" strokeWidth={vw * 0.0012}
              strokeDasharray={`${vw * 0.004} ${vw * 0.004}`} />
          </g>
        )}
        {artyGun && artyTarget && artySolution && (
          <g pointerEvents="none">
            <line x1={artyGun[0]} y1={artyGun[1]} x2={artyTarget[0]} y2={artyTarget[1]}
              stroke={artyInRange ? '#34d399' : '#ef4444'} strokeWidth={vw * 0.003}
              strokeLinecap="round" />
            <text x={(artyGun[0] + artyTarget[0]) / 2} y={(artyGun[1] + artyTarget[1]) / 2 - r}
              textAnchor="middle" fontSize={vw * 0.011} fontWeight={700}
              fill={artyInRange ? '#6ee7b7' : '#fca5a5'} stroke="#0f172a"
              strokeWidth={vw * 0.001} style={{ paintOrder: 'stroke' }}>
              {label}
            </text>
          </g>
        )}
        {artyGun && (
          <g className="cursor-grab" onPointerDown={startArtyDrag('gun')}
            onMouseDown={(e) => e.stopPropagation()}>
            <circle cx={artyGun[0]} cy={artyGun[1]} r={r}
              fill="rgba(15,23,42,0.9)" stroke="#a78bfa" strokeWidth={r * 0.2} />
            <text x={artyGun[0]} y={artyGun[1]} textAnchor="middle" dominantBaseline="central"
              fontSize={r * 1.1} fill="#a78bfa" pointerEvents="none">⌖</text>
          </g>
        )}
        {artyTarget && (
          <g className="cursor-grab" onPointerDown={startArtyDrag('target')}
            onMouseDown={(e) => e.stopPropagation()}>
            <circle cx={artyTarget[0]} cy={artyTarget[1]} r={r}
              fill="rgba(15,23,42,0.9)" stroke="#ef4444" strokeWidth={r * 0.2} />
            <text x={artyTarget[0]} y={artyTarget[1]} textAnchor="middle" dominantBaseline="central"
              fontSize={r * 1.1} fill="#f87171" pointerEvents="none">✛</text>
          </g>
        )}
      </g>
    );
  };

  const onRegionClick = (region: { id: string }) => {
    if (artyPlacing) return;
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

  const inputCls = 'bg-slate-900 border border-slate-600 rounded-md px-3 py-2 text-slate-100';

  // Objective/staging mode buttons, overlaid on the map next to the tools.
  const extraControls = (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1 bg-slate-900/85 backdrop-blur border border-slate-700 rounded-lg p-1 shadow-lg">
        <button
          type="button"
          onClick={() => setMode('objective')}
          className={
            mode === 'objective'
              ? 'px-3 py-1.5 rounded-md text-sm font-semibold bg-red-500/80 text-white'
              : 'px-3 py-1.5 rounded-md text-sm text-slate-300 hover:bg-slate-700'
          }
        >
          🎯 {t('attack.objective')}
        </button>
        <button
          type="button"
          onClick={() => setMode('staging')}
          className={
            mode === 'staging'
              ? 'px-3 py-1.5 rounded-md text-sm font-semibold bg-sky-500/80 text-white'
              : 'px-3 py-1.5 rounded-md text-sm text-slate-300 hover:bg-slate-700'
          }
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
            className="px-2 py-1.5 rounded-md text-sm text-slate-400 hover:text-red-300"
            title={t('attack.clearMarkers')}
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div ref={mapWrapRef} className="relative h-[calc(100vh-7.25rem)] overflow-hidden">
      <PlanMap
        onRegionClick={onRegionClick}
        highlighted={highlighted}
        route={route}
        routeColor="#ef4444"
        markers={markers}
        extraControls={extraControls}
        overlay={artyOverlay}
        onMapClick={onMapClick}
      />

      <Drawer title={t('nav.attack')}>
        <p className="text-xs text-slate-500">{t('attack.mapHint')}</p>

        {/* Markers status */}
        <Section title={t('attack.plan')}>
          <div className="space-y-1 text-sm">
            <div>
              <span className="text-sky-300">🏕 {t('attack.staging')}:</span>{' '}
              <span className="text-slate-100">
                {stagingRegion ? regionName(stagingRegion) : '—'}
              </span>
            </div>
            <div>
              <span className="text-red-300">🎯 {t('attack.objective')}:</span>{' '}
              <span className="text-slate-100">
                {objectiveRegion ? regionName(objectiveRegion) : '—'}
              </span>
            </div>
            {!stagingRegion && !objectiveRegion && (
              <p className="text-slate-500 text-xs">{t('attack.noMarkers')}</p>
            )}
          </div>
        </Section>

        {/* Headcount + loadout */}
        <Section title={t('attack.loadout')}>
          <div className="flex items-end gap-3 mb-3">
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
            <p className="text-sm text-slate-500 mb-2">{t('attack.emptyLoadout')}</p>
          )}
          <div className="space-y-2">
            {loadout.map((row, i) => (
              <div key={i} className="flex items-center gap-2">
                <ItemSelect
                  value={row.itemId}
                  onChange={(itemId) => updateLoadoutRow(i, { ...row, itemId })}
                  faction={faction}
                  className="grow min-w-0 text-sm"
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
                  className={`${inputCls} w-16 text-sm`}
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
            className="mt-2 text-sm px-3 py-1.5 rounded-md bg-slate-700 hover:bg-slate-600 text-slate-100"
          >
            + {t('attack.addRow')}
          </button>

          {/* A4.1 — named loadout presets */}
          <div className="mt-4 border-t border-slate-800 pt-3">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
              {t('presets.title')}
            </h4>
            <div className="flex gap-2">
              <input
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                placeholder={t('presets.namePlaceholder')}
                className={`${inputCls} grow min-w-0 text-sm`}
              />
              <button
                type="button"
                disabled={!presetName.trim()}
                onClick={() => { savePreset(presetName.trim()); setPresetName(''); }}
                className="text-sm px-3 py-1.5 rounded-md bg-slate-700 hover:bg-slate-600 text-slate-100 disabled:opacity-40"
              >
                💾 {t('presets.save')}
              </button>
            </div>
            {presets.length > 0 && (
              <ul className="mt-2 space-y-1">
                {presets.map((p) => (
                  <li key={p.name} className="flex items-center gap-2 text-sm bg-slate-800/60 border border-slate-700 rounded-md px-3 py-1.5">
                    <span className="text-slate-100 grow truncate">{p.name}</span>
                    <button
                      type="button"
                      onClick={() => applyPreset(p.name)}
                      className="text-xs px-2 py-0.5 rounded bg-slate-700 hover:bg-slate-600 text-amber-200"
                    >
                      {t('presets.apply')}
                    </button>
                    <button
                      type="button"
                      onClick={() => deletePreset(p.name)}
                      className="text-red-400 hover:text-red-300"
                      aria-label="delete"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Section>

        {/* Support */}
        <Section title={t('attack.support')}>
          <div className="space-y-2">
            {support.map((row, i) => (
              <div key={i} className="flex items-center gap-2">
                <ItemSelect
                  value={row.itemId}
                  onChange={(itemId) => updateSupportRow(i, { ...row, itemId })}
                  faction={faction}
                  className="grow min-w-0 text-sm"
                />
                <input
                  type="number"
                  min={1}
                  value={row.qty}
                  onChange={(e) =>
                    updateSupportRow(i, { ...row, qty: Math.max(1, Number(e.target.value) || 1) })
                  }
                  className={`${inputCls} w-16 text-sm`}
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
            className="mt-2 text-sm px-3 py-1.5 rounded-md bg-slate-700 hover:bg-slate-600 text-slate-100"
          >
            + {t('attack.addRow')}
          </button>
        </Section>

        {/* Totals + export */}
        {targets.length > 0 && (
          <Section title={t('attack.totalNeeds')}>
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
              className="mt-3 w-full text-sm px-3 py-2 rounded-md bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold"
            >
              {t('attack.sendToLogistics')} →
            </button>
            <button
              type="button"
              onClick={() => {
                usePlanStore.getState().setTargets(targets);
                setActive('production');
              }}
              className="mt-2 w-full text-sm px-3 py-2 rounded-md bg-slate-700 hover:bg-slate-600 text-slate-100"
            >
              {t('attack.sendToProduction')} →
            </button>
          </Section>
        )}

        {/* B4 — artillery calculator (map-first) */}
        <details className="group border-t border-slate-800 pt-3" open={!!artyGun}>
          <summary className="cursor-pointer text-sm font-semibold text-slate-200 list-none flex items-center gap-2">
            <span className="text-slate-500 transition-transform group-open:rotate-90">▸</span>
            🎯 {t('arty.title')}
          </summary>
          <div className="mt-3 space-y-3 text-sm">
            <select
              value={artyPiece?.id ?? ''}
              onChange={(e) => setArtyPieceId(e.target.value)}
              className="w-full bg-slate-900 border border-slate-600 rounded-md px-3 py-2 text-slate-100 text-sm"
            >
              {pieces.map((p) => (
                <option key={p.id} value={p.id}>
                  {localized(refName(p.id))} ({p.min}–{p.max} m)
                </option>
              ))}
            </select>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setArtyPlacing(artyPlacing === 'gun' ? null : 'gun')}
                className={`grow px-3 py-1.5 rounded-md text-sm ${
                  artyPlacing === 'gun'
                    ? 'bg-violet-500/80 text-white font-semibold'
                    : 'bg-slate-700 hover:bg-slate-600 text-slate-100'
                }`}
              >
                ⌖ {t('arty.placeGun')}
              </button>
              <button
                type="button"
                onClick={() => setArtyPlacing(artyPlacing === 'target' ? null : 'target')}
                className={`grow px-3 py-1.5 rounded-md text-sm ${
                  artyPlacing === 'target'
                    ? 'bg-red-500/80 text-white font-semibold'
                    : 'bg-slate-700 hover:bg-slate-600 text-slate-100'
                }`}
              >
                ✛ {t('arty.placeTarget')}
              </button>
              {(artyGun || artyTarget) && (
                <button
                  type="button"
                  onClick={() => { setArtyGun(null); setArtyTarget(null); }}
                  className="px-2 py-1.5 rounded-md text-sm bg-slate-800 text-slate-400 hover:text-red-300"
                  aria-label="clear"
                >
                  ✕
                </button>
              )}
            </div>
            <p className="text-xs text-slate-500">{t('arty.mapHint')}</p>

            {artySolution ? (
              <div className={`rounded-lg border px-3 py-2 ${
                artyInRange ? 'border-emerald-500/50 bg-emerald-500/10' : 'border-red-500/50 bg-red-500/10'
              }`}>
                <div className="flex justify-between">
                  <span className="text-slate-300">{t('arty.solution')}</span>
                  <span className="font-mono text-lg text-slate-100">
                    {artySolution.distance.toFixed(1)} m · {artySolution.azimuth.toFixed(1)}°
                  </span>
                </div>
                {artyPiece && !artyInRange && (
                  <p className="text-xs text-red-300 mt-1">
                    {t('arty.outOfRange', { min: artyPiece.min, max: artyPiece.max })}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-500">{t('arty.noMarkers')}</p>
            )}

            <details className="group/manual">
              <summary className="cursor-pointer text-xs text-slate-400 list-none flex items-center gap-1">
                <span className="text-slate-600 transition-transform group-open/manual:rotate-90">▸</span>
                {t('arty.manual')}
              </summary>
              <div className="mt-2">
                <ArtilleryCalculator />
              </div>
            </details>
          </div>
        </details>

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
              {t('attack.cost')}
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
