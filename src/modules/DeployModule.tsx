import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Drawer } from '../components/Drawer';
import { HexMap } from '../components/HexMap';
import { dataset } from '../data';
import { resolve, type PlanResult } from '../engine/resolver';
import { useLocalized } from '../i18n';
import {
  buildDeployGraph,
  cargoClassOf,
  transportOptions,
  type DeployNode,
} from '../lib/deploy';
import { refName } from '../lib/refs';
import { useDeployStore } from '../store/deployStore';
import { usePlanStore } from '../store/planStore';
import { useUiStore } from '../store/uiStore';

// Official map icon per node, with a colored ring as fallback identity.
const BUILDING_ICONS: Record<string, string> = {
  refinery: 'MapIconManufacturing',
  factory: 'MapIconFactory',
  mpf: 'MapIconMassProductionFactory',
  garage: 'MapIconVehicle',
  'materials-factory': 'MapIconManufacturing',
  metalworks: 'MapIconManufacturing',
  'coal-refinery': 'MapIconCoal',
  'oil-refinery': 'MapIconOilWell',
  'ammunition-factory': 'MapIconAmmoFactory',
  'small-assembly-station': 'MapIconWorkshop',
  'large-assembly-station': 'MapIconWorkshop',
  'dry-dock': 'MapIconShipyard',
  'concrete-mixer': 'MapIconConstructionYard',
  'infantry-kit-factory': 'MapIconSupplies',
  'aircraft-maintenance-factory': 'MapIconAircraftDepot',
  'offshore-platform': 'MapIconFacilityMineOilRig',
  'construction-site': 'MapIconConstructionYard',
};
const SOURCE_ICONS: Record<string, string> = {
  salvage: 'MapIconSalvage',
  components: 'MapIconComponents',
  sulfur: 'MapIconSulfur',
  coal: 'MapIconCoal',
  oil: 'MapIconOilWell',
  petrol: 'MapIconFuel',
  'damaged-components': 'MapIconComponentMine',
  'rare-metal': 'MapIconSulfurMine',
};

const NODE_COLORS: Record<DeployNode['kind'], string> = {
  source: '#34d399',
  building: '#a78bfa',
  output: '#f59e0b',
};

const NODE_R = 300;

