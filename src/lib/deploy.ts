import type { Dataset } from '../data';
import type { PlanSummary, PlanTarget } from '../engine/resolver';
import type { Faction, LocalizedString } from '../types/domain';

// ---------------------------------------------------------------------------
// Deployment graph: the production plan projected onto placeable map nodes
// (resource sources, buildings, finished product) and the flows between them.
// ---------------------------------------------------------------------------

export type DeployNodeKind = 'source' | 'building' | 'output';

export interface DeployNode {
  /** Stable key ('src:salvage', 'bld:refinery', 'out:120mm'). */
  key: string;
  kind: DeployNodeKind;
  /** Resource id (source), building id (building) or item/ref id (output). */
  refId: string;
}

export interface DeployEdge {
  /** Stable key 'fromKey->toKey'. */
  key: string;
  from: string;
  to: string;
  /** Resources flowing along this edge, with total quantities. */
  resources: { refId: string; qty: number }[];
  /** 1-based production order shown on the line. */
  order: number;
}

export interface DeployGraph {
  nodes: DeployNode[];
  edges: DeployEdge[];
}

/**
 * Build the deployment graph from a resolved plan: one source node per raw
 * resource, one node per building used, one node per finished product.
 * Edges follow the aggregated produce steps (inputs before outputs), so the
 * numbering matches the production order.
 */
export function buildDeployGraph(
  data: Dataset,
  plan: PlanSummary,
  targets: PlanTarget[],
): DeployGraph {
  const nodes = new Map<string, DeployNode>();
  const edges = new Map<string, DeployEdge>();
  const ensureNode = (key: string, kind: DeployNodeKind, refId: string) => {
    if (!nodes.has(key)) nodes.set(key, { key, kind, refId });
    return key;
  };
  const addFlow = (from: string, to: string, refId: string, qty: number) => {
    if (from === to) return; // produced and consumed at the same site
    const key = `${from}->${to}`;
    const edge = edges.get(key) ?? { key, from, to, resources: [], order: 0 };
    const existing = edge.resources.find((r) => r.refId === refId);
    if (existing) existing.qty += qty;
    else edge.resources.push({ refId, qty });
    edges.set(key, edge);
  };

  const producerOf = (refId: string): string | null => {
    const resource = data.resources.get(refId);
    const recipe = data.recipeByOutput.get(refId);
    if (!recipe || resource?.kind === 'raw') {
      return resource ? ensureNode(`src:${refId}`, 'source', refId) : null;
    }
    return ensureNode(`bld:${recipe.buildingId}`, 'building', recipe.buildingId);
  };

  const produceSteps = plan.sequence.filter((s) => s.type === 'produce');
  for (const step of produceSteps) {
    const recipe = data.recipeByOutput.get(step.refId)!;
    const consumer = ensureNode(`bld:${recipe.buildingId}`, 'building', recipe.buildingId);
    for (const input of recipe.inputs) {
      const from = producerOf(input.refId);
      if (from) addFlow(from, consumer, input.refId, input.qty * step.batches);
    }
  }

  // Final delivery: producing building -> finished product marker(s).
  for (const target of targets) {
    const targetRecipe = data.recipeByOutput.get(target.refId);
    if (!targetRecipe) continue;
    const from = ensureNode(`bld:${targetRecipe.buildingId}`, 'building', targetRecipe.buildingId);
    const out = ensureNode(`out:${target.refId}`, 'output', target.refId);
    addFlow(from, out, target.refId, target.qty);
  }

  // Number edges by the first produce step that consumes them (topological).
  const stepIndexOfBuilding = new Map<string, number>();
  produceSteps.forEach((s, i) => {
    const b = `bld:${data.recipeByOutput.get(s.refId)!.buildingId}`;
    if (!stepIndexOfBuilding.has(b)) stepIndexOfBuilding.set(b, i);
  });
  const sorted = [...edges.values()].sort((a, b) => {
    const ia = a.to.startsWith('out:') ? Infinity : (stepIndexOfBuilding.get(a.to) ?? 0);
    const ib = b.to.startsWith('out:') ? Infinity : (stepIndexOfBuilding.get(b.to) ?? 0);
    return ia - ib;
  });
  sorted.forEach((e, i) => { e.order = i + 1; });

  return { nodes: [...nodes.values()], edges: sorted };
}

