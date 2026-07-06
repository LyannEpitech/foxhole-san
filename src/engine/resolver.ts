import type { Dataset } from '../data';
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

export interface PlanResult {
  tree: RequirementNode;
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
 * Resolve a production target into a full plan: requirement tree, resource
 * totals, buildings (with construction cost + prerequisites) and an ordered
 * build/production sequence.
 *
 * Batches are rounded up per node (`ceil(needed / outputQty)`), matching how
 * orders are actually queued in-game (you can't queue a fraction of a crate).
 */
export function resolve(
  data: Dataset,
  targetId: string,
  quantity: number,
  faction: Faction,
): PlanResult {
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error(`Quantity must be a positive number, got ${quantity}`);
  }
  const targetItem = data.items.get(targetId);
  if (targetItem && targetItem.faction !== 'Both' && targetItem.faction !== faction) {
    throw new FactionError(targetId, faction);
  }
  if (!targetItem && !data.resources.has(targetId)) {
    throw new Error(`Unknown target "${targetId}"`);
  }

  const totals = { raw: {} as Record<string, number>, refined: {} as Record<string, number> };
  const buildingsUsed = new Map<string, Building>();
  // Production totals per refId, accumulated across the whole tree so the
  // sequence shows one aggregated step per product.
  const produceTotals = new Map<string, { recipe: Recipe; batches: number; produced: number }>();
  // Post-order of first appearance: inputs are always recorded before the
  // product that consumes them, giving a valid topological order for free.
  const produceOrder: string[] = [];

  function expand(refId: string, qty: number, path: string[]): RequirementNode {
    if (path.includes(refId)) throw new CycleError([...path, refId]);

    const resource = data.resources.get(refId);
    const recipe = data.recipeByOutput.get(refId);

    // Leaf: raw resource, or nothing knows how to produce it.
    if (!recipe || resource?.kind === 'raw') {
      if (resource) {
        const bucket = resource.kind === 'raw' ? totals.raw : totals.refined;
        bucket[refId] = (bucket[refId] ?? 0) + qty;
      }
      return { refId, qty, children: [] };
    }

    // Intermediate refined resources also show up in the totals panel.
    if (resource?.kind === 'refined') {
      totals.refined[refId] = (totals.refined[refId] ?? 0) + qty;
    }

    const output = recipe.outputs.find((o) => o.refId === refId)!;
    const batches = Math.ceil(qty / output.qty);
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
      recipeId: recipe.id,
      buildingId: recipe.buildingId,
      batches,
      produced,
      children,
    };
  }

  const tree = expand(targetId, quantity, []);

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

  return { tree, totals, buildings, constructionTotal, prerequisites, sequence };
}
