import { describe, expect, it } from 'vitest';
import { buildDataset, dataset } from '../data';
import { planCargo } from '../lib/logistics';
import type { Building, Item, Recipe, Resource } from '../types/domain';
import { CycleError, FactionError, resolve, resolveMany } from './resolver';

// ---------------------------------------------------------------------------
// Fixture: a tiny self-contained dataset exercising every engine feature.
// ---------------------------------------------------------------------------

const name = (s: string) => ({ en: s, fr: s });

const resources: Resource[] = [
  { id: 'salvage', name: name('Salvage'), kind: 'raw' },
  { id: 'sulfur', name: name('Sulfur'), kind: 'raw' },
  { id: 'bmats', name: name('Basic Materials'), kind: 'refined' },
  { id: 'hemats', name: name('Heavy Explosive Powder'), kind: 'refined' },
];

const industry = { techId: 'tech-industry', name: name('Industry') };

const buildings: Building[] = [
  { id: 'refinery', name: name('Refinery'), kind: 'Refinery', constructionCost: { bmats: 100 }, prerequisites: [industry] },
  { id: 'factory', name: name('Factory'), kind: 'Factory', constructionCost: { bmats: 200 }, prerequisites: [industry] },
];

const recipes: Recipe[] = [
  { id: 'refine-bmats', buildingId: 'refinery', inputs: [{ refId: 'salvage', qty: 2 }], outputs: [{ refId: 'bmats', qty: 1 }], timeSeconds: 1 },
  { id: 'refine-hemats', buildingId: 'refinery', inputs: [{ refId: 'sulfur', qty: 5 }], outputs: [{ refId: 'hemats', qty: 1 }], timeSeconds: 15 },
];

const items: Item[] = [
  { id: 'rifle', name: name('Rifle'), category: 'smallArms', faction: 'Colonial', cost: { bmats: 100 }, amountProduced: 10, producedBy: 'factory' },
  { id: 'shell', name: name('Shell'), category: 'heavyArms', faction: 'Both', cost: { bmats: 120, hemats: 10 }, amountProduced: 5, producedBy: 'factory' },
];

const data = buildDataset(resources, buildings, recipes, items);

describe('resolve — requirement tree', () => {
  it('decomposes a multi-level chain down to raw resources', () => {
    // 25 rifles -> 3 crates of 10 -> 300 bmats -> 600 salvage
    const plan = resolve(data, 'rifle', 25, 'Colonial');

    expect(plan.tree.refId).toBe('rifle');
    expect(plan.tree.batches).toBe(3);
    expect(plan.tree.produced).toBe(30);

    const bmatsNode = plan.tree.children[0];
    expect(bmatsNode.refId).toBe('bmats');
    expect(bmatsNode.qty).toBe(300);
    expect(bmatsNode.children[0]).toMatchObject({ refId: 'salvage', qty: 600 });

    expect(plan.totals.raw).toEqual({ salvage: 600 });
    expect(plan.totals.refined).toEqual({ bmats: 300 });
  });

  it('does not round up when the quantity is an exact number of crates', () => {
    const plan = resolve(data, 'rifle', 20, 'Colonial');
    expect(plan.tree.batches).toBe(2);
    expect(plan.tree.produced).toBe(20);
    expect(plan.totals.raw.salvage).toBe(400);
  });
});

describe('resolve — buildings and prerequisites', () => {
  it('lists each building once, sums construction costs, dedupes tech prereqs', () => {
    const plan = resolve(data, 'shell', 5, 'Colonial');

    expect(plan.buildings.map((b) => b.id)).toEqual(['factory', 'refinery']);
    expect(plan.constructionTotal).toEqual({ bmats: 300 });
    expect(plan.prerequisites).toHaveLength(1);
    expect(plan.prerequisites[0].techId).toBe('tech-industry');
  });
});

describe('resolve — build sequence', () => {
  it('orders steps: tech, then build, then produce with inputs before outputs', () => {
    const plan = resolve(data, 'shell', 5, 'Colonial');
    const types = plan.sequence.map((s) => s.type);

    // tech* build* produce* — no interleaving
    expect(types).toEqual(['tech', 'build', 'build', 'produce', 'produce', 'produce']);

    const produceIds = plan.sequence.flatMap((s) => (s.type === 'produce' ? [s.refId] : []));
    expect(produceIds.indexOf('bmats')).toBeLessThan(produceIds.indexOf('shell'));
    expect(produceIds.indexOf('hemats')).toBeLessThan(produceIds.indexOf('shell'));
  });

  it('aggregates produce steps per product across the tree', () => {
    const plan = resolve(data, 'shell', 5, 'Colonial');
    const bmatsSteps = plan.sequence.filter((s) => s.type === 'produce' && s.refId === 'bmats');
    expect(bmatsSteps).toHaveLength(1);
    expect(bmatsSteps[0]).toMatchObject({ batches: 120, produced: 120 });
  });
});

