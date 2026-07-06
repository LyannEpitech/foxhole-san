import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Drawer } from '../components/Drawer';
import { HexMap } from '../components/HexMap';
import { MapLayersControl } from '../components/MapLayersControl';
import { useApiMarkers } from '../components/useApiMarkers';
import { dataset } from '../data';
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

// War API iconTypes of world structures matching a plan node — used to
// recommend a placement spot (deposits for sources, world industry for
// town production buildings; facilities are player-built anywhere).
const SOURCE_WORLD_TYPES: Record<string, number[]> = {
  salvage: [20, 38],
  components: [21, 40],
  sulfur: [23, 32],
  coal: [61],
  oil: [62, 75],
  petrol: [22],
};
const BUILDING_WORLD_TYPES: Record<string, number[]> = {
  refinery: [17],
  factory: [34],
  mpf: [51],
  garage: [12],
  'dry-dock': [18],
};

function worldTypesFor(node: DeployNode): number[] {
  if (node.kind === 'source') return SOURCE_WORLD_TYPES[node.refId] ?? [];
  if (node.kind === 'building') return BUILDING_WORLD_TYPES[node.refId] ?? [];
  return [];
}


export function DeployModule() {
  const { t } = useTranslation();
  const localized = useLocalized();
  const { targets, faction, result: plan } = usePlanStore();
  const validTargets = useMemo(
    () => targets.filter((x) => x.refId && x.qty > 0),
    [targets],
  );
  const setActive = useUiStore((s) => s.setActive);
  const {
    positions, transports, placing, selectedEdge,
    setPlacing, place, removeNode, selectEdge, setTransport, reset,
  } = useDeployStore();
  const apiMarkers = useApiMarkers();

  const graph = useMemo(
    () =>
      plan && validTargets.length > 0
        ? buildDeployGraph(dataset, plan, validTargets)
        : { nodes: [], edges: [] },
    [plan, validTargets],
  );

  const nodeLabel = (n: DeployNode) =>
    n.kind === 'building'
      ? localized(dataset.buildings.get(n.refId)?.name ?? { en: n.refId, fr: n.refId })
      : localized(refName(n.refId));
  const nodeIcon = (n: DeployNode) =>
    n.kind === 'building' ? BUILDING_ICONS[n.refId] : n.kind === 'source' ? SOURCE_ICONS[n.refId] : undefined;

  const placedCount = graph.nodes.filter((n) => positions[n.key]).length;
  const visibleEdges = graph.edges.filter((e) => positions[e.from] && positions[e.to]);

  // Placement guidance: world structures matching the armed node, with the
  // one closest to its already-placed graph neighbors circled in red.
  const guidance = useMemo(() => {
    if (!placing) return null;
    const node = graph.nodes.find((n) => n.key === placing);
    if (!node) return null;
    const types = new Set(worldTypesFor(node));
    if (types.size === 0) return null;
    const candidates = apiMarkers.filter((m) => m.iconType !== undefined && types.has(m.iconType));
    if (candidates.length === 0) return null;
    // Reference point: placed neighbors first, then any placed node.
    const neighborKeys = graph.edges
      .filter((e) => e.from === placing || e.to === placing)
      .map((e) => (e.from === placing ? e.to : e.from));
    const refKeys = [...neighborKeys, ...Object.keys(positions)].filter((k) => positions[k]);
    let nearest = candidates[0];
    if (refKeys.length > 0) {
      const [rx, ry] = positions[refKeys[0]];
      let best = Infinity;
      for (const c of candidates) {
        const d = (c.x - rx) ** 2 + (c.y - ry) ** 2;
        if (d < best) { best = d; nearest = c; }
      }
    }
    return { candidates, nearest };
  }, [placing, graph, apiMarkers, positions]);
  const selected = graph.edges.find((e) => e.key === selectedEdge) ?? null;
  const selectedCargo = selected ? cargoClassOf(dataset, selected.resources) : null;

  const onMapClick = (pos: [number, number]) => {
    if (placing) place(placing, pos);
    else selectEdge(null);
  };

  // ---- SVG overlay: flows + placed nodes, constant on-screen size ------
  const overlay = ({ vw }: { vw: number }) => {
    const nodeR = vw * 0.011;
    const lineW = vw * 0.0035;
    const badgeR = vw * 0.008;
    const labelFs = vw * 0.008;
    return (
      <g>
        {/* Placement guidance: candidate world structures + the recommended one in red */}
        {guidance && (
          <g pointerEvents="none">
            {guidance.candidates.map((c, i) =>
              c === guidance.nearest ? null : (
                <circle key={`cand-${i}`} cx={c.x} cy={c.y} r={nodeR * 1.15}
                  fill="none" stroke="#fbbf24" strokeWidth={nodeR * 0.09} opacity={0.55} />
              ),
            )}
            <circle cx={guidance.nearest.x} cy={guidance.nearest.y} r={nodeR * 1.5}
              fill="none" stroke="#ef4444" strokeWidth={nodeR * 0.18} />
            <circle cx={guidance.nearest.x} cy={guidance.nearest.y} r={nodeR * 2.1}
              fill="none" stroke="#ef4444" strokeWidth={nodeR * 0.07} opacity={0.6}
              strokeDasharray={`${nodeR * 0.4} ${nodeR * 0.3}`} />
          </g>
        )}
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
                stroke={color} strokeWidth={isSel ? lineW * 1.6 : lineW}
                strokeDasharray={hasTransport ? undefined : `${lineW * 3.5} ${lineW * 2.5}`}
                opacity={0.9} />
              {/* generous invisible hit area */}
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="transparent"
                strokeWidth={vw * 0.03} className="cursor-pointer"
                onClick={(ev) => { ev.stopPropagation(); selectEdge(e.key); }} />
              <circle cx={mx} cy={my} r={badgeR} fill={color} pointerEvents="none" />
              <text x={mx} y={my} textAnchor="middle" dominantBaseline="central"
                fontSize={badgeR * 1.2} fontWeight={700} fill="#0f172a" pointerEvents="none">
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
              <circle cx={x} cy={y} r={nodeR} fill="rgba(15,23,42,0.85)"
                stroke={color} strokeWidth={nodeR * (placing === n.key ? 0.28 : 0.15)} />
              {icon ? (
                <image href={`${import.meta.env.BASE_URL}icons/${icon}.png`}
                  x={x - nodeR * 0.62} y={y - nodeR * 0.62}
                  width={nodeR * 1.24} height={nodeR * 1.24} pointerEvents="none" />
              ) : (
                <text x={x} y={y} textAnchor="middle" dominantBaseline="central"
                  fontSize={nodeR * 0.9} fontWeight={700} fill={color} pointerEvents="none">
                  {n.kind === 'output' ? '★' : nodeLabel(n).slice(0, 2)}
                </text>
              )}
              <text x={x} y={y + nodeR + labelFs * 0.9} textAnchor="middle" fontSize={labelFs}
                fontWeight={600} fill="#f8fafc" stroke="#0f172a" strokeWidth={labelFs * 0.09}
                style={{ paintOrder: 'stroke' }} pointerEvents="none">
                {nodeLabel(n)}
              </text>
            </g>
          );
        })}
      </g>
    );
  };

  if (!plan || validTargets.length === 0) {
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
        <HexMap onMapClick={onMapClick} overlay={overlay} apiMarkers={apiMarkers} />
      </div>

      {/* Placement hint + world layers */}
      <div className="absolute top-2 left-2 z-10 space-y-1">
        <p className="inline-block text-xs text-slate-200 bg-slate-900/85 backdrop-blur border border-slate-700 rounded-md px-3 py-1.5">
          🏗{' '}
          {validTargets.length === 1
            ? `${localized(refName(validTargets[0].refId))} × ${validTargets[0].qty}`
            : t('deploy.multiTargets', { count: validTargets.length })}{' '}
          — {placedCount}/{graph.nodes.length}
        </p>
        <div className="block">
          <MapLayersControl />
        </div>
        {placing && (
          <p className="block w-fit text-xs text-amber-300 bg-slate-900/85 backdrop-blur border border-amber-500/50 rounded-md px-3 py-1.5">
            {t('deploy.clickToPlace', { name: nodeLabel(graph.nodes.find((n) => n.key === placing)!) })}
          </p>
        )}
        {placing && guidance && (
          <p className="block w-fit text-xs text-red-300 bg-slate-900/85 backdrop-blur border border-red-500/50 rounded-md px-3 py-1.5">
            🎯 {t('deploy.suggestion', { region: guidance.nearest.regionName })}
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
