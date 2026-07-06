import type { Dataset } from '../data';
import { DIESEL_POWER_PLANT } from '../data/power';
import type {
  Building,
  Faction,
  MaterialCost,
  Recipe,
  TechRequirement,
} from '../types/domain';

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

/** One node of the requirement tree: "we need `qty` of `refId`". */
export interface RequirementNode {
  refId: string;
  /** Quantity needed by the parent. */
  qty: number;
  /** Portion of `qty` covered by declared stock (A1.2). */
  fromStock?: number;
  /** Recipe used to produce it (absent on leaves: raw resources / unproducible refs). */
  recipeId?: string;
  buildingId?: string;
  /** Number of recipe runs (ceil), and the amount actually produced (may exceed qty). */
  batches?: number;
  produced?: number;
  children: RequirementNode[];
}

export type PlanStep =
  | { type: 'tech'; techId: string }
  | { type: 'build'; buildingId: string }
  | { type: 'produce'; refId: string; recipeId: string; buildingId: string; batches: number; produced: number };

/** Busy time of one building's production queue. */
export interface BuildingTime {
  buildingId: string;
  seconds: number;
}

/** Electricity plan when the chain involves powered facilities. */
export interface PowerPlan {
  /** Peak grid load: sum of the MW draw of every powered building used. */
  totalMW: number;
  /** Diesel Power Plants needed to cover that load. */
  plants: number;
  /** Construction cost of those plants (not counted in constructionTotal). */
  plantCost: MaterialCost;
  /** Diesel burn at that load, liters per hour (scales with grid load). */
  fuelLitersPerHour: number;
  /** Makespan estimate in hours (longest building queue), when known. */
  durationHours: number | null;
  /** Total diesel for the run (fuelLitersPerHour x duration), when known. */
  fuelLitersTotal: number | null;
  /** Salvage to refine that diesel (10 salvage -> 100 L), when known. */
  fuelSalvage: number | null;
}

/** Everything a plan reports besides the requirement tree(s). */
export interface PlanSummary {
  /** Total quantities needed, keyed by resource id. */
  totals: { raw: Record<string, number>; refined: Record<string, number> };
  /** Distinct buildings involved, in first-use order. */
  buildings: Building[];
  /** Sum of the construction costs of all involved buildings. */
  constructionTotal: MaterialCost;
  /** Distinct tech prerequisites of those buildings. */
  prerequisites: TechRequirement[];
  /** Topologically ordered steps: tech -> build -> produce (inputs before outputs). */
  sequence: PlanStep[];
  /** Production queue time per building (0-time recipes excluded). */
  buildingTimes: BuildingTime[];
  /** True when some recipe times are unknown — the timeline is a lower bound. */
  timesIncomplete: boolean;
  /** Electricity/fuel plan, or null when no powered facility is involved. */
  power: PowerPlan | null;
  /** Declared stock actually consumed by the plan, per refId. */
  stockUsed: Record<string, number>;
}

export interface PlanResult extends PlanSummary {
  tree: RequirementNode;
}

export interface MultiPlanResult extends PlanSummary {
  /** One requirement tree per requested target, in input order. */
  trees: RequirementNode[];
}

/** A production goal: `qty` units of `refId`. */
export interface PlanTarget {
  refId: string;
  qty: number;
}

export class CycleError extends Error {
  constructor(public readonly path: string[]) {
    super(`Recipe cycle detected: ${path.join(' -> ')}`);
    this.name = 'CycleError';
  }
}

export class FactionError extends Error {
  constructor(itemId: string, faction: Faction) {
    super(`Item "${itemId}" is not available to faction "${faction}"`);
    this.name = 'FactionError';
  }
}

// ---------------------------------------------------------------------------
// Resolver
// ---------------------------------------------------------------------------

/**
 * Resolve several production targets into one merged plan. Shared
 * intermediates (e.g. bmats needed by two different items) are aggregated
 * into a single produce step; buildings and tech prerequisites are deduped.
 *
 * Batches are rounded up per node (`ceil(needed / outputQty)`), matching how
 * orders are actually queued in-game (you can't queue a fraction of a crate).
 */