describe('resolve — guards', () => {
  it('rejects items not available to the selected faction', () => {
    expect(() => resolve(data, 'rifle', 1, 'Warden')).toThrow(FactionError);
  });

  it('rejects unknown targets and non-positive quantities', () => {
    expect(() => resolve(data, 'nope', 1, 'Colonial')).toThrow(/Unknown target/);
    expect(() => resolve(data, 'rifle', 0, 'Colonial')).toThrow(/positive/);
    expect(() => resolve(data, 'rifle', -3, 'Colonial')).toThrow(/positive/);
  });

  it('detects recipe cycles', () => {
    const cyclicResources: Resource[] = [
      { id: 'r1', name: name('R1'), kind: 'refined' },
      { id: 'r2', name: name('R2'), kind: 'refined' },
    ];
    const cyclicRecipes: Recipe[] = [
      { id: 'make-r1', buildingId: 'refinery', inputs: [{ refId: 'r2', qty: 1 }], outputs: [{ refId: 'r1', qty: 1 }], timeSeconds: 1 },
      { id: 'make-r2', buildingId: 'refinery', inputs: [{ refId: 'r1', qty: 1 }], outputs: [{ refId: 'r2', qty: 1 }], timeSeconds: 1 },
    ];
    const cyclic = buildDataset(cyclicResources, buildings, cyclicRecipes, []);
    expect(() => resolve(cyclic, 'r1', 1, 'Colonial')).toThrow(CycleError);
  });
});

describe('resolveMany — merged multi-target plans', () => {
  it('merges totals, dedupes buildings and aggregates shared produce steps', () => {
    // 10 rifles (1 crate, 100 bmats) + 5 shells (1 crate, 120 bmats + 10 hemats)
    const plan = resolveMany(
      data,
      [
        { refId: 'rifle', qty: 10 },
        { refId: 'shell', qty: 5 },
      ],
      'Colonial',
    );

    expect(plan.trees.map((tr) => tr.refId)).toEqual(['rifle', 'shell']);
    expect(plan.totals.refined.bmats).toBe(220);
    expect(plan.totals.raw).toEqual({ salvage: 440, sulfur: 50 });

    // factory + refinery once each, even though both targets use them.
    expect(plan.buildings.map((b) => b.id)).toEqual(['factory', 'refinery']);
    expect(plan.constructionTotal).toEqual({ bmats: 300 });
    expect(plan.prerequisites).toHaveLength(1);

    // One aggregated bmats produce step covering both targets.
    const bmatsSteps = plan.sequence.filter((s) => s.type === 'produce' && s.refId === 'bmats');
    expect(bmatsSteps).toHaveLength(1);
    expect(bmatsSteps[0]).toMatchObject({ batches: 220 });

    // Inputs still come before every output that consumes them.
    const produceIds = plan.sequence.flatMap((s) => (s.type === 'produce' ? [s.refId] : []));
    expect(produceIds.indexOf('bmats')).toBeLessThan(produceIds.indexOf('rifle'));
    expect(produceIds.indexOf('bmats')).toBeLessThan(produceIds.indexOf('shell'));
    expect(produceIds.indexOf('hemats')).toBeLessThan(produceIds.indexOf('shell'));
  });

  it('validates every target', () => {
    expect(() =>
      resolveMany(data, [{ refId: 'shell', qty: 5 }, { refId: 'rifle', qty: 1 }], 'Warden'),
    ).toThrow(FactionError);
  });
});

describe('planCargo — logistics crate/trip math', () => {
  const truck = { itemId: 'truck', capacityCrates: 15 };

  it('rounds crates up per item and trips up per vehicle load', () => {
    // 25 rifles -> 3 crates; 12 shells -> 3 crates (crate of 5) => 6 crates, 1 trip
    const plan = planCargo(
      data,
      [
        { itemId: 'rifle', qty: 25 },
        { itemId: 'shell', qty: 12 },
      ],
      truck,
    );
    expect(plan.rows.map((r) => r.crates)).toEqual([3, 3]);
    expect(plan.totalCrates).toBe(6);
    expect(plan.trips).toBe(1);
  });

  it('needs a second trip past vehicle capacity, and ignores empty/unknown rows', () => {
    const plan = planCargo(
      data,
      [
        { itemId: 'rifle', qty: 160 }, // 16 crates > 15
        { itemId: 'rifle', qty: 0 },
        { itemId: 'ghost', qty: 5 },
      ],
      truck,
    );
    expect(plan.totalCrates).toBe(16);
    expect(plan.trips).toBe(2);
    expect(plan.rows).toHaveLength(1);
  });

  it('returns null trips when no vehicle is selected', () => {
    const plan = planCargo(data, [{ itemId: 'rifle', qty: 10 }], undefined);
    expect(plan.trips).toBeNull();
  });
});

