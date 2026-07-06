import { z } from 'zod';
import type {
  Building,
  Item,
  Recipe,
  Resource,
  VehicleSpec,
} from '../types/domain';
import resourcesJson from './resources.json';
import buildingsJson from './buildings.json';
import recipesJson from './recipes.json';
import itemsJson from './items.json';
import vehiclesJson from './vehicles.json';

// ---------------------------------------------------------------------------
// Zod schemas — validate the hand-curated JSON at load time so data-entry
// mistakes fail loudly instead of producing silently wrong plans.
// ---------------------------------------------------------------------------

const localizedString = z.object({ en: z.string().min(1), fr: z.string().min(1) });

const materialCost = z.object({
  bmats: z.number().int().positive().optional(),
  rmats: z.number().int().positive().optional(),
  emats: z.number().int().positive().optional(),
  hemats: z.number().int().positive().optional(),
});

const techRequirement = z.object({ techId: z.string().min(1), name: localizedString });

const resourceSchema = z.object({
  id: z.string().min(1),
  name: localizedString,
  kind: z.enum(['raw', 'refined']),
});

const buildingSchema = z.object({
  id: z.string().min(1),
  name: localizedString,
  kind: z.enum(['Refinery', 'Factory', 'MassProductionFactory', 'MaterialsFactory', 'AssemblyStation']),
  constructionCost: materialCost,
  powerRequired: z.number().positive().optional(),
  prerequisites: z.array(techRequirement),
});

const recipeIO = z.object({ refId: z.string().min(1), qty: z.number().positive() });

const recipeSchema = z.object({
  id: z.string().min(1),
  buildingId: z.string().min(1),
  inputs: z.array(recipeIO).min(1),
  outputs: z.array(recipeIO).min(1),
  timeSeconds: z.number().nonnegative(),
});

const itemSchema = z.object({
  id: z.string().min(1),
  name: localizedString,
  category: z.enum([
    'smallArms',
    'heavyArms',
    'utilities',
    'medical',
    'supplies',
    'shippables',
    'vehicles',
    'uniforms',
  ]),
  faction: z.enum(['Colonial', 'Warden', 'Both']),
  cost: materialCost,
  amountProduced: z.number().int().positive(),
  producedBy: z.string().min(1),
  techRequirement: techRequirement.optional(),
  isMfpCraftable: z.boolean().optional(),
  craftTimeSeconds: z.number().positive().optional(),
});

// ---------------------------------------------------------------------------
// Dataset: everything the resolver needs, with items normalized into recipes
// so the engine only reasons about one concept ("a recipe produces a ref").
// ---------------------------------------------------------------------------

export interface Dataset {
  resources: Map<string, Resource>;
  buildings: Map<string, Building>;
  items: Map<string, Item>;
  recipes: Recipe[];
  /** refId -> the recipe that produces it (first one wins). */
  recipeByOutput: Map<string, Recipe>;
}

/** Turn an item's MaterialCost + amountProduced into an implicit crafting recipe. */
export function itemToRecipe(item: Item): Recipe {
  const inputs = Object.entries(item.cost)
    .filter((entry): entry is [string, number] => typeof entry[1] === 'number')
    .map(([refId, qty]) => ({ refId, qty }));
  return {
    id: `craft-${item.id}`,
    buildingId: item.producedBy,
    inputs,
    outputs: [{ refId: item.id, qty: item.amountProduced }],
    // 0 means "unknown" — the timeline reports itself as incomplete then.
    timeSeconds: item.craftTimeSeconds ?? 0,
  };
}

export function buildDataset(
  resources: Resource[],
  buildings: Building[],
  recipes: Recipe[],
  items: Item[],
): Dataset {
  const resourceMap = new Map(resources.map((r) => [r.id, r]));
  const buildingMap = new Map(buildings.map((b) => [b.id, b]));
  const itemMap = new Map(items.map((i) => [i.id, i]));

  const allRecipes = [...recipes, ...items.map(itemToRecipe)];

  // Referential integrity checks.
  const known = (refId: string) => resourceMap.has(refId) || itemMap.has(refId);
  for (const recipe of allRecipes) {
    if (!buildingMap.has(recipe.buildingId)) {
      throw new Error(`Recipe "${recipe.id}" references unknown building "${recipe.buildingId}"`);
    }
    for (const io of [...recipe.inputs, ...recipe.outputs]) {
      if (!known(io.refId)) {
        throw new Error(`Recipe "${recipe.id}" references unknown ref "${io.refId}"`);
      }
    }
  }

  const recipeByOutput = new Map<string, Recipe>();
  for (const recipe of allRecipes) {
    for (const out of recipe.outputs) {
      if (!recipeByOutput.has(out.refId)) recipeByOutput.set(out.refId, recipe);
    }
  }

  return {
    resources: resourceMap,
    buildings: buildingMap,
    items: itemMap,
    recipes: allRecipes,
    recipeByOutput,
  };
}

const vehicleSchema = z.object({
  itemId: z.string().min(1),
  capacityCrates: z.number().int().positive(),
});

/** Game data, validated. Throws at module load if the JSON is malformed. */
export const dataset: Dataset = buildDataset(
  z.array(resourceSchema).parse(resourcesJson),
  z.array(buildingSchema).parse(buildingsJson),
  z.array(recipeSchema).parse(recipesJson),
  z.array(itemSchema).parse(itemsJson),
);

/** Transport vehicles (must reference existing items). */
export const vehicles: VehicleSpec[] = z.array(vehicleSchema).parse(vehiclesJson);
for (const v of vehicles) {
  if (!dataset.items.has(v.itemId)) {
    throw new Error(`Vehicle spec references unknown item "${v.itemId}"`);
  }
}
