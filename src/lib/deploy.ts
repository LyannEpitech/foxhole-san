import type { Dataset } from '../data';
import type { PlanResult } from '../engine/resolver';
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
 * resource, one node per building used, one node for the finished product.
 * Edges follow the aggregated produce steps (inputs before outputs), so the
 * numbering matches the production order.
 */
export function buildDeployGraph(data: Dataset, plan: PlanResult, targetId: string): DeployGraph {
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

  // Final delivery: producing building -> finished product marker.
  const targetRecipe = data.recipeByOutput.get(targetId);
  if (targetRecipe) {
    const from = ensureNode(`bld:${targetRecipe.buildingId}`, 'building', targetRecipe.buildingId);
    const out = ensureNode(`out:${targetId}`, 'output', targetId);
    addFlow(from, out, targetId, plan.tree.qty);
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

export type CargoClass = 'liquid' | 'bulk' | 'crate';

/** Dominant cargo class of an edge (liquids > raw bulk > crates). */
export function cargoClassOf(data: Dataset, resources: { refId: string }[]): CargoClass {
  let hasBulk = false;
  for (const { refId } of resources) {
    if (LIQUIDS.has(refId)) return 'liquid';
    if (data.resources.get(refId)?.kind === 'raw') hasBulk = true;
  }
  return hasBulk ? 'bulk' : 'crate';
}

export interface TransportOption {
  /** Item id when the transport is a craftable vehicle/container, else null. */
  itemId: string | null;
  label: LocalizedString;
}

/** id -> generic (non-item) label */
const GENERIC: Record<CargoClass, LocalizedString[]> = {
  liquid: [{ en: 'Train — liquid wagon', fr: 'Train — wagon-citerne' }],
  bulk: [{ en: 'Train — resource wagon', fr: 'Train — wagon de ressources' }],
  crate: [{ en: 'Train — container wagon', fr: 'Train — wagon conteneur' }],
};

const ITEM_OPTIONS: Record<CargoClass, string[]> = {
  liquid: ['dunne-fuelrunner-2d', 'rr-3-stolon-tanker', 'liquid-container'],
  bulk: ['bms-scrap-hauler', 'resource-container', 'bms-bowhead'],
  crate: [
    'r-1-hauler', 'dunne-transport', 'bms-packmule-flatbed', 'dunne-loadlugger-3c',
    'r-5-atlas-hauler', 'shipping-container', 'bms-bluefin', 'bms-longhook',
  ],
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