// ---------------------------------------------------------------------------
// Transport compatibility
// ---------------------------------------------------------------------------

const LIQUIDS = new Set(['oil', 'water', 'petrol', 'diesel', 'heavy-oil', 'enriched-oil']);

// Cargo classes, matching the game's transport rules (wiki-verified
// 2026-07-07):
//  - liquid: fuel/water — carried ONLY by fuel tankers or a Liquid Container.
//  - raw:    mined resources (salvage, components, coal, sulfur, ores) — go
//            in resource-hopper trucks, a Resource Container (raw only,
//            5000), or loose in a general truck.
//  - refined: refined materials (bmats, rmats, coke, assembly mats…) — do
//            NOT fit hoppers or Resource Containers; carried loose in a
//            general truck or crated onto flatbeds / Shipping Containers.
//  - crate:  finished items (weapons, ammo, vehicles as crates) — general
//            trucks, flatbeds, Shipping Container (crates only, 60).
export type CargoClass = 'liquid' | 'raw' | 'refined' | 'crate';

/** Dominant cargo class of an edge (liquid > raw > refined > crate). */
export function cargoClassOf(data: Dataset, resources: { refId: string }[]): CargoClass {
  let hasRaw = false;
  let hasRefined = false;
  for (const { refId } of resources) {
    if (LIQUIDS.has(refId)) return 'liquid';
    const kind = data.resources.get(refId)?.kind;
    if (kind === 'raw') hasRaw = true;
    else if (kind === 'refined') hasRefined = true;
  }
  if (hasRaw) return 'raw';
  if (hasRefined) return 'refined';
  return 'crate';
}

export interface TransportOption {
  /** Item id when the transport is a craftable vehicle/container, else null. */
  itemId: string | null;
  label: LocalizedString;
}

/** id -> generic (non-item) label */
const GENERIC: Record<CargoClass, LocalizedString[]> = {
  liquid: [{ en: 'Train — liquid wagon', fr: 'Train — wagon-citerne' }],
  raw: [{ en: 'Train — resource wagon', fr: 'Train — wagon de ressources' }],
  refined: [{ en: 'Train — resource wagon', fr: 'Train — wagon de ressources' }],
  crate: [{ en: 'Train — container wagon', fr: 'Train — wagon conteneur' }],
};

// General-purpose trucks (loose resources or crates), flatbed and freighters
// reused across the non-liquid classes.
const GENERAL_TRUCKS = ['r-1-hauler', 'dunne-transport'];
const CRATE_HAULERS = ['bms-packmule-flatbed', 'shipping-container', 'bms-bluefin', 'bms-longhook'];

const ITEM_OPTIONS: Record<CargoClass, string[]> = {
  // Fuel tankers + liquid container only — hard requirement.
  liquid: ['dunne-fuelrunner-2d', 'rr-3-stolon-tanker', 'liquid-container'],
  // Hoppers + resource container (raw only) + general trucks + freighter.
  raw: [
    'bms-scrap-hauler', 'r-5-atlas-hauler', 'dunne-loadlugger-3c', 'resource-container',
    ...GENERAL_TRUCKS, 'bms-bowhead',
  ],
  // Loose in a general truck or crated — never hoppers / resource container.
  refined: [...GENERAL_TRUCKS, ...CRATE_HAULERS],
  // Finished crated goods — general trucks + flatbeds + shipping container.
  crate: [...GENERAL_TRUCKS, ...CRATE_HAULERS],
};

/** Transports compatible with the edge's cargo, filtered by faction. */
export function transportOptions(
  data: Dataset,
  cargo: CargoClass,
  faction: Faction,
): TransportOption[] {
  const out: TransportOption[] = [];
  for (const id of ITEM_OPTIONS[cargo]) {
    const item = data.items.get(id);
    if (!item) continue;
    if (item.faction !== 'Both' && item.faction !== faction) continue;
    out.push({ itemId: id, label: item.name });
  }
  for (const label of GENERIC[cargo]) out.push({ itemId: null, label });
  return out;
}