export interface ResolveOptions {
  /** Quantities already on hand, deducted before computing batches (A1.2). */
  stock?: Record<string, number>;
}

export function resolveMany(
  data: Dataset,
  targets: PlanTarget[],
  faction: Faction,
  options: ResolveOptions = {},
): MultiPlanResult {
  for (const { refId, qty } of targets) {
    if (!Number.isFinite(qty) || qty <= 0) {
      throw new Error(`Quantity must be a positive number, got ${qty} for "${refId}"`);
    }
    const item = data.items.get(refId);
    if (item && item.faction !== 'Both' && item.faction !== faction) {
      throw new FactionError(refId, faction);
    }
    if (!item && !data.resources.has(refId)) {
      throw new Error(`Unknown target "${refId}"`);
    }
  }

  const totals = { raw: {} as Record<string, number>, refined: {} as Record<string, number> };
  const remainingStock: Record<string, number> = { ...(options.stock ?? {}) };
  const stockUsed: Record<string, number> = {};
  const buildingsUsed = new Map<string, Building>();
  // Production totals per refId, accumulated across all trees so the
  // sequence shows one aggregated step per product.
  const produceTotals = new Map<string, { recipe: Recipe; batches: number; produced: number }>();
  // Post-order of first appearance: inputs are always recorded before the
  // product that consumes them, giving a valid topological order for free.
  const produceOrder: string[] = [];

  function expand(refId: string, qty: number, path: string[]): RequirementNode {
    if (path.includes(refId)) throw new CycleError([...path, refId]);

    // A1.2 — consume declared stock first; only the remainder is produced.
    const avail = remainingStock[refId] ?? 0;
    const fromStock = Math.min(avail, qty);
    if (fromStock > 0) {
      remainingStock[refId] = avail - fromStock;
      stockUsed[refId] = (stockUsed[refId] ?? 0) + fromStock;
    }
    const need = qty - fromStock;
    const stockField = fromStock > 0 ? { fromStock } : {};

    const resource = data.resources.get(refId);
    const recipe = data.recipeByOutput.get(refId);

    // Fully covered by stock: nothing to gather or produce.
    if (need === 0) {
      return { refId, qty, ...stockField, children: [] };
    }

    // Leaf: raw resource, or nothing knows how to produce it.
    if (!recipe || resource?.kind === 'raw') {
      if (resource) {
        const bucket = resource.kind === 'raw' ? totals.raw : totals.refined;
        bucket[refId] = (bucket[refId] ?? 0) + need;
      }
      return { refId, qty, ...stockField, children: [] };
    }

    // Intermediate refined resources also show up in the totals panel.
    if (resource?.kind === 'refined') {
      totals.refined[refId] = (totals.refined[refId] ?? 0) + need;
    }

    const output = recipe.outputs.find((o) => o.refId === refId)!;
    const batches = Math.ceil(need / output.qty);
    const produced = batches * output.qty;

    const building = data.buildings.get(recipe.buildingId)!;
    if (!buildingsUsed.has(building.id)) buildingsUsed.set(building.id, building);

    const nextPath = [...path, refId];
    const children = recipe.inputs.map((input) =>
      expand(input.refId, input.qty * batches, nextPath),
    );

    // Record after children: post-order == inputs first.
    const agg = produceTotals.get(refId);
    if (agg) {
      agg.batches += batches;
      agg.produced += produced;
    } else {
      produceTotals.set(refId, { recipe, batches, produced });
      produceOrder.push(refId);
    }

    return {
      refId,
      qty,
      ...stockField,
      recipeId: recipe.id,
      buildingId: recipe.buildingId,
      batches,
      produced,
      children,
    };
  }

  const trees = targets.map((t) => expand(t.refId, t.qty, []));

  // Buildings, construction total, prerequisites (deduped by techId).
  const buildings = [...buildingsUsed.values()];
  const constructionTotal: MaterialCost = {};
  const prereqById = new Map<string, TechRequirement>();
  for (const b of buildings) {
    for (const [mat, amount] of Object.entries(b.constructionCost)) {
      if (typeof amount !== 'number') continue;
      const key = mat as keyof MaterialCost;
      constructionTotal[key] = (constructionTotal[key] ?? 0) + amount;
    }
    for (const req of b.prerequisites) {
      if (!prereqById.has(req.techId)) prereqById.set(req.techId, req);
    }
  }
  const prerequisites = [...prereqById.values()];

  // Production time per building queue (aggregated produce steps).
  const timeByBuilding = new Map<string, number>();
  let timesIncomplete = false;
  for (const [, agg] of produceTotals) {
    if (agg.recipe.timeSeconds <= 0) {
      timesIncomplete = true;
      continue;
    }
    const prev = timeByBuilding.get(agg.recipe.buildingId) ?? 0;
    timeByBuilding.set(agg.recipe.buildingId, prev + agg.batches * agg.recipe.timeSeconds);
  }
  const buildingTimes: BuildingTime[] = [...timeByBuilding.entries()].map(
    ([buildingId, seconds]) => ({ buildingId, seconds }),
  );

  // Electricity: powered facilities -> generators -> diesel.
  const totalMW = buildings.reduce((sum, b) => sum + (b.powerRequired ?? 0), 0);
  let power: PowerPlan | null = null;
  if (totalMW > 0) {
    const plants = Math.ceil(totalMW / DIESEL_POWER_PLANT.outputMW);
    const plantCost: MaterialCost = {};
    for (const [mat, amount] of Object.entries(DIESEL_POWER_PLANT.constructionCost)) {
      if (typeof amount !== 'number') continue;
      plantCost[mat as keyof MaterialCost] = amount * plants;
    }
    // Consumption scales with actual load, not plant capacity.
    const fuelLitersPerHour =
      (totalMW / DIESEL_POWER_PLANT.outputMW) * DIESEL_POWER_PLANT.fuelLitersPerHour;
    // Queues run in parallel: the makespan is the longest one. Only the
    // powered buildings burn fuel, but the grid usually stays up for the
    // whole run — use the global makespan as the honest estimate.
    const makespan = buildingTimes.reduce((max, bt) => Math.max(max, bt.seconds), 0);
    const durationHours = makespan > 0 ? makespan / 3600 : null;
    const fuelLitersTotal =
      durationHours !== null ? Math.ceil(fuelLitersPerHour * durationHours) : null;
    const fuelSalvage =
      fuelLitersTotal !== null ? Math.ceil(fuelLitersTotal / 100) * 10 : null;
    power = {
      totalMW,
      plants,
      plantCost,
      fuelLitersPerHour,
      durationHours,
      fuelLitersTotal,
      fuelSalvage,
    };
  }

  // Sequence: unlock tech, build the buildings, then produce in dependency order.
  const sequence: PlanStep[] = [
    ...prerequisites.map((req): PlanStep => ({ type: 'tech', techId: req.techId })),
    ...buildings.map((b): PlanStep => ({ type: 'build', buildingId: b.id })),
    ...produceOrder.map((refId): PlanStep => {
      const agg = produceTotals.get(refId)!;
      return {
        type: 'produce',
        refId,
        recipeId: agg.recipe.id,
        buildingId: agg.recipe.buildingId,
        batches: agg.batches,
        produced: agg.produced,
      };
    }),
  ];

  return {
    trees,
    totals,
    buildings,
    constructionTotal,
    prerequisites,
    sequence,
    buildingTimes,
    timesIncomplete,
    power,
    stockUsed,
  };
}

/** Single-target convenience wrapper around {@link resolveMany}. */
export function resolve(
  data: Dataset,
  targetId: string,
  quantity: number,
  faction: Faction,
  options: ResolveOptions = {},
): PlanResult {
  const { trees, ...summary } = resolveMany(
    data,
    [{ refId: targetId, qty: quantity }],
    faction,
    options,
  );
  return { tree: trees[0], ...summary };
}