export function DeployModule() {
  const { t } = useTranslation();
  const localized = useLocalized();
  const { targetId, quantity, faction } = usePlanStore();
  const setActive = useUiStore((s) => s.setActive);
  const {
    positions, transports, placing, selectedEdge,
    setPlacing, place, removeNode, selectEdge, setTransport, reset,
  } = useDeployStore();

  const plan: PlanResult | null = useMemo(() => {
    if (!targetId) return null;
    try { return resolve(dataset, targetId, quantity, faction); } catch { return null; }
  }, [targetId, quantity, faction]);

  const graph = useMemo(
    () => (plan && targetId ? buildDeployGraph(dataset, plan, targetId) : { nodes: [], edges: [] }),
    [plan, targetId],
  );

  const nodeLabel = (n: DeployNode) =>
    n.kind === 'building'
      ? localized(dataset.buildings.get(n.refId)?.name ?? { en: n.refId, fr: n.refId })
      : localized(refName(n.refId));
  const nodeIcon = (n: DeployNode) =>
    n.kind === 'building' ? BUILDING_ICONS[n.refId] : n.kind === 'source' ? SOURCE_ICONS[n.refId] : undefined;

  const placedCount = graph.nodes.filter((n) => positions[n.key]).length;
  const visibleEdges = graph.edges.filter((e) => positions[e.from] && positions[e.to]);
  const selected = graph.edges.find((e) => e.key === selectedEdge) ?? null;
  const selectedCargo = selected ? cargoClassOf(dataset, selected.resources) : null;

  const onMapClick = (pos: [number, number]) => {
    if (placing) place(placing, pos);
    else selectEdge(null);
  };

  // ---- SVG overlay: flows + placed nodes -------------------------------
  const overlay = (
    <g>
      {visibleEdges.map((e) => {
        const [x1, y1] = positions[e.from];
        const [x2, y2] = positions[e.to];
        const mx = (x1 + x2) / 2;
        const my = (y1 + y2) / 2;
        const hasTransport = !!transports[e.key];
        const isSel = e.key === selectedEdge;
        const color = isSel ? '#f59e0b' : hasTransport ? '#34d399' : '#94a3b8';
        return (
          <g key={e.key}>
            <line x1={x1} y1={y1} x2={x2} y2={y2}
              stroke={color} strokeWidth={isSel ? 90 : 60}
              strokeDasharray={hasTransport ? undefined : '220 160'} opacity={0.9} />
            {/* generous invisible hit area */}
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="transparent" strokeWidth={900}
              className="cursor-pointer"
              onClick={(ev) => { ev.stopPropagation(); selectEdge(e.key); }} />
            <circle cx={mx} cy={my} r={260} fill={color} pointerEvents="none" />
            <text x={mx} y={my} textAnchor="middle" dominantBaseline="central"
              fontSize={300} fontWeight={700} fill="#0f172a" pointerEvents="none">
              {e.order}
            </text>
          </g>
        );
      })}
      {graph.nodes.filter((n) => positions[n.key]).map((n) => {
        const [x, y] = positions[n.key];
        const color = NODE_COLORS[n.kind];
        const icon = nodeIcon(n);
        return (
          <g key={n.key} className="cursor-pointer"
            onClick={(ev) => { ev.stopPropagation(); setPlacing(n.key); }}>
            <circle cx={x} cy={y} r={NODE_R} fill="rgba(15,23,42,0.85)"
              stroke={color} strokeWidth={placing === n.key ? 90 : 50} />
            {icon ? (
              <image href={`${import.meta.env.BASE_URL}icons/${icon}.png`}
                x={x - NODE_R * 0.62} y={y - NODE_R * 0.62}
                width={NODE_R * 1.24} height={NODE_R * 1.24} pointerEvents="none" />
            ) : (
              <text x={x} y={y} textAnchor="middle" dominantBaseline="central"
                fontSize={NODE_R * 0.9} fontWeight={700} fill={color} pointerEvents="none">
                {n.kind === 'output' ? '★' : nodeLabel(n).slice(0, 2)}
              </text>
            )}
            <text x={x} y={y + NODE_R + 180} textAnchor="middle" fontSize={220}
              fontWeight={600} fill="#f8fafc" stroke="#0f172a" strokeWidth={20}
              style={{ paintOrder: 'stroke' }} pointerEvents="none">
              {nodeLabel(n)}
            </text>
          </g>
        );
      })}
    </g>
  );

  if (!plan || !targetId) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center space-y-4">
        <p className="text-slate-400">{t('deploy.empty')}</p>
        <button type="button" onClick={() => setActive('production')}
          className="px-4 py-2 rounded-md bg-amber-500 text-slate-900 font-semibold">
          {t('nav.production')}
        </button>
      </div>
    );
  }

  return (
    <div className="relative h-[calc(100vh-7.25rem)] overflow-hidden">
      <div className="absolute inset-0 bg-slate-950">
        <HexMap onMapClick={onMapClick} overlay={overlay} />
      </div>

      {/* Placement hint */}
      <div className="absolute top-2 left-2 z-10 space-y-1">
        <p className="inline-block text-xs text-slate-200 bg-slate-900/85 backdrop-blur border border-slate-700 rounded-md px-3 py-1.5">
          🏗 {localized(refName(targetId))} × {quantity} — {placedCount}/{graph.nodes.length}
        </p>
        {placing && (
          <p className="block w-fit text-xs text-amber-300 bg-slate-900/85 backdrop-blur border border-amber-500/50 rounded-md px-3 py-1.5">
            {t('deploy.clickToPlace', { name: nodeLabel(graph.nodes.find((n) => n.key === placing)!) })}
          </p>
        )}
      </div>

      <Drawer title={t('nav.deploy')}>
        <p className="text-xs text-slate-500">{t('deploy.hint')}</p>

        {/* Palette */}
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
            {t('deploy.palette')}
          </h3>
          <div className="space-y-1.5">
            {graph.nodes.map((n) => {
              const isPlaced = !!positions[n.key];
              return (
                <div key={n.key} className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm ${
                  placing === n.key ? 'border-amber-400 bg-amber-500/10' : 'border-slate-700 bg-slate-800/60'
                }`}>
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: NODE_COLORS[n.kind] }} />
                  <span className="text-slate-100 grow truncate">{nodeLabel(n)}</span>
                  <span className="text-xs text-slate-500">{t(`deploy.kind.${n.kind}`)}</span>
                  <button type="button" onClick={() => setPlacing(placing === n.key ? null : n.key)}
                    className="text-xs px-2 py-0.5 rounded bg-slate-700 hover:bg-slate-600 text-slate-100">
                    {isPlaced ? t('deploy.move') : t('deploy.place')}
                  </button>
                  {isPlaced && (
                    <button type="button" onClick={() => removeNode(n.key)}
                      className="text-red-400 hover:text-red-300" aria-label="remove">✕</button>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Flows */}
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
            {t('deploy.flows')}
          </h3>
          {graph.edges.length === 0 && <p className="text-sm text-slate-500">—</p>}
          <ol className="space-y-1.5 text-sm">
            {graph.edges.map((e) => {
              const fromN = graph.nodes.find((n) => n.key === e.from)!;
              const toN = graph.nodes.find((n) => n.key === e.to)!;
              const ready = positions[e.from] && positions[e.to];
              const transport = transports[e.key];
              const transportLabel = transport
                ? dataset.items.get(transport)
                  ? localized(dataset.items.get(transport)!.name)
                  : transport
                : null;
              return (
                <li key={e.key}>
                  <button type="button" onClick={() => selectEdge(e.key)}
                    className={`w-full text-left rounded-lg border px-3 py-2 ${
                      selectedEdge === e.key ? 'border-amber-400 bg-amber-500/10' : 'border-slate-700 bg-slate-800/60 hover:border-slate-500'
                    }`}>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-amber-400">{e.order}.</span>
                      <span className="text-slate-100 truncate">{nodeLabel(fromN)} → {nodeLabel(toN)}</span>
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      {e.resources.map((r) => `${localized(refName(r.refId))} ×${r.qty}`).join(' · ')}
                    </div>
                    <div className="text-xs mt-0.5">
                      {!ready ? (
                        <span className="text-slate-500">{t('deploy.placeBoth')}</span>
                      ) : transportLabel ? (
                        <span className="text-emerald-300">🚚 {transportLabel}</span>
                      ) : (
                        <span className="text-yellow-400/80">{t('deploy.noTransport')}</span>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ol>
        </section>

        {/* Transport picker for the selected flow */}
        {selected && selectedCargo && (
          <section className="border-t border-slate-800 pt-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">
              {t('deploy.transport')} — {t(`deploy.cargo.${selectedCargo}`)}
            </h3>
            <p className="text-xs text-slate-500 mb-2">
              {selected.resources.map((r) => localized(refName(r.refId))).join(', ')}
            </p>
            <div className="space-y-1">
              {transportOptions(dataset, selectedCargo, faction).map((opt) => {
                const value = opt.itemId ?? opt.label.en;
                const checked = transports[selected.key] === value;
                return (
                  <label key={value} className={`flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm cursor-pointer ${
                    checked ? 'border-emerald-400 bg-emerald-500/10 text-emerald-200' : 'border-slate-700 bg-slate-800/60 text-slate-200 hover:border-slate-500'
                  }`}>
                    <input type="radio" name="transport" checked={checked}
                      onChange={() => setTransport(selected.key, value)} className="accent-emerald-400" />
                    {localized(opt.label)}
                  </label>
                );
              })}
            </div>
          </section>
        )}

        <button type="button" onClick={reset}
          className="w-full text-sm px-3 py-2 rounded-md bg-slate-800 border border-slate-700 hover:bg-slate-700 text-red-300">
          🗑 {t('deploy.reset')}
        </button>
      </Drawer>
    </div>
  );
}