describe('resolve — timeline and power', () => {
  it('sums production time per building queue', () => {
    // 5 shells: 1 crate. bmats: 120 batches x 1s; hemats: 10 batches x 15s = 150s.
    const plan = resolve(data, 'shell', 5, 'Colonial');
    const refinery = plan.buildingTimes.find((bt) => bt.buildingId === 'refinery');
    expect(refinery?.seconds).toBe(120 * 1 + 10 * 15);
    // Fixture items have no craft time -> timeline flagged incomplete, no power.
    expect(plan.timesIncomplete).toBe(true);
    expect(plan.power).toBeNull();
  });

  it('computes MW, generators and diesel for facility chains (cmats)', () => {
    // 100 cmats at the Materials Factory (2 MW): 100 batches x 25s = 2500s.
    const plan = resolve(dataset, 'cmats', 100, 'Colonial');
    expect(plan.totals.raw.salvage).toBe(1000);
    expect(plan.timesIncomplete).toBe(false);
    const mf = plan.buildingTimes.find((bt) => bt.buildingId === 'materials-factory');
    expect(mf?.seconds).toBe(2500);

    const power = plan.power!;
    expect(power.totalMW).toBe(2);
    expect(power.plants).toBe(1); // one 5 MW diesel plant covers 2 MW
    expect(power.plantCost).toEqual({ bmats: 150 });
    expect(power.fuelLitersPerHour).toBeCloseTo((2 / 5) * 2000, 5);
    expect(power.durationHours).toBeCloseTo(2500 / 3600, 5);
    // ceil(800 L/h * 0.694h) = 556 L -> ceil(556/100)*10 = 60 salvage
    expect(power.fuelLitersTotal).toBe(556);
    expect(power.fuelSalvage).toBe(60);
  });

  it('resolves diesel itself through the refinery recipe', () => {
    const plan = resolve(dataset, 'diesel', 250, 'Warden');
    // 250 L -> 3 batches of 100 L -> 30 salvage, 36s of refinery time.
    expect(plan.totals.raw.salvage).toBe(30);
    expect(plan.buildingTimes.find((bt) => bt.buildingId === 'refinery')?.seconds).toBe(36);
  });
});

describe('resolve — real curated dataset', () => {
  it('plans 10x 120mm shells (2 crates): 240 bmats + 20 hemats -> 480 salvage + 100 sulfur', () => {
    const plan = resolve(dataset, '120mm', 10, 'Warden');
    expect(plan.tree.batches).toBe(2);
    expect(plan.totals.refined).toEqual({ bmats: 240, hemats: 20 });
    expect(plan.totals.raw).toEqual({ salvage: 480, sulfur: 100 });
    expect(plan.buildings.map((b) => b.id).sort()).toEqual(['factory', 'refinery']);
  });

  it('resolves facility-built rocket artillery through the full chain', () => {
    // Retiarius = R-1 Hauler + 70 pcmats + 10 AM I + 8 AM III (wiki-verified).
    const plan = resolve(dataset, 'r-17-retiarius-skirmisher', 1, 'Colonial');
    const buildings = plan.buildings.map((b) => b.id);
    for (const b of ['small-assembly-station', 'metalworks', 'materials-factory', 'coal-refinery', 'garage']) {
      expect(buildings).toContain(b);
    }
    // Facility chain pulls coal (coke) and sulfur (AM III) down to raw.
    expect(plan.totals.raw.coal).toBeGreaterThan(0);
    expect(plan.totals.raw.sulfur).toBeGreaterThan(0);
    expect(plan.totals.refined.pcmats).toBe(70);
    expect(plan.totals.refined.amats1).toBe(10);
    expect(plan.totals.refined.amats3).toBe(8);
    // Powered facilities -> a real electricity plan.
    expect(plan.power).not.toBeNull();
    expect(plan.power!.totalMW).toBeGreaterThan(0);
  });

  it('enforces faction on real items', () => {
    expect(() => resolve(dataset, 'argenti-rii-rifle', 10, 'Warden')).toThrow(FactionError);
    expect(resolve(dataset, 'argenti-rii-rifle', 10, 'Colonial').totals.raw.salvage).toBe(200);
  });

  it('loads the full merged dataset (250+ items, all referentially valid)', () => {
    expect(dataset.items.size).toBeGreaterThanOrEqual(250);
    // Every item resolves without throwing for a compatible faction.
    for (const item of dataset.items.values()) {
      const faction = item.faction === 'Both' ? 'Colonial' : item.faction;
      const plan = resolve(dataset, item.id, item.amountProduced, faction);
      expect(plan.sequence.length).toBeGreaterThan(0);
    }
  });
});
